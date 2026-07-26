'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { authApi } from '../../../lib/auth-api';
import { AuthCard, AuthError, authInputClass, authButtonClass } from '../../../components/account/AuthCard';
import GoogleSignInButton from '../../../components/account/GoogleSignInButton';
import FacebookSignInButton from '../../../components/account/FacebookSignInButton';

export default function LoginPage() {
  const router = useRouter();
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
      router.push('/account');
    } catch (err: any) {
      if (err.needsVerification) {
        router.push(`/account/verify?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(err.message || 'No se pudo iniciar sesion.');
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
          <Link href="/account/register" className="text-kawaii-pink font-black">Crear cuenta</Link>
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
      <GoogleSignInButton onSession={(r) => { setSession(r); router.push('/account'); }} />
      <FacebookSignInButton onSession={(r) => { setSession(r); router.push('/account'); }} />
    </AuthCard>
  );
}
