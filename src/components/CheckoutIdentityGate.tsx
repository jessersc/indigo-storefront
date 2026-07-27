'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, LogIn, Mail, UserPlus } from 'lucide-react';
import { authApi } from '../lib/auth-api';
import { validateEmail } from '../lib/validation';
import Turnstile, { turnstileEnabled } from './Turnstile';

/**
 * The first thing a checkout asks: sign in, or continue as a guest?
 *
 * Guests then have to confirm their email with a one-time code. That is not
 * ceremony — for a guest the order is the ONLY record they have, and every
 * message about it (payment confirmed, shipped, tracking) goes to that address.
 * A typo meant they never heard from us again, with no account to fall back on
 * and no way for support to reach them.
 *
 * Nothing here creates an account. The token this produces proves control of an
 * address for about an hour; it is not a login and the Worker will not accept
 * it as one.
 */

type Stage = 'choose' | 'code';

interface CheckoutIdentityGateProps {
  /** Prefilled when we already know it (e.g. returning to checkout). */
  initialEmail?: string;
  /** Hands back the verified address and its token. */
  onVerified: (email: string, guestToken: string) => void;
}

export default function CheckoutIdentityGate({
  initialEmail = '',
  onVerified,
}: CheckoutIdentityGateProps) {
  const [stage, setStage] = useState<Stage>('choose');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const requestCode = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (turnstileEnabled() && !turnstileToken) {
      setError('Estamos verificando que eres una persona. Espera un momento.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await authApi.requestGuestCode(email.trim().toLowerCase(), turnstileToken);
      setStage('code');
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos enviar el codigo. Intenta de nuevo.');
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
      const result = await authApi.verifyGuestCode({
        email: email.trim().toLowerCase(),
        code: trimmed,
      });
      onVerified(email.trim().toLowerCase(), result.guestToken);
    } catch (err: any) {
      setError(err?.message ?? 'El codigo no es valido o ya vencio.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    try {
      await authApi.requestGuestCode(email.trim().toLowerCase(), turnstileToken);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch {
      setError('No pudimos reenviar el codigo. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 py-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-800 bubble-font">Antes de continuar</h2>
        <p className="text-sm text-slate-500 font-semibold">
          Inicia sesion para tener tus pedidos siempre a mano, o continua como invitado.
        </p>
      </div>

      {stage === 'choose' && (
        <>
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <LogIn size={18} className="text-kawaii-pink" /> Ya tengo cuenta
            </h3>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              Tus pedidos, direcciones y favoritos quedan guardados, y puedes ver
              el estado de cualquier compra cuando quieras.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/account/login?next=${encodeURIComponent('/checkout')}`}
                className="flex-1 text-center bg-kawaii-pink text-white py-3.5 rounded-full font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform"
              >
                Iniciar sesion
              </Link>
              <Link
                href={`/account/register?next=${encodeURIComponent('/checkout')}`}
                className="flex-1 text-center border-2 border-kawaii-pink text-kawaii-pink py-3.5 rounded-full font-black text-xs uppercase tracking-widest hover:bg-[#fff6fa] transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus size={14} /> Crear cuenta
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-black uppercase tracking-widest">
            <div className="flex-1 h-px bg-slate-200" /> o <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <Mail size={18} className="text-kawaii-pink" /> Continuar como invitado
            </h3>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              Te enviaremos un codigo para confirmar tu correo. Ahi recibiras la
              confirmacion de pago y el seguimiento de tu envio.
            </p>

            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void requestCode(); }}
              className="w-full p-4 rounded-2xl border-2 border-slate-200 focus:border-kawaii-pink outline-none font-semibold text-slate-700"
            />

            {turnstileEnabled() && <Turnstile onToken={setTurnstileToken} />}

            <button
              type="button"
              onClick={requestCode}
              disabled={busy}
              className="w-full bg-kawaii-pink text-white py-4 rounded-full font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              {busy ? 'ENVIANDO...' : 'ENVIARME EL CODIGO'}
            </button>

            {/*
              Said plainly rather than buried. A guest's order reference lives
              only in this browser, so clearing site data really does lose the
              link to it — they would need to contact support with their details
              to find the order again.
            */}
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
              Como invitado guardamos la referencia de tu pedido solo en este
              navegador. Si borras los datos del navegador o cambias de
              dispositivo, la perderas — con una cuenta queda guardada para
              siempre.
            </p>
          </div>
        </>
      )}

      {stage === 'code' && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Mail size={18} className="text-kawaii-pink" /> Revisa tu correo
          </h3>
          <p className="text-sm text-slate-500 font-semibold leading-relaxed">
            Enviamos un codigo de 6 digitos a <strong className="text-slate-700">{email}</strong>.
            Vence en 15 minutos.
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
            className="w-full bg-kawaii-pink text-white py-4 rounded-full font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {busy ? 'VERIFICANDO...' : 'CONFIRMAR Y CONTINUAR'}
          </button>

          <div className="flex items-center justify-between text-xs font-bold">
            <button
              type="button"
              onClick={() => { setStage('choose'); setCode(''); setError(''); }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cambiar correo
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="text-kawaii-pink hover:text-kawaii-purple transition-colors disabled:opacity-60"
            >
              {resent ? 'Codigo reenviado ✓' : 'Reenviar codigo'}
            </button>
          </div>

          {resent && (
            <p className="text-xs text-green-600 font-bold flex items-center gap-1.5">
              <Check size={14} /> Te enviamos un codigo nuevo.
            </p>
          )}
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
