/**
 * Checkout progress that survives a reload.
 *
 * WHY THIS EXISTS: everything about a checkout lived in component state, so a
 * refresh, a back-navigation, or anything that remounted CheckoutFlow threw the
 * customer back to an empty form -- delivery details retyped, order summary
 * gone, and (for a guest) the email verification done again. People abandon at
 * that point, and rightly.
 *
 * sessionStorage, deliberately, not localStorage: this is one purchase in
 * progress, not a preference. Closing the tab should end it, and a shared or
 * public computer must not leave someone's address and cedula behind.
 *
 * WHAT IS NOT STORED: the Turnstile token (single-use and short-lived --
 * restoring one guarantees a `timeout-or-duplicate` rejection), the guest
 * token, the draft token, and any payment state. Those are proof of something,
 * and proof has to be re-established after a reload rather than replayed from
 * storage the customer's browser controls. `step` is likewise never restored
 * past the form: a restored session always re-enters at the form and walks
 * forward, so a payment screen can never be resurrected without the server
 * agreeing.
 */

const KEY = 'indigo_checkout_v1';

/** Abandoned sessions go stale rather than greeting someone the next morning. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface CheckoutSnapshot {
  /** The delivery/contact form, verbatim. */
  formData: Record<string, unknown>;
  /**
   * Kept so a resumed checkout reuses the SAME order number.
   *
   * Generating a fresh one on reload is what orphans drafts: the server would
   * be holding stock against a number the browser has forgotten, and the
   * customer would end up with two half-orders.
   */
  orderNumber: string;
  /** Whether a guest already proved control of their email in this session. */
  identityDone: boolean;
  /** Millisecond timestamp, for the staleness check. */
  savedAt: number;
}

function available(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    // Safari private mode throws on access, not just on write.
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveCheckout(snapshot: Omit<CheckoutSnapshot, 'savedAt'>): void {
  const store = available();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
  } catch {
    // Quota exceeded or storage disabled: losing the resume is acceptable,
    // breaking the checkout over it is not.
  }
}

export function loadCheckout(): CheckoutSnapshot | null {
  const store = available();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      store.removeItem(KEY);
      return null;
    }
    if (!parsed.formData || typeof parsed.formData !== 'object') return null;
    return {
      formData: parsed.formData as Record<string, unknown>,
      orderNumber: typeof parsed.orderNumber === 'string' ? parsed.orderNumber : '',
      identityDone: parsed.identityDone === true,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

/** Called once an order really exists, so the next checkout starts clean. */
export function clearCheckout(): void {
  const store = available();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // Nothing to do; a stale entry expires on its own via MAX_AGE_MS.
  }
}
