'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '../../../lib/auth-api';
import { errorMessage } from '../../../lib/api-error';
import { useAuth } from '../../../context/AuthContext';
import { safeNextPath } from '../../../lib/next-path';
import { AuthCard, AuthError, authInputClass, authButtonClass } from '../../../components/account/AuthCard';

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  // Last leg of the sign-in journey that started at the checkout.
  const next = safeNextPath(params.get('next'));
  const { setSession } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.verify({ email, code });
      setSession(result);
      router.push(next);
    } catch (err: any) {
      setError(errorMessage(err, 'Codigo invalido.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      await authApi.resendCode(email);
      setInfo('Codigo reenviado. Revisa tu correo.');
    } catch (err: any) {
      setError(errorMessage(err, 'No se pudo reenviar.'));
    }
  };

  return (
    <AuthCard title="Verifica tu correo" subtitle={`Enviamos un codigo de 6 digitos a ${email || 'tu correo'}`}>
      <form onSubmit={handleVerify} className="space-y-4">
        <AuthError message={error} />
        {info && <p className="text-green-600 text-sm font-bold text-center">{info}</p>}
        <input
          type="text" inputMode="numeric" maxLength={6} required placeholder="000000"
          className={`${authInputClass} text-center tracking-[0.5em] text-lg`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
        />
        <button type="submit" disabled={loading || code.length !== 6} className={authButtonClass}>
          {loading ? 'Verificando...' : 'Verificar'}
        </button>
      </form>
      <button onClick={handleResend} className="w-full text-center text-xs text-kawaii-pink font-bold mt-2">
        Reenviar codigo
      </button>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center font-bold text-kawaii-pink">Cargando...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
