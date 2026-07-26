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
  const txHash: string = await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: opts.tokenContract, data }],
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
