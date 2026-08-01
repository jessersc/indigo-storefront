import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { STORE_CONFIG_TAG, getStoreConfig } from '../../../lib/store-config';
import { CATALOG_TAG, getCatalog } from '../../../lib/catalog';

/**
 * On-demand cache invalidation, called by the Worker after an admin write.
 *
 * WHY THIS EXISTS: the store-config fetch runs in the shared layout, and in the
 * App Router a route's revalidate is the MINIMUM of every fetch inside it. Its
 * 10-second window therefore set the window for EVERY page on the site, so
 * ordinary crawler traffic regenerated pages continuously — 86k of the 200k
 * monthly Vercel ISR writes, with barely any real visitors.
 *
 * The window is now long. Freshness comes from here instead: the dashboard
 * saves, the Worker calls this, and the affected pages rebuild on the next
 * request. The operator sees their edit immediately and idle traffic costs
 * nothing, which the 10-second window could not do at the same time.
 *
 * Authenticated with the INTERNAL_API_SECRET / INDIGO_INTERNAL_SECRET pair that
 * already guards the payment-confirmation routes — no new secret to provision.
 */

const KNOWN_TAGS = new Set([STORE_CONFIG_TAG, CATALOG_TAG]);

/** Constant-time compare, so a wrong secret cannot be found byte by byte. */
function secretsMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = process.env.INDIGO_INTERNAL_SECRET ?? '';
  if (!secret) {
    // Fail closed. An unset secret must never mean "allow everyone" — this
    // endpoint can force a rebuild of every page, which is a cheap DoS.
    console.error('[revalidate] INDIGO_INTERNAL_SECRET is not set; refusing');
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!secretsMatch(request.headers.get('x-internal-secret') ?? '', secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let tags: string[] = [];
  try {
    const body = (await request.json()) as { tags?: unknown };
    if (Array.isArray(body?.tags)) tags = body.tags.filter((t): t is string => typeof t === 'string');
  } catch {
    /* no body — fall through to revalidating everything known */
  }
  if (tags.length === 0) tags = [...KNOWN_TAGS];

  // Only tags this app actually assigns. An arbitrary string would be accepted
  // silently by revalidateTag and do nothing, which would look like success.
  const accepted = tags.filter((t) => KNOWN_TAGS.has(t));
  const rejected = tags.filter((t) => !KNOWN_TAGS.has(t));

  for (const tag of accepted) {
    // 'max', NOT `{ expire: 0 }`.
    //
    // The object form is a cacheLife profile, and cacheLife only applies when
    // `cacheComponents` is enabled in next.config. This app does not enable it,
    // so `{ expire: 0 }` was accepted, ignored, and invalidated nothing --
    // measured: a price edit still took ~7 minutes to appear, healing only when
    // the 300s window lapsed. It returned 200 the whole time, which is exactly
    // how it went unnoticed.
    revalidateTag(tag, 'max');
  }

  // 'max' is stale-while-revalidate: the first request after invalidation is
  // served the OLD value while fresh data loads behind it. For an operator who
  // just hit save and reloaded, that is still "my edit did not apply".
  //
  // So the cache is warmed here instead of leaving it to that first visitor.
  // These calls re-run the same tagged fetches, repopulating the entry before
  // anyone asks for it, which turns stale-then-fresh into simply fresh.
  const warmed: string[] = [];
  await Promise.all([
    accepted.includes(CATALOG_TAG)
      ? getCatalog().then(() => void warmed.push(CATALOG_TAG)).catch(() => {})
      : Promise.resolve(),
    accepted.includes(STORE_CONFIG_TAG)
      ? getStoreConfig().then(() => void warmed.push(STORE_CONFIG_TAG)).catch(() => {})
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true, revalidated: accepted, warmed, ignored: rejected });
}
