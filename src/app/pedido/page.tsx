'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Package, Search, UserPlus } from 'lucide-react';
import {
  requestOrderLookup,
  verifyOrderLookup,
  storeOrderToken,
} from '../../lib/order-api';
import { listGuestOrders, type GuestOrderRef } from '../../lib/guest-orders';
import { validateEmail } from '../../lib/validation';

/**
 * "Where is my order?" for someone without an account.
 *
 * This is the page the order emails had nowhere to point at: their call to
 * action assumed a signed-in customer and sent guests to an account page that
 * would only ask them to log in.
 *
 * Two routes in:
 *
 *   Orders this browser remembers  — listed straight away. They still open
 *                                    behind the same identity check; the local
 *                                    list is a convenience, never a credential.
 *   Anything else                  — answer the security questions on the
 *                                    order, then a code sent to the address on
 *                                    it. The questions are a filter so we do
 *                                    not email codes about strangers' orders;
 *                                    the code is the actual proof.
 */

type Stage = 'form' | 'code';

export default function OrderLookupPage() {
  const router = useRouter();
  const [remembered, setRemembered] = useState<GuestOrderRef[]>([]);
  const [stage, setStage] = useState<Stage>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    orderNumber: '',
    email: '',
    cedula: '',
    phone: '',
    destination: '',
  });
  const [code, setCode] = useState('');

  // localStorage is only readable in the browser, so this waits for mount.
  useEffect(() => setRemembered(listGuestOrders()), []);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitQuestions = async () => {
    if (!form.orderNumber.trim()) {
      setError('Escribe el numero de tu pedido.');
      return;
    }
    const emailError = validateEmail(form.email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await requestOrderLookup({
        orderNumber: form.orderNumber.trim().toUpperCase(),
        email: form.email.trim().toLowerCase(),
        cedula: form.cedula.trim(),
        phone: form.phone.trim(),
        destination: form.destination.trim() || undefined,
      });
      // Always advances. The server answers identically whether or not the
      // answers matched, so this page must not imply otherwise.
      setStage('code');
    } catch {
      setError('No pudimos procesar tu solicitud. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    const trimmed = code.trim();
    if (!/^\d{4,8}$/.test(trimmed)) {
      setError('Escribe el codigo que te enviamos por correo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const orderNumber = form.orderNumber.trim().toUpperCase();
      const result = await verifyOrderLookup({
        orderNumber,
        email: form.email.trim().toLowerCase(),
        code: trimmed,
      });
      storeOrderToken(orderNumber, result.orderToken);
      router.push(`/account/orders/${encodeURIComponent(orderNumber)}`);
    } catch {
      setError(
        'El codigo no es valido o vencio. Verifica tambien que los datos del pedido sean correctos.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-slate-800 bubble-font">Buscar mi pedido</h1>
        <p className="text-sm font-semibold text-slate-500">
          Consulta el estado de tu compra sin necesidad de tener cuenta.
        </p>
      </div>

      {remembered.length > 0 && stage === 'form' && (
        <section className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-3">
          <h2 className="font-black text-slate-700 flex items-center gap-2">
            <Package size={18} className="text-kawaii-pink" /> Pedidos de este navegador
          </h2>
          <div className="divide-y divide-[#ffe0ef]">
            {remembered.map((o) => (
              <button
                key={o.orderNumber}
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, orderNumber: o.orderNumber, email: o.email }))
                }
                className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-[#fff6fa] transition-colors rounded-xl px-2 -mx-2"
              >
                <div className="min-w-0">
                  <p className="font-black text-slate-800 text-sm">{o.orderNumber}</p>
                  <p className="text-xs font-bold text-slate-400">
                    {new Date(o.placedAt).toLocaleDateString('es-VE')}
                    {o.itemCount ? ` · ${o.itemCount} art.` : ''}
                  </p>
                </div>
                {typeof o.totalUsd === 'number' && (
                  <span className="font-black text-kawaii-pink text-sm shrink-0">
                    ${o.totalUsd.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">
            Guardados solo en este navegador. Tocar uno rellena el formulario; todavia
            confirmamos tu identidad por correo antes de mostrar el pedido.
          </p>
        </section>
      )}

      {stage === 'form' && (
        <section className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-4">
          <h2 className="font-black text-slate-700 flex items-center gap-2">
            <Search size={18} className="text-kawaii-pink" /> Datos del pedido
          </h2>
          <p className="text-sm font-semibold text-slate-500 leading-relaxed">
            Para proteger tu informacion necesitamos confirmar que el pedido es tuyo.
            Despues te enviaremos un codigo al correo con el que compraste.
          </p>

          <Input label="Numero de pedido" placeholder="LJU-12345678"
                 value={form.orderNumber} onChange={update('orderNumber')} />
          <Input label="Correo de la compra" type="email" placeholder="tu@correo.com"
                 value={form.email} onChange={update('email')} />
          <Input label="Cedula" placeholder="12345678"
                 value={form.cedula} onChange={update('cedula')} />
          <Input label="Telefono" placeholder="04121234567"
                 value={form.phone} onChange={update('phone')} />
          <Input
            label="Direccion u oficina de envio"
            placeholder="Solo si tu pedido tenia envio"
            value={form.destination}
            onChange={update('destination')}
          />

          <button
            type="button"
            onClick={submitQuestions}
            disabled={busy}
            className="w-full bg-kawaii-pink text-white py-4 rounded-full font-black text-xs uppercase tracking-widest disabled:opacity-60"
          >
            {busy ? 'BUSCANDO...' : 'CONTINUAR'}
          </button>
        </section>
      )}

      {stage === 'code' && (
        <section className="bg-white rounded-3xl border border-[#ffe0ef] p-6 space-y-4">
          <h2 className="font-black text-slate-700">Revisa tu correo</h2>
          {/*
            Worded carefully. The server replies the same way whether or not the
            answers matched, so promising "we sent you a code" would be a lie
            half the time -- and would also confirm that the order exists.
          */}
          <p className="text-sm font-semibold text-slate-500 leading-relaxed">
            Si los datos coinciden con un pedido, enviamos un codigo de 6 digitos a{' '}
            <strong className="text-slate-700">{form.email}</strong>. Vence en 15 minutos.
          </p>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') void submitCode(); }}
            className="w-full p-4 rounded-2xl border-2 border-slate-200 focus:border-kawaii-pink outline-none font-black text-center text-2xl tracking-[0.4em] text-slate-700"
          />

          <button
            type="button"
            onClick={submitCode}
            disabled={busy}
            className="w-full bg-kawaii-pink text-white py-4 rounded-full font-black text-xs uppercase tracking-widest disabled:opacity-60"
          >
            {busy ? 'VERIFICANDO...' : 'VER MI PEDIDO'}
          </button>

          <button
            type="button"
            onClick={() => { setStage('form'); setCode(''); setError(''); }}
            className="w-full text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Corregir mis datos
          </button>
        </section>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      <section className="bg-[#fff6fa] rounded-3xl border border-[#ffe0ef] p-6 space-y-3 text-center">
        <UserPlus size={22} className="text-kawaii-pink mx-auto" />
        <h2 className="font-black text-slate-700">Crea una cuenta y no vuelvas a buscar</h2>
        <p className="text-sm font-semibold text-slate-500 leading-relaxed">
          Con una cuenta tus pedidos quedan guardados para siempre, con su estado y
          seguimiento, sin tener que confirmar tus datos cada vez.
        </p>
        <Link
          href="/account/register"
          className="inline-block bg-kawaii-pink text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest"
        >
          Crear cuenta
        </Link>
      </section>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-black text-slate-600 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-3.5 rounded-2xl border-2 border-slate-200 focus:border-kawaii-pink outline-none font-semibold text-slate-700 text-sm"
      />
    </div>
  );
}
