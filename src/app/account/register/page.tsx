'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '../../../lib/auth-api';
import { errorMessage } from '../../../lib/api-error';
import { AuthCard, AuthError, authInputClass, authButtonClass } from '../../../components/account/AuthCard';
import { useAuth } from '../../../context/AuthContext';
import GoogleSignInButton from '../../../components/account/GoogleSignInButton';
import FacebookSignInButton from '../../../components/account/FacebookSignInButton';
import Turnstile, { turnstileEnabled } from '../../../components/Turnstile';

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres.');
      return;
    }
    // Only blocks when Turnstile is actually configured; otherwise the widget
    // never renders and there is no token to wait for.
    if (turnstileEnabled() && !turnstileToken) {
      setError('Completa la verificacion de seguridad.');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({ ...form, turnstileToken });
      router.push(`/account/verify?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      setError(errorMessage(err, 'No se pudo crear la cuenta.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle="Unete a Indigo y sigue tus pedidos"
      footer={
        <>
          Ya tienes cuenta?{' '}
          <Link href="/account/login" className="text-kawaii-pink font-black">Iniciar sesion</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthError message={error} />
        <input type="text" required placeholder="Nombre" className={authInputClass}
          value={form.name} onChange={update('name')} />
        <input type="email" required placeholder="Correo" className={authInputClass}
          value={form.email} onChange={update('email')} />
        <input type="tel" placeholder="Telefono (opcional)" className={authInputClass}
          value={form.phone} onChange={update('phone')} />
        <input type="password" required placeholder="Contrasena (8+ caracteres)" className={authInputClass}
          value={form.password} onChange={update('password')} />
        <Turnstile onToken={setTurnstileToken} />
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Creando...' : 'Crear cuenta'}
        </button>
      </form>
      <GoogleSignInButton onSession={(r) => { setSession(r); router.push('/account'); }} />
      <FacebookSignInButton onSession={(r) => { setSession(r); router.push('/account'); }} />
    </AuthCard>
  );
}
