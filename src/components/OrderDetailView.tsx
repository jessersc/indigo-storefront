'use client';

import React, { useState } from 'react';
import { AlertCircle, Check, Copy, MessageCircle, Package, Truck, XCircle } from 'lucide-react';
import {
  cancelOrder,
  requestOrderChange,
  type OrderDetail,
  type OrderCredentials,
} from '../lib/order-api';
import { getOptimizedImage } from '../lib/image';

/**
 * One order, in full — the same component for a signed-in customer and for a
 * guest who found it through the lookup. Only the credentials differ.
 *
 * Replaces a single line showing a total and a status word. Someone who needed
 * the delivery address, the courier, or the bank details to finish paying had
 * nowhere to look and wrote to support instead.
 */

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente de pago',
  processing: 'En preparacion',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  shipped: 'bg-violet-50 text-violet-700 border-violet-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', completed: 'Pagado', failed: 'Fallido', cancelled: 'Cancelado',
};

const REQUEST_KIND: Record<string, string> = { refund: 'Reembolso', replacement: 'Reemplazo' };
const REQUEST_STATUS: Record<string, string> = {
  requested: 'Solicitado', approved: 'Aprobado', rejected: 'Rechazado', completed: 'Completado',
};

const DELIVERY_LABEL: Record<string, string> = {
  'pickup-store': 'Retiro en tienda',
  'delivery-home': 'Entrega a domicilio',
  'delivery-national': 'Envio nacional',
};

interface OrderDetailViewProps {
  order: OrderDetail;
  credentials: OrderCredentials;
  /** Re-fetch after a change. */
  onRefresh: () => void;
  /** WhatsApp contact, from store config. */
  whatsappUrl?: string;
}

export default function OrderDetailView({
  order,
  credentials,
  onRefresh,
  whatsappUrl,
}: OrderDetailViewProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeText, setChangeText] = useState('');
  const [changeSent, setChangeSent] = useState(false);
  const [copied, setCopied] = useState('');

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const doCancel = async () => {
    setBusy(true);
    setError('');
    const result = await cancelOrder(order.orderNumber, credentials);
    setBusy(false);
    setConfirmCancel(false);
    if (!result.ok) {
      setError(result.message ?? 'No pudimos cancelar el pedido.');
      return;
    }
    onRefresh();
  };

  const sendChange = async () => {
    if (!changeText.trim()) return;
    setBusy(true);
    setError('');
    const result = await requestOrderChange(order.orderNumber, changeText.trim(), credentials);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? 'No pudimos enviar tu solicitud.');
      return;
    }
    setChangeSent(true);
    setChangeText('');
    setChangeOpen(false);
  };

  const placed = new Date(order.placedAt).toLocaleDateString('es-VE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Pedido</p>
            <h2 className="text-2xl font-black text-slate-800">{order.orderNumber}</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Realizado el {placed}</p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${
              STATUS_CLASS[order.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3 pt-3 border-t border-[#ffe0ef]">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Total</p>
            <p className="text-xl font-black text-kawaii-pink">${order.totals.usd.toFixed(2)}</p>
            <p className="text-xs font-bold text-slate-400">
              Bs {order.totals.bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {order.discountCode && (
            <span className="text-[11px] font-black text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              Cupon {order.discountCode}
            </span>
          )}
        </div>
      </div>

      {/* Still owes money — the details needed to finish, in the order itself. */}
      {order.payment.awaitingPayment && order.status !== 'cancelled' && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 space-y-3">
          <h3 className="font-black text-amber-900 flex items-center gap-2">
            <AlertCircle size={18} /> Falta completar el pago
          </h3>
          <p className="text-sm font-semibold text-amber-800 leading-relaxed">
            Tu pedido esta reservado a la espera del pago. Envia{' '}
            <strong>${order.totals.usd.toFixed(2)} USD</strong> con los datos de abajo y
            escribenos el comprobante.
          </p>

          {order.payment.instructions && order.payment.instructions.kind !== 'gateway' && (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 space-y-2">
              {Object.entries(order.payment.instructions)
                .filter(([k, v]) => k !== 'kind' && v)
                .map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 shrink-0">
                      {INSTRUCTION_LABEL[k] ?? k}
                    </span>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-slate-700 text-sm text-right break-all">{v}</span>
                      <button
                        type="button"
                        onClick={() => copy(String(v), k)}
                        className="p-1 rounded hover:bg-slate-100 shrink-0"
                        title="Copiar"
                      >
                        {copied === k
                          ? <Check size={13} className="text-green-500" />
                          : <Copy size={13} className="text-slate-400" />}
                      </button>
                    </span>
                  </div>
                ))}
            </div>
          )}

          {order.payment.instructions?.kind === 'gateway' && (
            <p className="text-sm font-semibold text-amber-800">
              Este pedido se paga en linea. Escribenos y te reenviamos el enlace de pago.
            </p>
          )}

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest"
            >
              <MessageCircle size={14} /> Enviar comprobante
            </a>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-3">
        <h3 className="font-black text-slate-700 flex items-center gap-2">
          <Package size={18} className="text-kawaii-pink" /> Productos
        </h3>
        <div className="divide-y divide-[#ffe0ef]">
          {order.items.map((item, i) => (
            <div key={`${item.productId}-${i}`} className="flex items-start justify-between gap-3 py-3">
              <div className="flex items-start gap-3 min-w-0">
                <img
                  src={getOptimizedImage(item.image, 400)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-12 rounded-xl object-cover border border-[#ffe0ef] bg-white shrink-0"
                />
                <div className="min-w-0">
                <p className="font-bold text-slate-700 text-sm">{item.name ?? 'Producto'}</p>
                {item.variantId && (
                  <p className="text-xs font-semibold text-slate-400">Modelo: {item.variantId}</p>
                )}
                <p className="text-xs font-bold text-slate-400">Cantidad: {item.quantity}</p>
                </div>
              </div>
              <p className="font-black text-slate-700 text-sm shrink-0">
                ${(item.priceUsd * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery */}
      <div className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-3">
        <h3 className="font-black text-slate-700 flex items-center gap-2">
          <Truck size={18} className="text-kawaii-pink" /> Entrega
        </h3>
        <Row label="Metodo" value={DELIVERY_LABEL[order.delivery.method] ?? order.delivery.method} />
        {order.delivery.address && <Row label="Direccion" value={order.delivery.address} />}
        {order.delivery.courierName && (
          <Row
            label="Courier"
            value={[order.delivery.courierName, order.delivery.courierOffice, order.delivery.courierState]
              .filter(Boolean)
              .join(' - ')}
          />
        )}
        {order.delivery.trackingNumber && (
          <Row label="Guia de seguimiento" value={order.delivery.trackingNumber} />
        )}
        {order.delivery.instructions && <Row label="Notas" value={order.delivery.instructions} />}
        <Row label="Pago" value={`${order.payment.method} - ${PAYMENT_STATUS_LABEL[order.payment.status] ?? order.payment.status}`} />
      </div>

      {/*
        Refund / replacement requests, each with its full history.

        The status alone is not the story: a request that was rejected and then
        approved reads identically to one approved first time, and the customer
        received an email at each step. Showing the timeline means what they
        were told and what the page says cannot disagree.
      */}
      {order.requests.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-4">
          <h3 className="font-black text-slate-700">Solicitudes</h3>
          {order.requests.map((r) => (
            <div key={r.id} className="border-b border-[#ffe0ef] last:border-0 pb-4 last:pb-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-700 text-sm">{REQUEST_KIND[r.kind] ?? r.kind}</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {REQUEST_STATUS[r.status] ?? r.status}
                </span>
              </div>
              {r.reason && <p className="text-xs font-semibold text-slate-400">{r.reason}</p>}
              {r.admin_note && (
                <p className="text-xs font-semibold text-slate-600">Respuesta: {r.admin_note}</p>
              )}

              {r.events?.length > 0 && (
                <ol className="space-y-2 pt-1">
                  {r.events.map((e, i) => (
                    <li key={i} className="flex gap-2.5 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-kawaii-pink mt-1.5 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-600">
                          {e.from_status
                            ? `${REQUEST_STATUS[e.to_status] ?? e.to_status}`
                            : 'Solicitud enviada'}
                          {e.by_customer && ' (por ti)'}
                        </p>
                        <p className="font-semibold text-slate-400">
                          {new Date(e.created_at).toLocaleDateString('es-VE', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                        {e.note && <p className="font-semibold text-slate-500 italic mt-0.5">“{e.note}”</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-4">
        <h3 className="font-black text-slate-700">Necesitas algo mas?</h3>

        {changeSent && (
          <p className="text-sm font-bold text-green-600 flex items-center gap-1.5">
            <Check size={15} /> Recibimos tu solicitud. Te escribimos pronto.
          </p>
        )}

        {/*
          A placed order is never edited from here. The address it ships to and
          the amount charged have to stay what was agreed, so this opens a
          request a human actions instead.
        */}
        {!changeOpen ? (
          <button
            type="button"
            onClick={() => setChangeOpen(true)}
            className="w-full border-2 border-slate-200 text-slate-600 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:border-kawaii-pink hover:text-kawaii-pink transition-colors"
          >
            Solicitar un cambio en el pedido
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              rows={3}
              placeholder="Que necesitas cambiar? Por ejemplo la direccion o el telefono."
              value={changeText}
              onChange={(e) => setChangeText(e.target.value)}
              className="w-full p-3 rounded-2xl border-2 border-[#ffd2e9] focus:border-kawaii-pink outline-none font-medium text-slate-700 text-sm resize-none"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setChangeOpen(false); setChangeText(''); }}
                className="flex-1 py-3 rounded-full border-2 border-slate-200 text-slate-500 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendChange}
                disabled={busy || !changeText.trim()}
                className="flex-1 py-3 rounded-full bg-kawaii-pink text-white font-black text-sm tracking-widest disabled:opacity-60"
              >
                {busy ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 border-2 border-[#25D366] text-[#25D366] py-3 rounded-full font-black text-xs uppercase tracking-widest hover:bg-[#25D366]/5 transition-colors"
          >
            <MessageCircle size={14} /> Escribenos por WhatsApp
          </a>
        )}

        {order.canCancel && (
          <>
            {!confirmCancel ? (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="w-full border-2 border-red-200 text-red-500 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle size={14} /> Cancelar pedido
              </button>
            ) : (
              /* Asked plainly, because it cannot be undone from here — getting
                 the order back means placing it again at whatever the prices
                 and stock are then. */
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-black text-red-700">Seguro que quieres cancelar este pedido?</p>
                <p className="text-xs font-semibold text-red-600">
                  Esta accion no se puede deshacer. Los productos vuelven a estar disponibles
                  para otros clientes, asi que si cambias de opinion tendras que hacer el
                  pedido de nuevo.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="flex-1 py-2.5 rounded-full border-2 border-slate-200 bg-white text-slate-600 font-bold text-xs uppercase tracking-widest"
                  >
                    No, volver
                  </button>
                  <button
                    type="button"
                    onClick={doCancel}
                    disabled={busy}
                    className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60"
                  >
                    {busy ? 'Cancelando...' : 'Si, cancelar'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const INSTRUCTION_LABEL: Record<string, string> = {
  email: 'Correo',
  holder: 'Titular',
  id: 'ID',
  bank: 'Banco',
  beneficiary: 'Beneficiario',
  routing: 'Routing (ABA)',
  account: 'Numero de cuenta',
  accountType: 'Tipo de cuenta',
  address: 'Direccion',
  chainId: 'Red',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="font-bold text-slate-700 text-sm text-right">{value}</span>
    </div>
  );
}
