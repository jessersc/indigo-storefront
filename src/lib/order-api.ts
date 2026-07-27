/**
 * The customer's own order: detail, cancel, change request, and the guest
 * lookup that lets someone without an account reach the same view.
 *
 * Two credentials are accepted by the Worker and mirrored here:
 *   Authorization: Bearer <session>   — a signed-in customer
 *   X-Order-Token: <token>            — a guest who answered the security
 *                                       questions and the emailed code
 *
 * The order token is scoped to ONE order number. It is deliberately kept in
 * sessionStorage rather than localStorage: it grants read access to a real
 * order, so it should die with the tab rather than sit on a shared computer.
 */

import { postJson } from './api-error';

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

export interface OrderItemDetail {
  productId: string;
  variantId: string | null;
  name: string | null;
  quantity: number;
  priceUsd: number;
  priceBs: number;
}

/**
 * One step in a request's history. Deliberately does not say WHO acted —
 * "aprobado por alex@" is internal; the customer needs to know it was approved.
 */
export interface OrderRequestEvent {
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  by_customer: boolean;
}

export interface OrderRequestSummary {
  id: string;
  kind: 'refund' | 'replacement';
  status: string;
  reason: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  events: OrderRequestEvent[];
}

export interface PaymentInstructions {
  kind: string;
  [key: string]: string;
}

export interface OrderDetail {
  orderNumber: string;
  status: string;
  placedAt: string;
  updatedAt: string;
  totals: { usd: number; bs: number };
  discountCode: string | null;
  customer: { name: string | null; email: string | null; phone: string | null; cedula: string | null };
  delivery: {
    method: string;
    address: string | null;
    instructions: string | null;
    courierName: string | null;
    courierState: string | null;
    courierOffice: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
  };
  payment: {
    method: string;
    status: string;
    transactionId: string | null;
    paidAt: string | null;
    awaitingPayment: boolean;
    instructions: PaymentInstructions | null;
  };
  items: OrderItemDetail[];
  requests: OrderRequestSummary[];
  canCancel: boolean;
}

export interface OrderCredentials {
  /** Session token for a signed-in customer. */
  token?: string | null;
  /** Order-scoped token from the guest lookup. */
  orderToken?: string | null;
}

function headersFor(creds: OrderCredentials): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (creds.token) headers.Authorization = `Bearer ${creds.token}`;
  if (creds.orderToken) headers['X-Order-Token'] = creds.orderToken;
  return headers;
}

export async function getOrderDetail(
  orderNumber: string,
  creds: OrderCredentials,
): Promise<OrderDetail | null> {
  const res = await fetch(`${API_URL}/account/orders/${encodeURIComponent(orderNumber)}`, {
    headers: headersFor(creds),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { order: OrderDetail };
  return data.order;
}

export async function cancelOrder(
  orderNumber: string,
  creds: OrderCredentials,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await fetch(`${API_URL}/account/orders/${encodeURIComponent(orderNumber)}/cancel`, {
    method: 'POST',
    headers: headersFor(creds),
    body: '{}',
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (res.ok && data.ok) return { ok: true };
  return { ok: false, error: data.error, message: data.message };
}

export async function requestOrderChange(
  orderNumber: string,
  message: string,
  creds: OrderCredentials,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(
    `${API_URL}/account/orders/${encodeURIComponent(orderNumber)}/change-request`,
    { method: 'POST', headers: headersFor(creds), body: JSON.stringify({ message }) },
  );
  const data = (await res.json().catch(() => ({}))) as any;
  return res.ok && data.ok ? { ok: true } : { ok: false, message: data.message };
}

// ─────────────────────────────────────────────
// Guest lookup
// ─────────────────────────────────────────────

export interface LookupAnswers {
  orderNumber: string;
  email: string;
  cedula: string;
  phone: string;
  /** Address or courier office, when the order has one. */
  destination?: string;
}

/**
 * Step 1. Always resolves — the Worker answers `ok` whether or not the answers
 * matched, so this cannot be used to discover whether an order number exists or
 * to test a cedula against one. The customer is told to check their email
 * either way.
 */
export async function requestOrderLookup(answers: LookupAnswers): Promise<void> {
  await postJson(`${API_URL}/orders/lookup/request`, answers);
}

/** Step 2. Exchanges the emailed code for a token scoped to that order. */
export async function verifyOrderLookup(input: {
  orderNumber: string;
  email: string;
  code: string;
}): Promise<{ orderToken: string; order: OrderDetail }> {
  return postJson<{ orderToken: string; order: OrderDetail }>(
    `${API_URL}/orders/lookup/verify`,
    input,
  );
}

// ─────────────────────────────────────────────
// Order-token storage (tab-scoped, on purpose)
// ─────────────────────────────────────────────

const TOKEN_PREFIX = 'indigo.orderToken.';

export function storeOrderToken(orderNumber: string, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(TOKEN_PREFIX + orderNumber, token);
  } catch {
    // Storage disabled; the customer simply has to look the order up again.
  }
}

export function readOrderToken(orderNumber: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(TOKEN_PREFIX + orderNumber);
  } catch {
    return null;
  }
}
