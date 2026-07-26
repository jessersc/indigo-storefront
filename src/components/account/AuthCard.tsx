import React from 'react';
import Link from 'next/link';

/** Shared kawaii-styled card + field styles for the account/auth pages. */

export const authInputClass =
  'w-full p-3 rounded-2xl border-2 border-[#ffd2e9] focus:border-kawaii-pink outline-none font-bold text-slate-700 text-sm bg-white transition-colors';

export const authButtonClass =
  'w-full bg-kawaii-pink text-white py-3 rounded-full font-black text-sm tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(255,107,157,0.3)]';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <Link href="/" className="text-3xl font-black tracking-tighter text-kawaii-pink">
          INDIGO STORE
        </Link>
      </div>
      <div className="bg-white rounded-3xl border border-[#ffe0ef] shadow-[0_10px_30px_rgba(255,107,157,0.12)] p-8 space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-black text-slate-800">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 font-semibold">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="text-center mt-6 text-sm text-slate-500 font-semibold">{footer}</div>}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-600 font-bold text-sm text-center">
      {message}
    </div>
  );
}
