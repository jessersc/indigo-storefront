'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '../../../lib/auth-api';
import { errorMessage } from '../../../lib/api-error';
import { AuthCard, AuthError, authInputClass, authButtonClass } from '../../../components/account/AuthCard';
import Turnstile, { turnstileEnabled } from '../../../components/Turnstile';

type Stage = 'request' | 'reset';

export default function RecoverPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (turnstileEnabled() && !turnstileToken) {
      setError('Completa la verificacion de seguridad.');
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email, turnstileToken);
      setStage('reset');
    } catch (err: any) {
      setError(errorMessage(err, 'No se pudo enviar el codigo.'));
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, code, password });
      router.push('/account/login');
    } catch (err: any) {
      setError(errorMessage(err, 'No se pudo restablecer.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Recuperar contrasena"
      subtitle={stage === 'request' ? 'Te enviaremos un codigo por correo' : 'Ingresa el codigo y tu nueva contrasena'}
      footer={<Link href="/account/login" className="text-kawaii-pink font-black">Volver a iniciar sesion</Link>}
    >
      {stage === 'request' ? (
        <form onSubmit={requestCode} className="space-y-4">
          <AuthError message={error} />
          <input type="email" required placeholder="Correo" className={authInputClass}
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <Turnstile onToken={setTurnstileToken} />
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? 'Enviando...' : 'Enviar codigo'}
          </button>
        </form>
      ) : (
        <form onSubmit={doReset} className="space-y-4">
          <AuthError message={error} />
          <input type="text" inputMode="numeric" maxLength={6} required placeholder="Codigo de 6 digitos"
            className={`${authInputClass} text-center tracking-[0.4em]`}
            value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} />
          <input type="password" required placeholder="Nueva contrasena (8+ caracteres)" className={authInputClass}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? 'Guardando...' : 'Restablecer contrasena'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
