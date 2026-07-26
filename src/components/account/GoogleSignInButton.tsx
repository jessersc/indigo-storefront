'use client';

import React, { useEffect, useRef, useState } from 'react';
import { authApi, type AuthResult } from '../../lib/auth-api';

/**
 * Google Sign-In via Google Identity Services. Renders nothing unless
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, so it stays hidden until Google is
 * configured. On success it exchanges the Google ID token for our session JWT.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleSignInButton({ onSession }: { onSession: (r: AuthResult) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;

    const handleCredential = async (response: { credential: string }) => {
      try {
        const result = await authApi.googleLogin(response.credential);
        onSession(result);
      } catch (err: any) {
        setError(err.message || 'Error con Google.');
      }
    };

    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
      });
    };

    if (window.google) {
      init();
    } else {
      const existing = document.getElementById('gsi-script');
      if (existing) {
        existing.addEventListener('load', init);
      } else {
        const script = document.createElement('script');
        script.id = 'gsi-script';
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        script.onload = init;
        document.head.appendChild(script);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-slate-400 font-bold uppercase tracking-widest">
        <div className="flex-1 h-px bg-slate-200" /> o <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div ref={ref} className="flex justify-center" />
      {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
    </div>
  );
}
