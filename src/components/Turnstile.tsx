'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing at all when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so local
 * development and the test harnesses work without Cloudflare credentials. The
 * Worker mirrors this: with no secret configured it skips verification. Both
 * sides must be configured together for the check to be live.
 *
 * The token is single-use and expires (~5 min), so `onToken` fires again on
 * refresh and the parent should always send the latest value.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

export function turnstileEnabled(): boolean {
  return SITE_KEY.length > 0;
}

let scriptPromise: Promise<void> | null = null;

/** Load the Turnstile script once, however many widgets mount. */
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile script failed')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile script failed'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileProps {
  /** Receives the token, or '' when it expires or the check fails. */
  onToken: (token: string) => void;
  /** Cloudflare's theme for the widget. */
  theme?: 'light' | 'dark' | 'auto';
  /**
   * Hands the parent a function that discards the current token and asks
   * Cloudflare for a fresh one.
   *
   * A token is single-use: once the server has verified it, siteverify answers
   * `timeout-or-duplicate` for every later attempt. Turnstile does NOT refresh
   * itself after that happens -- it only fires `expired-callback` on its own
   * ~5 minute timer -- so without this the widget looks solved while holding a
   * spent token, and the NEXT submission is rejected. Checkout must call this
   * after each verified request.
   */
  registerReset?: (reset: () => void) => void;
}

export default function Turnstile({ onToken, theme = 'light', registerReset }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  // The callback is kept in a ref: Turnstile holds whatever function it was
  // given at render time, so a parent re-render would otherwise leave it
  // calling a stale closure.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  // Same reasoning as onTokenRef: the parent re-renders constantly during
  // checkout and must not re-register on every pass.
  const registerResetRef = useRef(registerReset);
  registerResetRef.current = registerReset;

  useEffect(() => {
    const reset = () => {
      // Drop the spent token first, so a submission racing the refresh sends
      // nothing rather than a duplicate -- a missing token is a clean "wait a
      // moment", a duplicate is a hard 403.
      onTokenRef.current('');
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // Widget already torn down; the next mount issues a fresh token.
        }
      }
    };
    registerResetRef.current?.(reset);
  }, []);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Already gone (fast unmount / hot reload); nothing to clean up.
        }
      }
    };
  }, [theme]);

  if (!SITE_KEY) return null;

  if (failed) {
    return (
      <p className="text-xs font-semibold text-amber-600">
        No pudimos cargar la verificacion de seguridad. Revisa tu conexion y recarga la pagina.
      </p>
    );
  }

  return <div ref={containerRef} className="flex justify-center" />;
}
