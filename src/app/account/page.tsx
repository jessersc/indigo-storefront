'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { getMyRefunds, createRefund, type RefundRequest } from '../../lib/account-api';

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  total_usd: number;
  total_bs: number;
  created_at: string;
  item_count: number;
}

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', processing: 'En proceso', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};
const REFUND_STATUS_LABEL: Record<string, string> = {
  requested: 'Solicitado', approved: 'Aprobado', rejected: 'Rechazado', completed: 'Completado',
};
const KIND_LABEL: Record<string, string> = { refund: 'Reembolso', replacement: 'Reemplazo' };

export default function AccountPage() {
  const router = useRouter();
  const { user, token, loading, logout } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);

  // Refund request modal
  const [modalOrder, setModalOrder] = useState<string | null>(null);
  const [kind, setKind] = useState<'refund' | 'replacement'>('refund');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/account/login');
  }, [loading, user, router]);

  const loadRefunds = useCallback(() => {
    if (token) getMyRefunds(token).then(setRefunds).catch(() => setRefunds([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/account/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
    loadRefunds();
  }, [token, loadRefunds]);

  const submitRefund = async () => {
    if (!token || !modalOrder) return;
    setSubmitting(true);
    setModalError('');
    try {
      await createRefund({ orderNumber: modalOrder, kind, reason }, token);
      setModalOrder(null);
      setReason('');
      loadRefunds();
    } catch (err: any) {
      setModalError(err.message || 'No se pudo enviar.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return <div className="py-24 text-center font-bold text-kawaii-pink">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-slate-800">Mi cuenta</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/account/settings"
            className="text-sm font-bold text-slate-500 hover:text-kawaii-pink border border-slate-200 hover:border-kawaii-pink rounded-full px-4 py-2 transition-colors"
          >
            Configuracion
          </Link>
          <button
            onClick={() => { logout(); router.push('/'); }}
            className="text-sm font-bold text-slate-500 hover:text-kawaii-pink border border-slate-200 hover:border-kawaii-pink rounded-full px-4 py-2 transition-colors"
          >
            Cerrar sesion
          </button>
        </div>
      </div>

      <section className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-700">Perfil</h2>
          <Link href="/account/settings" className="text-xs font-black text-kawaii-pink hover:underline">
            Editar
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field label="Nombre" value={user.name || '-'} />
          <Field label="Correo" value={user.email} />
          <Field label="Telefono" value={user.phone || '-'} />
          <Field label="Cedula" value={user.cedula || '-'} />
        </div>
        {user.email_verified === 0 && (
          <p className="text-amber-600 text-xs font-bold">Tu correo aun no esta verificado.</p>
        )}
      </section>

      <section className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-4">
        <h2 className="font-black text-slate-700">Mis pedidos</h2>
        {ordersLoading ? (
          <p className="text-sm text-slate-400 font-bold">Cargando pedidos...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-400 font-bold">
            Aun no tienes pedidos. <Link href="/" className="text-kawaii-pink">Ir a la tienda</Link>
          </p>
        ) : (
          <div className="divide-y divide-[#ffe0ef]">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  {/* The number opens the full order: items, delivery, courier,
                      tracking, and the payment details when it is still owed. */}
                  <Link
                    href={`/account/orders/${encodeURIComponent(o.order_number)}`}
                    className="font-black text-slate-800 text-sm hover:text-kawaii-pink transition-colors"
                  >
                    {o.order_number}
                  </Link>
                  <p className="text-xs text-slate-400 font-bold">
                    {o.item_count} art. - {o.payment_method} - {new Date(o.created_at).toLocaleDateString('es-VE')}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <Link
                      href={`/account/orders/${encodeURIComponent(o.order_number)}`}
                      className="text-[11px] text-kawaii-pink font-bold hover:underline"
                    >
                      Ver detalle
                    </Link>
                    <button
                      onClick={() => { setModalOrder(o.order_number); setKind('refund'); setReason(''); setModalError(''); }}
                      className="text-[11px] text-kawaii-pink font-bold hover:underline"
                    >
                      Solicitar reembolso o reemplazo
                    </button>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-kawaii-pink text-sm">${o.total_usd.toFixed(2)}</p>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {refunds.length > 0 && (
        <section className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-4">
          <h2 className="font-black text-slate-700">Mis solicitudes</h2>
          <div className="divide-y divide-[#ffe0ef]">
            {refunds.map((r) => (
              <div key={r.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="font-black text-slate-800 text-sm">{r.order_number} - {KIND_LABEL[r.kind]}</p>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {REFUND_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                {r.admin_note && <p className="text-xs text-slate-400 font-semibold mt-1">Nota: {r.admin_note}</p>}

                {/* Every step, not just where it ended up: a request that was
                    rejected and then approved otherwise looks the same as one
                    approved first time. */}
                {r.events?.length > 1 && (
                  <ol className="mt-2 space-y-1">
                    {r.events.map((e, i) => (
                      <li key={i} className="flex gap-2 text-[11px]">
                        <span className="w-1 h-1 rounded-full bg-kawaii-pink mt-1.5 shrink-0" />
                        <span className="font-semibold text-slate-400">
                          {REFUND_STATUS_LABEL[e.to_status] ?? e.to_status}
                          {' · '}
                          {new Date(e.created_at).toLocaleDateString('es-VE')}
                          {e.note && ` — ${e.note}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Refund request modal */}
      {modalOrder && (
        <div className="fixed inset-0 z-[1200] bg-black/40 flex items-center justify-center p-4" onClick={() => setModalOrder(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-slate-800 text-lg">Solicitud para {modalOrder}</h3>
            {modalError && <p className="text-red-500 text-sm font-bold">{modalError}</p>}
            <div className="flex gap-3">
              {(['refund', 'replacement'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`flex-1 py-2.5 rounded-2xl border-2 font-black text-sm transition-all ${kind === k ? 'border-kawaii-pink bg-[#fff6fa] text-kawaii-pink' : 'border-slate-100 text-slate-500'}`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Motivo (opcional)"
              rows={3}
              className="w-full p-3 rounded-2xl border-2 border-[#ffd2e9] focus:border-kawaii-pink outline-none font-medium text-slate-700 text-sm resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setModalOrder(null)} className="flex-1 py-3 rounded-full border-2 border-slate-200 text-slate-500 font-bold text-sm">
                Cancelar
              </button>
              <button onClick={submitRefund} disabled={submitting} className="flex-1 py-3 rounded-full bg-kawaii-pink text-white font-black text-sm tracking-widest disabled:opacity-60">
                {submitting ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
      <p className="font-bold text-slate-700">{value}</p>
    </div>
  );
}
