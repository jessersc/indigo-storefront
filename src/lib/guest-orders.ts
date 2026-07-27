/**
 * A guest's record of what they bought, kept in this browser.
 *
 * Guests have no account, so nothing server-side links them to their orders.
 * This stores just enough to find one again — the order number and the details
 * the lookup asks for — so "Mis pedidos" works without signing in.
 *
 * ── What this deliberately is NOT ───────────────────────────────────────────
 *
 * It is not the source of truth and it is not a credential. It holds no prices,
 * no addresses and no payment details; the order itself is always re-fetched
 * from the server, behind the same identity check a stranger would face. So a
 * copied localStorage entry reveals nothing on its own, and a customer on
 * another device loses only the convenience, not the order.
 *
 * It is genuinely fragile: clearing site data loses it. The checkout says so
 * before a guest commits, and offers an account instead.
 */

const STORAGE_KEY = 'indigo.guest.orders.v1';
const MAX_ENTRIES = 25;

export interface GuestOrderRef {
  orderNumber: string;
  /** Address the order was placed with — the lookup asks for it. */
  email: string;
  /** ISO timestamp, used for ordering and pruning. */
  placedAt: string;
  /** Shown in the list so the customer can tell orders apart at a glance. */
  totalUsd?: number;
  itemCount?: number;
}

function read(): GuestOrderRef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is GuestOrderRef =>
        !!o && typeof o.orderNumber === 'string' && typeof o.email === 'string',
    );
  } catch {
    // Corrupt or unavailable (private mode, storage disabled). Losing the list
    // is recoverable; throwing here would break the page that renders it.
    return [];
  }
}

function write(orders: GuestOrderRef[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota or a blocked storage API. The order still exists server-side.
  }
}

/** Newest first. */
export function listGuestOrders(): GuestOrderRef[] {
  return read().sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''));
}

/** Record an order. Idempotent on order number, so a retry does not duplicate. */
export function rememberGuestOrder(entry: GuestOrderRef): void {
  const existing = read().filter((o) => o.orderNumber !== entry.orderNumber);
  write([entry, ...existing]);
}

export function forgetGuestOrder(orderNumber: string): void {
  write(read().filter((o) => o.orderNumber !== orderNumber));
}

export function clearGuestOrders(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
