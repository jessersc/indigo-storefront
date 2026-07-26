/**
 * Reading Mercantil's answer: did the bank actually approve this payment?
 *
 * Split out of the route so it can be tested directly. The route imports
 * `next/server`, which cannot be loaded outside the Next runtime, and this is
 * the one piece of that file where being wrong costs money.
 *
 * ── Why this is strict ──────────────────────────────────────────────────────
 *
 * The previous version (ported verbatim from the legacy site, which had the
 * same hole) treated `result.infoMsg.guId` as proof of approval. `guId` is the
 * API gateway's per-request trace identifier: it is returned regardless of
 * outcome, so *any* reply carrying one was read as "approved". That is how a
 * Pago Movil with a made-up cedula and phone number was accepted — the request
 * reached Mercantil, Mercantil answered, and the answer contained a guId.
 *
 * Card payments happened to be caught only because their rejections also
 * populate `status.errorCode`, which an earlier guard checked. Pago Movil
 * rejections do not always take that shape, so C2P fell through to the guId arm.
 *
 * The other loose arms (`code === 0`, `response_code === '00'`, a bare
 * `status === 'success'`) were not anchored to any envelope this API documents,
 * so they could match an unrelated top-level field just as easily.
 *
 * Now: approval requires an explicit positive status inside a recognised
 * transaction envelope, and anything unrecognised is a decline. The cost is
 * deliberately asymmetric — a false decline means the customer retries, a false
 * approval means goods ship for an order nobody paid for.
 */

/** Statuses that are an explicit "no", whatever else the payload says. */
const REJECTED_STATUSES = ['rejected', 'denied', 'declined', 'failed', 'error'];

export function isPaymentSuccessful(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, any>;

  // Explicit error envelopes first.
  if (Array.isArray(r.error_list) && r.error_list.length > 0) return false;
  if (r.status && typeof r.status === 'object' && (r.status.errorTech || r.status.errorCode)) {
    return false;
  }

  // C2P and card payments answer under different keys. Checking only
  // `transaction_response` (as the old code did) meant a C2P reply matched
  // nothing and fell through to the guId arm.
  const tx =
    r.transaction_c2p_response ??
    r.transaction_response ??
    (r.transaction && typeof r.transaction === 'object' ? r.transaction : null);

  if (!tx || typeof tx !== 'object') return false;

  const status = String(tx.trx_status ?? tx.status ?? '').trim().toLowerCase();
  const internal = String(tx.trx_internal_status ?? '').trim();

  // An explicit rejection wins even when another field looks positive.
  if (REJECTED_STATUSES.includes(status)) return false;

  if (status === 'approved') return true;
  // '0000' is Mercantil's "no internal error" code. Only trusted once the
  // status field above has had its chance to contradict it.
  if (internal === '0000') return true;

  return false;
}
