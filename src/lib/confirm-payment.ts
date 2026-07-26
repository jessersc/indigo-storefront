/**
 * Server-to-server payment confirmation, from a Vercel route to the Worker.
 *
 * This is the trust boundary. Each gateway route holds the provider credentials
 * and has just heard from the provider that the money moved; only then does it
 * call the Worker, authenticated with a shared secret the browser never sees.
 * The browser's own claim that a payment succeeded is not accepted anywhere.
 *
 * Server-only: importing this into a client component would leak the secret.
 */

import 'server-only';

const API_URL = process.env.INDIGO_API_URL || 'http://localhost:8787';

export interface ConfirmPaymentArgs {
  orderNumber: string;
  method: string;
  transactionId?: string | null;
  amountUsd?: number;
}

export interface ConfirmPaymentResult {
  ok: boolean;
  status?: string;
  error?: string;
}

/**
 * Tell the Worker a payment is real. Never throws: a confirmation failure must
 * not turn a captured payment into a client-visible error, because the money
 * has already moved. It is logged loudly instead, and the order stays pending
 * for an admin to settle by hand.
 */
export async function confirmPaymentWithWorker(args: ConfirmPaymentArgs): Promise<ConfirmPaymentResult> {
  const secret = process.env.INDIGO_INTERNAL_SECRET;
  if (!secret) {
    console.error(
      '[confirm-payment] INDIGO_INTERNAL_SECRET is not set — order',
      args.orderNumber,
      'was PAID but cannot be confirmed automatically. Confirm it in the dashboard.',
    );
    return { ok: false, error: 'not_configured' };
  }

  try {
    const res = await fetch(`${API_URL}/internal/payments/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify(args),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };

    if (!res.ok) {
      console.error(
        '[confirm-payment] Worker rejected confirmation for order',
        args.orderNumber,
        res.status,
        data?.error,
      );
      return { ok: false, error: data?.error ?? `http_${res.status}` };
    }
    return { ok: true, status: data?.status };
  } catch (err) {
    console.error('[confirm-payment] Worker unreachable for order', args.orderNumber, err);
    return { ok: false, error: 'unreachable' };
  }
}

/**
 * Ask the Worker whether `orderNumber` is a still-unpaid order placed with
 * `cedula`. Gates provider lookups that key on cedula alone: a cedula is not a
 * secret, so without this anyone could read a stranger's provider order.
 *
 * Fails CLOSED -- if the Worker cannot be reached, the lookup does not happen.
 */
export async function verifyOrderOwner(orderNumber: string, cedula: string): Promise<boolean> {
  const secret = process.env.INDIGO_INTERNAL_SECRET;
  if (!secret || !orderNumber || !cedula) return false;
  try {
    const res = await fetch(`${API_URL}/internal/orders/verify-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify({ orderNumber, cedula }),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return data?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Tell the Worker an attempt definitively failed, so the stock it reserved goes
 * back immediately instead of waiting out the 2-hour hold. Best-effort.
 */
export async function failPaymentWithWorker(orderNumber: string, reason?: string): Promise<void> {
  const secret = process.env.INDIGO_INTERNAL_SECRET;
  if (!secret || !orderNumber) return;
  try {
    await fetch(`${API_URL}/internal/payments/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify({ orderNumber, reason }),
    });
  } catch {
    // Nothing to do: the hold expires on its own.
  }
}
