/**
 * Where to send someone after they sign in.
 *
 * The auth pages take a `?next=` so a customer who signs in from the checkout
 * lands back on the checkout rather than on their account page with an
 * abandoned cart behind them.
 *
 * Only same-site paths are honoured. An open redirect here would be a genuine
 * phishing primitive: a link to our own login page that bounces to an
 * attacker's copy of it, arriving with our domain in the customer's history and
 * their trust already spent.
 */

const DEFAULT_DESTINATION = '/account';

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_DESTINATION;

  // Must be a root-relative path. `//evil.com` is protocol-relative and would
  // leave the site, and a backslash is treated as a slash by some browsers.
  if (!raw.startsWith('/')) return DEFAULT_DESTINATION;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_DESTINATION;
  // A scheme anywhere means it is not the simple path this accepts.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return DEFAULT_DESTINATION;

  return raw;
}
