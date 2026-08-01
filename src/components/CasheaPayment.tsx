'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';

/**
 * Cashea (buy now, pay in instalments).
 *
 * Opens Cashea DIRECTLY, via their Web Checkout SDK, the way the legacy site
 * did. The button the SDK renders takes the customer straight into Cashea's
 * flow with the cart already loaded.
 *
 * The interim implementation asked the customer to go and build the order
 * themselves inside the Cashea app and then come back and find it by cedula.
 * That worked, but it is a different (and much worse) purchase: the customer
 * has to re-enter their own basket in another app.
 *
 * ── What is NOT trusted ─────────────────────────────────────────────────────
 *
 * The SDK's `checkout:success` event is a browser claim. It is used only as a
 * signal to go and ask our own server to check. `/api/cashea?action=verify`
 * re-reads the order from Cashea with the merchant key, checks the status
 * there, and only then confirms the order with the Worker over the internal
 * channel. Nothing a tampered client says can mark an order paid — the same
 * boundary every other gateway here respects.
 */

const CASHEA_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="32" height="32"><rect x="30" y="30" width="940" height="940" rx="220" ry="220" fill="#FFF212"/><circle cx="500" cy="520" r="320" fill="#373435"/><circle cx="500" cy="520" r="170" fill="#FFF212"/><rect x="665" y="420" width="300" height="200" fill="#FFF212"/><rect x="470" y="112" width="60" height="220" fill="#FFF212"/><rect x="640" y="440" width="40" height="40" fill="#FFF212"/></svg>`;

/** Cashea's published minimum for an instalment plan. */
const CASHEA_MINIMUM_USD = 25;

const SDK_SRC = 'https://unpkg.com/cashea-web-checkout-sdk@latest/dist/webcheckout-sdk.min.js';
const SDK_ID = 'cashea-web-checkout-sdk';

declare global {
  interface Window {
    WebCheckoutSDK?: new (opts: { apiKey: string }) => any;
  }
}

let sdkPromise: Promise<void> | null = null;

/** Load the SDK once, however many times this component mounts. */
function loadCasheaSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.WebCheckoutSDK) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    /*
      Any leftover tag is discarded rather than listened to. We only reach here
      when the global is missing and the cached promise was cleared -- i.e.
      after a failed load -- so the existing tag has ALREADY fired its terminal
      event. Attaching `load`/`error` to it waits for something that can never
      happen again, and the promise hangs forever: the button simply never
      appears, with no error to explain it.
    */
    document.getElementById(SDK_ID)?.remove();
    const script = document.createElement('script');
    script.id = SDK_ID;
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      sdkPromise = null;
      reject(new Error('cashea sdk failed'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export interface CasheaLineItem {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  quantity: number;
  priceUsd: number;
}

interface CasheaPaymentProps {
  orderNumber: string;
  totalUsd: number;
  /** The customer's cedula, already collected on the delivery form. */
  cedula: string;
  /** Lines to hand Cashea, so their basket matches ours. */
  items: CasheaLineItem[];
  /**
   * False while the bot challenge is still unsolved.
   *
   * The order save is rejected without a Turnstile token, so attempting it
   * early burns the attempt and shows the customer a failure that was only
   * ever a timing accident -- this component mounts the moment Cashea is
   * selected, which is usually before the widget has finished.
   */
  challengeReady: boolean;
  /** Persists the checkout before Cashea is opened. Idempotent. */
  ensureOrderSaved: () => Promise<boolean>;
  onConfirmed: (transactionId?: string) => void;
}

export default function CasheaPayment({
  orderNumber,
  totalUsd,
  cedula,
  items,
  challengeReady,
  ensureOrderSaved,
  onConfirmed,
}: CasheaPaymentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [buttonReady, setButtonReady] = useState(false);
  const mountedRef = useRef(true);

  /*
    Which checkout state we have already tried to register.

    This effect depends on callbacks the parent rebuilds on every render, so it
    re-runs constantly -- and a failed run used to set parent state, which
    re-rendered the parent, which re-ran the effect. That closed a loop that
    POSTed /orders without pause; the console showed `failed_challenge`
    repeating indefinitely. One attempt per distinct checkout, and a retry only
    when the customer asks for one.
  */
  const attemptRef = useRef('');
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * Ask our server whether Cashea really took the payment. Called from the
   * SDK's success event, which is never believed on its own.
   */
  const verifyWithServer = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/cashea?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, idNumber: cedula.replace(/\D/g, '') }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && (data as any)?.ok) {
        onConfirmed((data as any)?.transactionId);
        return;
      }
      setError(
        res.status === 402
          ? 'Cashea todavia no reporta el pago como completado. Si ya pagaste, espera un momento e intenta de nuevo.'
          : 'No pudimos confirmar tu pago con Cashea. Escribenos y lo revisamos enseguida.',
      );
    } catch {
      setError('No pudimos confirmar tu pago con Cashea. Revisa tu conexion e intenta de nuevo.');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [orderNumber, cedula, onConfirmed]);

  useEffect(() => {
    let cancelled = false;

    async function mountButton() {
      // Below the minimum Cashea will refuse the plan, so say so here rather
      // than sending the customer into a flow that cannot complete.
      if (totalUsd < CASHEA_MINIMUM_USD) {
        setConfigured(false);
        setError(`El minimo para pagar con Cashea es $${CASHEA_MINIMUM_USD} USD.`);
        return;
      }

      const idNumber = (cedula || '').replace(/\D/g, '');
      if (!idNumber) {
        setConfigured(false);
        setError('Necesitamos tu cedula en el formulario para poder usar Cashea.');
        return;
      }

      // Wait for the challenge rather than spending an attempt that cannot
      // succeed. The effect re-runs when it flips true.
      if (!challengeReady) return;

      // One registration per distinct checkout state -- see attemptRef above.
      const signature = `${orderNumber}|${idNumber}|${totalUsd}|${retryNonce}`;
      if (attemptRef.current === signature) return;
      attemptRef.current = signature;

      try {
        const cfgRes = await fetch('/api/cashea?action=config');
        const cfg = await cfgRes.json().catch(() => null);
        if (cancelled) return;

        if (!cfg?.configured || !cfg?.publicApiKey || !cfg?.externalClientId) {
          setConfigured(false);
          return;
        }
        setConfigured(true);

        // The draft has to exist before Cashea is opened: the verify call is
        // gated on owning an unpaid checkout with this cedula, and Cashea's
        // invoiceId is our order number.
        if (!(await ensureOrderSaved())) {
          setError('No pudimos registrar tu pedido. Intenta de nuevo.');
          return;
        }
        if (cancelled) return;
        // Past every gate: clear anything left over from an earlier attempt,
        // so a resolved problem stops being reported as a live one.
        setError('');

        await loadCasheaSdk();
        if (cancelled || !containerRef.current) return;

        const SDK = window.WebCheckoutSDK;
        if (!SDK) throw new Error('sdk missing');

        /*
          Payload shape ported from the legacy site
          (indigo/public/assets/main.js). Cashea rejects the order outright if
          a product is missing a name, sku, description or imageUrl, so each
          falls back rather than being sent empty — that was the source of most
          "invalid payload" failures on the old site.
        */
        const products = items
          .filter((i) => i.id && i.name && i.quantity > 0)
          .map((i) => ({
            id: String(i.id),
            name: String(i.name),
            sku: String(i.sku || i.id),
            description: String(i.description || i.name),
            imageUrl: String(i.imageUrl || ''),
            quantity: Number(i.quantity),
            price: Number(i.priceUsd),
            tax: 0,
            discount: 0,
          }));

        if (products.length === 0) {
          setError('No pudimos preparar tu carrito para Cashea.');
          return;
        }

        const payload = {
          identificationNumber: String(idNumber),
          externalClientId: String(cfg.externalClientId),
          deliveryMethod: 'IN_STORE',
          merchantName: 'Indigo Store',
          redirectUrl: `${window.location.origin}/checkout?cashea=1&order=${encodeURIComponent(orderNumber)}`,
          invoiceId: String(orderNumber),
          deliveryPrice: 0,
          orders: [{ store: cfg.store ?? { id: 21977, name: 'Web Indigo Store', enabled: true }, products }],
        };

        const sdk = new SDK({ apiKey: cfg.publicApiKey });

        // The SDK has shipped both `on` and `addEventListener` across versions.
        const listen = (event: string, handler: (payload: unknown) => void) => {
          if (typeof sdk.on === 'function') sdk.on(event, handler);
          else if (typeof sdk.addEventListener === 'function') sdk.addEventListener(event, handler);
        };

        listen('checkout:success', () => { void verifyWithServer(); });
        listen('checkout:error', () => {
          setError('Cashea no pudo procesar el pago. Verifica tu cupo e intenta de nuevo.');
        });

        containerRef.current.innerHTML = '';
        sdk.createCheckoutButton({ payload, container: containerRef.current });
        setButtonReady(true);

        // The SDK renders its own button; stretch it to the card width so it
        // does not sit at an odd intrinsic size on a phone.
        setTimeout(() => {
          containerRef.current
            ?.querySelectorAll<HTMLElement>('button, [role="button"]')
            .forEach((el) => {
              el.style.width = '100%';
              el.style.maxWidth = '100%';
              el.style.boxSizing = 'border-box';
            });
        }, 100);
      } catch {
        if (!cancelled) {
          setError(
            'No pudimos cargar Cashea. Revisa tu conexion y recarga la pagina, o elige otro metodo de pago.',
          );
        }
      }
    }

    void mountButton();
    return () => { cancelled = true; };
  }, [
    orderNumber, totalUsd, cedula, items, challengeReady, retryNonce,
    ensureOrderSaved, verifyWithServer,
  ]);

  if (configured === false && !error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex items-start gap-3">
        <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-amber-800">
          Cashea no esta disponible en este momento. Elige otro metodo de pago.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div dangerouslySetInnerHTML={{ __html: CASHEA_LOGO }} />
          <h3 className="font-black text-slate-800 text-xl">Paga con Cashea</h3>
        </div>
        <p className="text-sm text-slate-500 font-semibold leading-relaxed">
          Al continuar se abre Cashea con tu pedido ya cargado. Elige tu plan de
          cuotas y paga la inicial; al terminar volveras aqui y confirmamos tu
          orden automaticamente.
        </p>
        <p className="text-xs text-slate-400 font-semibold">
          Monto de tu pedido: <strong>${totalUsd.toFixed(2)} USD</strong>
        </p>

        <div ref={containerRef} className="w-full min-h-[52px]" />

        {!buttonReady && !error && (
          <div className="flex items-center justify-center gap-2 py-3 text-slate-400 font-bold text-sm">
            <div className="w-4 h-4 border-2 border-kawaii-pink border-t-transparent rounded-full animate-spin" />
            Cargando Cashea...
          </div>
        )}

        {busy && (
          <div className="flex items-center justify-center gap-2 py-2 text-kawaii-pink font-bold text-sm">
            <div className="w-4 h-4 border-2 border-kawaii-pink border-t-transparent rounded-full animate-spin" />
            Confirmando tu pago...
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
          {/*
            Retry is explicit. It used to be automatic -- the effect simply ran
            again -- which is what let a failure spin into an unbounded POST
            loop. A button also gives the challenge widget time to reissue a
            token, which is the usual reason the first attempt failed.
          */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { setError(''); setRetryNonce((n) => n + 1); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-black text-white"
            >
              Reintentar
            </button>
            {/* If Cashea itself is unreachable there is nothing the customer can
                do on this page, so give them a way to reach a human. */}
            <a
              href="https://wa.me/584128503608"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-black text-red-700 underline"
            >
              Escribenos por WhatsApp <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
