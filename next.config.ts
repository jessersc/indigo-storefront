import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The storefront previously sent none of these: a scan found no CSP, no
 * X-Frame-Options, no X-Content-Type-Options and no Referrer-Policy. The API
 * Worker has had them for a while (see workers/indigo-api/src/cors.ts); this is
 * the browser-facing half.
 *
 * WHY NOT A NONCE-BASED CSP: the documented Next.js approach generates a
 * per-request nonce in `proxy.ts`, which requires DYNAMIC RENDERING on every
 * page. That would turn every route into a function invocation and disable ISR
 * entirely -- the exact cost problem that had Vercel at 86k of 200k monthly ISR
 * writes with four real visitors. A static policy with 'unsafe-inline' is the
 * deliberate trade: it does not stop an injected inline script, but it does
 * restrict WHICH ORIGINS may serve scripts, frames and form posts, which is
 * where the realistic third-party risk sits.
 *
 * WHY THE PAYPAL ENTRIES ARE WILDCARDS: the origin in our code
 * (`https://www.paypal.com/sdk/js`) is only the loader. The SDK it returns then
 * pulls from four more hosts that appear nowhere in this repo -- verified by
 * fetching the bundle and reading it, not assumed:
 *   www.sandbox.paypal.com     the buttons iframe (this store runs sandbox:
 *                              PAYPAL_API_BASE defaults to api-m.sandbox)
 *   c.paypal.com               fraudnet, pulled because enable-funding=card
 *   cors.api.sandbox.paypal.com  the SDK's own XHR
 *   www.paypalobjects.com      button art and sub-bundles
 * A policy naming only www.paypal.com passes every page that has no PayPal
 * button on it and then blocks checkout. Going live swaps the sandbox hosts for
 * their production twins, so the wildcard also survives that switch.
 *
 * Every other origin below was taken from the code that loads it, not guessed:
 *   www.paypal.com             CheckoutFlow.tsx (SDK + buttons iframe)
 *   challenges.cloudflare.com  Turnstile.tsx
 *   accounts.google.com        GoogleSignInButton.tsx
 *   connect.facebook.net       FacebookSignInButton.tsx
 *   unpkg.com                  CasheaPayment.tsx (cashea-web-checkout-sdk)
 *   external.cashea.app        app/api/cashea/route.ts
 *   www.google.com             CheckoutFlow.tsx (Maps embed for the pickup point)
 *   tiktok / instagram         SocialVideos.tsx embeds
 *   static.cloudflareinsights  Web Analytics beacon
 *   fonts.googleapis/gstatic   NO LONGER used by our own CSS -- next/font
 *                              self-hosts Nunito and Lilita One, and the built
 *                              stylesheet has zero references to either host.
 *                              Kept only because the dashboard's content pages
 *                              render operator-authored HTML, which could carry
 *                              a font import. Safe to drop if that stops.
 *   transparenttextures.com    HomeClient.tsx background (covered by img-src https:)
 */

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Nothing should frame the storefront. Mirrors X-Frame-Options below for
  // browsers that honour CSP first.
  "frame-ancestors 'self'",
  // Checkout posts to PayPal; nothing else may be a form target.
  // NOTE: Cashea leaves via `window.location.href = web.cashea.app/checkout`
  // (confirmed in the SDK bundle). That is a top-level navigation, which no
  // directive here governs, so it needs no entry.
  "form-action 'self' https://*.paypal.com",
  [
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "https://*.paypal.com https://*.paypalobjects.com",
    "https://challenges.cloudflare.com",
    "https://accounts.google.com https://connect.facebook.net",
    "https://unpkg.com https://static.cloudflareinsights.com",
    "https://www.tiktok.com https://www.instagram.com",
  ].join(" "),
  // Tailwind and React inline styles; the font CSS is imported from Google.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Deliberately broad: product images come from our CDN, but TikTok and
  // Instagram embeds pull thumbnails from a long tail of their own CDN hosts
  // that cannot be usefully enumerated. Images are a low-risk content type.
  "img-src 'self' data: blob: https:",
  [
    "connect-src 'self'",
    "https://api.indigostores.com https://cdn.indigostores.com",
    "https://static.cloudflareinsights.com",
    "https://*.paypal.com https://*.paypalobjects.com",
    // oauth2.googleapis.com is the token endpoint the GSI client calls; it is
    // referenced only inside accounts.google.com/gsi/client, not in our code.
    "https://accounts.google.com https://oauth2.googleapis.com",
    "https://connect.facebook.net https://*.facebook.com",
    "https://external.cashea.app https://challenges.cloudflare.com",
    "https://*.tiktokv.com https://*.tiktokcdn.com",
  ].join(" "),
  [
    "frame-src 'self'",
    // *.paypal.com, not www: the buttons render from www.sandbox.paypal.com.
    "https://*.paypal.com https://challenges.cloudflare.com",
    "https://accounts.google.com https://*.facebook.com",
    "https://www.google.com https://www.tiktok.com https://www.instagram.com",
  ].join(" "),
  "media-src 'self' https: data:",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    // includeSubDomains covers api / cdn / admin, all of which already serve
    // HTTPS. Deliberately NO preload: removal from the preload list takes
    // months and would commit every future subdomain to HTTPS indefinitely.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // SAMEORIGIN rather than DENY: third-party clickjacking protection is
  // identical, but DENY would also break a same-origin preview or embed if one
  // is ever added.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // payment= is NOT empty: the PayPal SDK uses the Payment Request API, and
    // blocking it here would break card checkout.
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://www.paypal.com")',
  },
  {
    // REPORT-ONLY for now. Enforcing a CSP blind on a working checkout is how
    // you find a missing origin by taking payments offline. Browse the real
    // flows, collect the violations, then rename this key to
    // `Content-Security-Policy`.
    key: "Content-Security-Policy-Report-Only",
    value: CSP,
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
