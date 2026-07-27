'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { authApi } from '../../../lib/auth-api';
import { errorMessage } from '../../../lib/api-error';
import { safeNextPath } from '../../../lib/next-path';
import { AuthCard, AuthError, authInputClass, authButtonClass } from '../../../components/account/AuthCard';
import GoogleSignInButton from '../../../components/account/GoogleSignInButton';
import FacebookSignInButton from '../../../components/account/FacebookSignInButton';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sanitised: an unchecked `next` on a login page is an open redirect, and a
  // phishing link that bounces off our own domain is worth more than one that
  // does not.
  const next = safeNextPath(searchParams.get('next'));
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.login({ email, password });
      setSession(result);
      router.push(next);
    } catch (err: any) {
      if (err.needsVerification) {
        router.push(
          `/account/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
        );
        return;
      }
      setError(errorMessage(err, 'No se pudo iniciar sesion.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Iniciar sesion"
      subtitle="Accede a tu cuenta de Indigo"
      footer={
        <>
          Nueva aqui?{' '}
          <Link
            href={`/account/register?next=${encodeURIComponent(next)}`}
            className="text-kawaii-pink font-black"
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthError message={error} />
        <input type="email" required placeholder="Correo" className={authInputClass}
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="Contrasena" className={authInputClass}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="text-right">
          <Link href="/account/recover" className="text-xs text-kawaii-pink font-bold">Olvidaste tu contrasena?</Link>
        </div>
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <GoogleSignInButton onSession={(r) => { setSession(r); router.push(next); }} />
      <FacebookSignInButton onSession={(r) => { setSession(r); router.push(next); }} />
    </AuthCard>
  );
}

// See the note on RegisterPage: useSearchParams() needs a Suspense boundary or
// the route cannot be prerendered and the build fails.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center font-bold text-kawaii-pink">Cargando...</div>}>
      <LoginContent />
    </Suspense>
  );
}
