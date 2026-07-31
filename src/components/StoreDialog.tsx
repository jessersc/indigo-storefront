'use client';

import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

/**
 * The store's own dialog, replacing window.alert().
 *
 * A native alert is a grey OS box with the domain name at the top — it looks
 * like a browser error, not like this shop, and on mobile it is a jarring
 * system takeover. Checkout was using it for ordinary validation ("the phone
 * needs a country code"), which made a small correctable mistake feel like
 * something had gone wrong.
 *
 * Deliberately not a toast: these messages stop the customer from continuing,
 * so they need acknowledging rather than fading away unread.
 */

export type DialogTone = 'error' | 'info';

interface StoreDialogProps {
  open: boolean;
  title?: string;
  message: string;
  tone?: DialogTone;
  confirmLabel?: string;
  onClose: () => void;
}

export default function StoreDialog({
  open,
  title,
  message,
  tone = 'error',
  confirmLabel = 'Entendido',
  onClose,
}: StoreDialogProps) {
  // Escape closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const accent = tone === 'error' ? 'text-red-500' : 'text-kawaii-pink';

  return (
    <div
      className="fixed inset-0 z-[1400] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-sm shadow-[0_20px_60px_rgba(255,107,157,0.25)] border-2 border-[#ffe0ef] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-6 pb-4">
          <div className={`shrink-0 w-11 h-11 rounded-full bg-[#fff6fa] border border-[#ffe0ef] flex items-center justify-center ${accent}`}>
            <AlertCircle size={22} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-black text-slate-800 text-lg leading-tight bubble-font">
              {title ?? (tone === 'error' ? 'Revisa este dato' : 'Un momento')}
            </h3>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed mt-1.5">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors -mt-1 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="w-full bg-kawaii-pink text-white py-3.5 rounded-full font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
