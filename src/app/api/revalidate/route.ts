import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { STORE_CONFIG_TAG } from '../../../lib/store-config';
import { CATALOG_TAG } from '../../../lib/catalog';

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
    // `{ expire: 0 }`, not profile 'max'. 'max' is stale-while-revalidate: the
    // operator's first reload after saving would still show the OLD value,
    // which is precisely the confusion the short window existed to avoid. The
    // single-argument form has the right semantics but is deprecated in 16.x.
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json({ ok: true, revalidated: accepted, ignored: rejected });
}
