'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Search } from 'lucide-react';

/**
 * Cashea (buy now, pay in instalments).
 *
 * The real flow, using the store's Cashea merchant API:
 *   1. The customer creates the order in the Cashea app against this store.
 *   2. We look it up by their cedula  (GET  /orders/:idNumber).
 *   3. They confirm, and we capture the down payment
 *      (POST /orders/:idNumber/down-payment).
 *
 * Step 3 runs entirely inside our Vercel route, which holds the merchant key
 * and — once Cashea reports the capture succeeded — confirms the order with the
 * Worker over the internal channel. The browser is never the thing that says a
 * payment happened.
 */

const CASHEA_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="32" height="32"><rect x="30" y="30" width="940" height="940" rx="220" ry="220" fill="#FFF212"/><circle cx="500" cy="520" r="320" fill="#373435"/><circle cx="500" cy="520" r="170" fill="#FFF212"/><rect x="665" y="420" width="300" height="200" fill="#FFF212"/><rect x="470" y="112" width="60" height="220" fill="#FFF212"/><rect x="640" y="440" width="40" height="40" fill="#FFF212"/></svg>`;

interface CasheaPaymentProps {
  orderNumber: string;
  totalUsd: number;
  /** The customer's cedula, already collected on the delivery form. */
  cedula: string;
  /** Persists the order as pending before any capture. Idempotent. */
  ensureOrderSaved: () => Promise<boolean>;
  onConfirmed: (transactionId?: string) => void;
}

/** What we surface from Cashea's order payload, defensively parsed. */
interface CasheaOrder {
  id: string;
  status: string;
  /** Total the customer owes Cashea. */
  total: number | null;
  /** The up-front instalment we capture now. */
  downPayment: number | null;
  instalments: number | null;
}

/**
 * Cashea's payload has shifted field names between versions, so each value is
 * read from the first key that is present rather than assuming one shape.
 */
function parseCasheaOrder(raw: any): CasheaOrder | null {
  const order = raw?.order ?? raw?.data ?? raw;
  if (!order || typeof order !== 'object') return null;

  const id = order.id ?? order.orderId ?? order.reference ?? '';
  if (!id) return null;

  const num = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = Number(order[k]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return null;
  };

  return {
    id: String(id),
    status: String(order.status ?? order.state ?? 'pending'),
    total: num('total', 'amount', 'totalAmount'),
    downPayment: num('downPayment', 'down_payment', 'initialPayment', 'firstInstalment'),
    instalments: num('instalments', 'installments', 'quotas', 'numberOfInstallments'),
  };
}

export default function CasheaPayment({
  orderNumber,
  totalUsd,
  cedula,
  ensureOrderSaved,
  onConfirmed,
}: CasheaPaymentProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [idNumber, setIdNumber] = useState(cedula || '');
  const [order, setOrder] = useState<CasheaOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/cashea?action=config')
      .then((r) => r.json())
      .then((c: any) => setConfigured(Boolean(c?.configured)))
      .catch(() => setConfigured(false));
  }, []);

  const lookupOrder = async () => {
    const id = idNumber.trim();
    if (!/^\d+$/.test(id)) {
      setError('Ingresa tu cedula (solo numeros).');
      return;
    }
    setBusy(true);
    setError('');
    setOrder(null);
    try {
      // The lookup is gated on owning an unpaid order placed with this cedula,
      // so ours has to exist before we can ask Cashea about theirs.
      if (!(await ensureOrderSaved())) {
        setError('No pudimos registrar tu pedido. Intenta de nuevo.');
        return;
      }

      const res = await fetch(
        `/api/cashea?action=orders&idNumber=${encodeURIComponent(id)}` +
          `&orderNumber=${encodeURIComponent(orderNumber)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 403
            ? 'Verifica que la cedula sea la misma que usaste en tus datos de entrega.'
            : res.status === 404
              ? 'No encontramos una orden de Cashea con esa cedula. Creala primero en la app de Cashea.'
              : 'No pudimos consultar tu orden en Cashea. Intenta de nuevo.',
        );
        return;
      }
      const parsed = parseCasheaOrder(data);
      if (!parsed) {
        setError('No encontramos una orden de Cashea activa con esa cedula.');
        return;
      }
      setOrder(parsed);
    } catch {
      setError('Error consultando Cashea. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDownPayment = async () => {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      // The order must exist on our side first: the Vercel route confirms it by
      // order number as soon as Cashea captures.
      if (!(await ensureOrderSaved())) {
        setError('No pudimos registrar tu pedido. Intenta de nuevo.');
        return;
      }

      const amount = order.downPayment ?? order.total ?? totalUsd;
      const res = await fetch(
        `/api/cashea?action=confirm-payment&idNumber=${encodeURIComponent(idNumber.trim())}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, orderNumber }),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(
          (data as any)?.error ??
            'Cashea no pudo procesar la inicial. Verifica tu cupo e intenta de nuevo.',
        );
        return;
      }
      onConfirmed((data as any)?.id ?? order.id);
    } catch {
      setError('Error confirmando el pago con Cashea. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  if (configured === false) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex items-start gap-3">
        <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-amber-800">
          Cashea no esta disponible en este momento. Elige otro metodo de pago.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div dangerouslySetInnerHTML={{ __html: CASHEA_LOGO }} />
          <h3 className="font-black text-slate-800 text-xl">Paga con Cashea</h3>
        </div>
        <p className="text-sm text-slate-500 font-semibold leading-relaxed">
          Crea tu orden en la app de Cashea seleccionando <strong>Indigo Store</strong>, luego
          buscala aqui con tu cedula para confirmar la inicial.
        </p>
        <p className="text-xs text-slate-400 font-semibold">
          Monto de tu pedido: <strong>${totalUsd.toFixed(2)} USD</strong>
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Tu cedula"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
            className="flex-1 border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-[#373435]"
          />
          <button
            type="button"
            onClick={lookupOrder}
            disabled={busy}
            className="bg-[#373435] text-[#FFF212] px-5 rounded-2xl font-black text-sm tracking-wide disabled:opacity-60 flex items-center gap-2"
          >
            <Search size={16} />
            BUSCAR
          </button>
        </div>
      </div>

      {order && (
        <div className="bg-[#FFF212]/20 border-2 border-[#FFF212] rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-[#373435]" />
            <span className="font-black text-slate-800">Orden de Cashea encontrada</span>
          </div>
          <dl className="text-sm font-semibold text-slate-600 space-y-1">
            <div className="flex justify-between">
              <dt>Referencia</dt>
              <dd className="font-black text-slate-800">{order.id}</dd>
            </div>
            {order.total !== null && (
              <div className="flex justify-between">
                <dt>Total en Cashea</dt>
                <dd className="font-black text-slate-800">${order.total.toFixed(2)}</dd>
              </div>
            )}
            {order.instalments !== null && (
              <div className="flex justify-between">
                <dt>Cuotas</dt>
                <dd className="font-black text-slate-800">{order.instalments}</dd>
              </div>
            )}
            {order.downPayment !== null && (
              <div className="flex justify-between">
                <dt>Inicial a pagar ahora</dt>
                <dd className="font-black text-slate-800">${order.downPayment.toFixed(2)}</dd>
              </div>
            )}
          </dl>

          {order.total !== null && Math.abs(order.total - totalUsd) > 0.5 && (
            <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              El monto de tu orden en Cashea (${order.total.toFixed(2)}) no coincide con el de tu
              carrito (${totalUsd.toFixed(2)}). Verifica antes de continuar.
            </p>
          )}

          <button
            type="button"
            onClick={confirmDownPayment}
            disabled={busy}
            className="w-full bg-[#373435] text-[#FFF212] py-4 rounded-full font-black tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {busy ? 'PROCESANDO...' : 'CONFIRMAR INICIAL'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
