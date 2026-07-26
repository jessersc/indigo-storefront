/**
 * Client helpers for the crypto (USDT/USDC) checkout flow. Talks to the Worker
 * for config + verification, and to the injected EIP-1193 wallet (MetaMask etc.)
 * for the optional one-click "pay" button. No WalletConnect project id / SDK.
 */

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

export interface CryptoToken {
  symbol: 'USDT' | 'USDC';
  contract: string;
  decimals: number;
}

export interface CryptoConfig {
  enabled: boolean;
  address: string;
  chainId: number;
  minConfirmations: number;
  tokens: Record<string, CryptoToken>;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  confirmations?: number;
  amount?: string;
  status?: string;
}

export async function getCryptoConfig(): Promise<CryptoConfig> {
  const res = await fetch(`${API_URL}/crypto/config`);
  if (!res.ok) throw new Error('No se pudo cargar la configuracion de cripto.');
  return res.json();
}

/** USD amount -> integer token units (e.g. 12.00 USDC, 6 decimals -> 12000000). */
export function toUnits(usd: number, decimals: number): bigint {
  return BigInt(Math.round(usd * 10 ** decimals));
}

function transferCalldata(to: string, amountUnits: bigint): string {
  const toPadded = to.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const amountPadded = amountUnits.toString(16).padStart(64, '0');
  return `0xa9059cbb${toPadded}${amountPadded}`;
}

/** ERC-20 `balanceOf(address)`. */
function balanceOfCalldata(owner: string): string {
  return `0x70a08231${owner.replace(/^0x/, '').toLowerCase().padStart(64, '0')}`;
}

/**
 * Gas budget for an ERC-20 transfer.
 *
 * The limit is now set EXPLICITLY. Leaving it off meant the wallet estimated
 * it, and when that estimate reverts — overwhelmingly because the sender holds
 * none of the token — MetaMask falls back to roughly the block gas limit and
 * submits 21,000,000. Infura rejects that outright:
 *
 *   RPC Error: eth_sendRawTransaction: transaction gas limit too high
 *   (cap: 16777216, tx: 21000000)
 *
 * So the customer saw a cryptic gas error whose real cause was an empty wallet.
 * A real transfer costs ~45–65k; 100k covers tokens that do extra bookkeeping,
 * and the ceiling stops a bad estimate from ever reaching the cap again.
 */
// Written as BigInt(...) rather than `100_000n`: the tsconfig target predates
// ES2020, so bigint literals do not compile even though the type is available.
const TRANSFER_GAS_FALLBACK = BigInt(100000);
const TRANSFER_GAS_CEILING = BigInt(250000);

function toHex(n: bigint): string {
  return `0x${n.toString(16)}`;
}

/** Sends the ERC-20 transfer via the injected wallet; returns the tx hash. */
export async function payWithInjectedWallet(opts: {
  to: string;
  tokenContract: string;
  amountUnits: bigint;
  chainId: number;
}): Promise<string> {
  const eth = (window as any).ethereum;
  if (!eth) {
    throw new Error('No se detecto una wallet. Instala MetaMask o paga manualmente e ingresa el hash.');
  }
  const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
  const from = accounts?.[0];
  if (!from) throw new Error('No se pudo conectar la wallet.');

  const currentChain: string = await eth.request({ method: 'eth_chainId' });
  if (parseInt(currentChain, 16) !== opts.chainId) {
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${opts.chainId.toString(16)}` }],
      });
    } catch {
      throw new Error('Cambia tu wallet a la red correcta e intenta de nuevo.');
    }
  }

  const data = transferCalldata(opts.to, opts.amountUnits);

  // Check the balance before asking the wallet to do anything. This is the
  // failure that actually happens, and catching it here turns an unreadable RPC
  // gas error into a sentence the customer can act on.
  try {
    const raw: string = await eth.request({
      method: 'eth_call',
      params: [{ from, to: opts.tokenContract, data: balanceOfCalldata(from) }, 'latest'],
    });
    if (typeof raw === 'string' && /^0x[0-9a-f]*$/i.test(raw) && raw.length > 2) {
      const balance = BigInt(raw);
      if (balance < opts.amountUnits) {
        throw new Error(
          'Tu wallet no tiene suficiente saldo de ese token para completar el pago. ' +
            'Verifica que elegiste la red y el token correctos.',
        );
      }
    }
  } catch (err: any) {
    // A genuine insufficient-balance result must surface; an RPC hiccup reading
    // the balance must not block a customer who can actually pay.
    if (err?.message?.startsWith('Tu wallet no tiene')) throw err;
  }

  // Estimate, then clamp. A reverting estimate falls back to a fixed sane
  // number rather than letting the wallet invent one near the block limit.
  let gas = TRANSFER_GAS_FALLBACK;
  try {
    const estimated: string = await eth.request({
      method: 'eth_estimateGas',
      params: [{ from, to: opts.tokenContract, data }],
    });
    const asBigInt = BigInt(estimated);
    if (asBigInt > BigInt(0)) {
      // +25% headroom: an estimate is taken against current state, and state
      // can move between estimating and mining.
      gas = (asBigInt * BigInt(125)) / BigInt(100);
    }
  } catch {
    // Keep the fallback.
  }
  if (gas > TRANSFER_GAS_CEILING) gas = TRANSFER_GAS_CEILING;
  if (gas < TRANSFER_GAS_FALLBACK) gas = TRANSFER_GAS_FALLBACK;

  const txHash: string = await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: opts.tokenContract, data, gas: toHex(gas) }],
  });
  return txHash;
}

export async function verifyCryptoPayment(
  payload: { orderNumber: string; token: string; txHash: string; expectedAmountUsd: number },
  token?: string | null,
): Promise<VerifyResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/crypto/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json();
}

const REASON_ES: Record<string, string> = {
  no_matching_transfer: 'No encontramos una transferencia a la direccion. Verifica el hash y el token.',
  amount_too_low: 'El monto transferido es menor al esperado.',
  insufficient_confirmations: 'Pago detectado. Esperando confirmaciones en la red, intenta en un momento.',
  tx_not_found: 'Aun no encontramos la transaccion. Espera unos segundos e intenta de nuevo.',
  tx_failed: 'La transaccion fallo en la red.',
  not_configured: 'La verificacion de cripto no esta disponible en este momento.',
  no_address: 'No hay una direccion de cobro configurada.',
  bad_token: 'Token no valido.',
  bad_request: 'Datos incompletos.',
};

export function reasonToSpanish(reason?: string): string {
  return (reason && REASON_ES[reason]) || 'No se pudo verificar el pago. Intenta de nuevo.';
}
