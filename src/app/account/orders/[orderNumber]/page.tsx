'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { useStorefront } from '../../../../context/StorefrontContext';
import OrderDetailView from '../../../../components/OrderDetailView';
import { getOrderDetail, readOrderToken, type OrderDetail } from '../../../../lib/order-api';

/**
 * One order in full.
 *
 * Reachable two ways, which is why it does not simply require a session: a
 * signed-in customer arrives from "Mis pedidos", and a guest arrives from the
 * lookup page holding an order-scoped token. The Worker enforces both; this
 * page just presents whichever credential it has.
 */
export default function OrderDetailPage() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = decodeURIComponent(String(params?.orderNumber ?? ''));
  const { token, loading: authLoading } = useAuth();
  const { config } = useStorefront();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!orderNumber) return;
    setLoading(true);
    const orderToken = readOrderToken(orderNumber);
    const detail = await getOrderDetail(orderNumber, { token, orderToken });
    setOrder(detail);
    setNotFound(detail === null);
    setLoading(false);
  }, [orderNumber, token]);

  useEffect(() => {
    // Wait for the session to resolve, or a signed-in customer would be treated
    // as a guest on first paint and see "not found" before the token arrives.
    if (!authLoading) void load();
  }, [authLoading, load]);

  if (loading || authLoading) {
    return <div className="py-24 text-center font-bold text-kawaii-pink">Cargando pedido...</div>;
  }

  if (notFound || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black text-slate-800">No encontramos ese pedido</h1>
        <p className="text-sm font-semibold text-slate-500">
          Puede que hayas cerrado sesion, o que el enlace haya vencido. Si compraste
          como invitado, busca tu pedido con tus datos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/pedido"
            className="bg-kawaii-pink text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest"
          >
            Buscar mi pedido
          </Link>
          <Link
            href="/account"
            className="border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest"
          >
            Ir a mi cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <Link
        href={token ? '/account' : '/pedido'}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-kawaii-pink font-bold transition-colors"
      >
        <ArrowLeft size={18} /> {token ? 'Mis pedidos' : 'Buscar otro pedido'}
      </Link>

      <OrderDetailView
        order={order}
        credentials={{ token, orderToken: readOrderToken(orderNumber) }}
        onRefresh={load}
        whatsappUrl={config.social_whatsapp_url || undefined}
      />
    </div>
  );
}
