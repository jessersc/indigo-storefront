'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Wallet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  getCryptoConfig,
  payWithInjectedWallet,
  verifyCryptoPayment,
  toUnits,
  reasonToSpanish,
  type CryptoConfig,
} from '../lib/crypto-pay';

interface CryptoPaymentProps {
  orderNumber: string;
  totalUsd: number;
  authToken?: string | null;
  // Persists the order (pending) before verification. Idempotent.
  ensureOrderSaved: () => Promise<void>;
  onConfirmed: () => void;
}

type TokenSymbol = 'USDT' | 'USDC';

export default function CryptoPayment({
  orderNumber,
  totalUsd,
  authToken,
  ensureOrderSaved,
  onConfirmed,
}: CryptoPaymentProps) {
  const [config, setConfig] = useState<CryptoConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>('USDC');
  const [txHash, setTxHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);

  useEffect(() => {
    getCryptoConfig()
      .then(setConfig)
      .catch((e) => setLoadError(e.message || 'Error cargando cripto.'));
  }, []);

  const copyAddress = () => {
    if (!config?.address) return;
    navigator.clipboard.writeText(config.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const runVerify = async (hash: string) => {
    setError('');
    setInfo('');
    if (!/^0x([A-Fa-f0-9]{64})$/.test(hash.trim())) {
      setError('El hash de la transaccion no es valido.');
      return;
    }
    setBusy(true);
    try {
      await ensureOrderSaved();
      const result = await verifyCryptoPayment(
        { orderNumber, token: selectedToken, txHash: hash.trim(), expectedAmountUsd: totalUsd },
        authToken,
      );
      if (result.ok) {
        setInfo('Pago verificado. Confirmando tu orden...');
        onConfirmed();
      } else {
        setError(reasonToSpanish(result.reason));
      }
    } catch (e: any) {
      setError(e.message || 'Error verificando el pago.');
    } finally {
      setBusy(false);
    }
  };

  const payWithWallet = async () => {
    if (!config) return;
    setError('');
    setInfo('');
    const token = config.tokens[selectedToken];
    setBusy(true);
    try {
      await ensureOrderSaved();
      const hash = await payWithInjectedWallet({
        to: config.address,
        tokenContract: token.contract,
        amountUnits: toUnits(totalUsd, token.decimals),
        chainId: config.chainId,
      });
      setTxHash(hash);
      setInfo('Transaccion enviada. Verificando en la red...');
      await runVerify(hash);
    } catch (e: any) {
      setError(e.message || 'No se pudo completar el pago con la wallet.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 font-bold text-sm text-center">{loadError}</div>;
  }
  if (!config) {
    return <div className="text-center py-8 text-slate-400 font-bold">Cargando opciones de cripto...</div>;
  }
  if (!config.enabled || !config.address || /^0x0{40}$/.test(config.address)) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700 font-bold text-sm text-center">
        El pago con cripto no esta disponible en este momento.
      </div>
    );
  }

  const networkName =
    config.chainId === 1 ? 'Ethereum (Mainnet)'
    : config.chainId === 11155111 ? 'Sepolia (red de prueba)'
    : `Red ${config.chainId}`;

  // The contract for the token currently selected. Shown so a customer whose
  // wallet does not list the token can add it by address rather than guessing.
  const selectedContract = config.tokens?.[selectedToken]?.contract ?? '';

  const copyContract = () => {
    if (!selectedContract) return;
    navigator.clipboard.writeText(selectedContract).then(() => {
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-5">
        <div>
          <h3 className="font-black text-slate-800 text-xl">Pagar con USDT / USDC</h3>
          <p className="text-sm text-slate-500 font-semibold">
            Envia <strong>${totalUsd.toFixed(2)}</strong> en {selectedToken} por la red {networkName} a la
            direccion de abajo. Luego confirma con el hash de la transaccion.
          </p>
        </div>

        {/*
          Token selector.

          The receiving address is the SAME for both tokens — it is one wallet —
          so choosing here is not cosmetic: it decides which contract the
          Worker checks the transfer against. Pick USDC, send USDT, and
          verification finds no matching transfer even though the money
          arrived. Hence the contract address and the explicit warning below:
          the choice has to be visibly consequential, not a styling toggle.
        */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">
            1. Elige que moneda vas a enviar
          </p>
          <div className="flex gap-3">
            {(['USDC', 'USDT'] as TokenSymbol[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedToken(t)}
                className={`flex-1 py-2.5 rounded-2xl border-2 font-black text-sm transition-all ${
                  selectedToken === t
                    ? 'border-kawaii-pink bg-[#fff6fa] text-kawaii-pink'
                    : 'border-slate-100 text-slate-500 hover:border-kawaii-light-pink/50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Exactly what to send, so there is nothing to infer. */}
        <div className="bg-[#fff6fa] border border-[#ffe0ef] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monto</span>
            <span className="font-black text-slate-800">
              {totalUsd.toFixed(2)} {selectedToken}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Red</span>
            <span className="font-black text-slate-800">{networkName}</span>
          </div>
          {selectedContract && (
            <div className="pt-2 border-t border-[#ffe0ef]">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">
                Contrato de {selectedToken}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-600 break-all flex-1">
                  {selectedContract}
                </span>
                <button
                  type="button"
                  onClick={copyContract}
                  className="p-1.5 rounded-lg hover:bg-white transition-colors flex-shrink-0"
                  title="Copiar contrato"
                >
                  {copiedContract
                    ? <Check size={14} className="text-green-500" />
                    : <Copy size={14} className="text-slate-400" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Usalo si tu wallet no muestra {selectedToken} en la lista.
              </p>
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="text-xs font-bold text-amber-800 leading-relaxed">
            ⚠️ Envia solo <strong>{selectedToken}</strong> por la red <strong>{networkName}</strong>.
            Enviar otra moneda, u otra red, hace que el pago no se pueda verificar
            y los fondos no se recuperan.
          </p>
        </div>

        {/* Address + QR */}
        <div className="flex flex-col items-center gap-3 bg-[#fafafa] rounded-2xl p-4 border border-slate-100">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <QRCodeSVG value={config.address} size={148} />
          </div>
          <div className="w-full">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 text-center mb-1">
              Direccion de cobro ({networkName})
            </p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs font-mono text-slate-700 break-all flex-1">{config.address}</span>
              <button onClick={copyAddress} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0" title="Copiar">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-400" />}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-600 font-bold text-sm text-center">{error}</div>}
        {info && <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-green-700 font-bold text-sm text-center">{info}</div>}

        {/* Wallet pay */}
        <button
          onClick={payWithWallet}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-4 rounded-full font-black tracking-wide hover:bg-slate-900 transition-all disabled:opacity-60 cursor-pointer"
        >
          <Wallet size={18} /> {busy ? 'Procesando...' : 'Conectar wallet y pagar'}
        </button>

        {/* Manual hash */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-black uppercase tracking-widest">
            <div className="flex-1 h-px bg-slate-200" /> o ingresa el hash <div className="flex-1 h-px bg-slate-200" />
          </div>
          <input
            type="text"
            placeholder="0x... (hash de la transaccion)"
            className="w-full p-3 rounded-2xl border-2 border-slate-200 focus:border-kawaii-pink outline-none font-mono text-xs text-slate-700"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
          />
          <button
            onClick={() => runVerify(txHash)}
            disabled={busy || !txHash}
            className="w-full bg-kawaii-pink text-white py-4 rounded-full font-black tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer shadow-[0_4px_20px_rgba(255,107,157,0.3)]"
          >
            {busy ? 'VERIFICANDO...' : 'YA PAGUE, VERIFICAR'}
          </button>
        </div>
      </div>
    </div>
  );
}
