/**
 * Image URLs for the store.
 *
 * Every product image lives in R2 behind cdn.indigostores.com, pre-transcoded
 * to WebP at two sizes during the Cloudinary migration:
 *
 *     products/<stem>.webp       800px -- product detail, zoom, hero
 *     products/<stem>.400.webp   400px -- grid cards, search, cart, checkout
 *
 * The database stores only the 800px url. The card size is derived here, so
 * adding a third size later is a code change rather than a data migration.
 *
 * WHY NOT next/image: on Vercel it proxies every remote image through its own
 * optimizer, which is metered on the free plan. These files are already WebP,
 * already correctly sized, and already cached at Cloudflare's edge
 * (`cf-cache-status: HIT`, `max-age=31536000, immutable`), so routing them
 * through a second optimizer would add cost and latency and improve nothing.
 * Plain <img> with an explicit width is the cheap and correct choice.
 */

const CDN_HOST = 'cdn.indigostores.com';

/** The only size below the 800px original that exists as a stored object. */
const CARD_WIDTH = 400;

/**
 * Inline SVG, so a product with no photo costs zero requests. It used to be a
 * hotlinked Unsplash stock photo, which meant an external request per missing
 * image -- and 258 products currently have none.
 */
export const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#fff5f9"/>
      <circle cx="200" cy="175" r="52" fill="none" stroke="#ffc9de" stroke-width="10"/>
      <path d="M175 168a8 8 0 1 1 16 0 8 8 0 0 1-16 0zm34 0a8 8 0 1 1 16 0 8 8 0 0 1-16 0z" fill="#ffc9de"/>
      <path d="M180 196c8 8 32 8 40 0" fill="none" stroke="#ffc9de" stroke-width="8" stroke-linecap="round"/>
      <text x="200" y="272" text-anchor="middle" font-family="system-ui,sans-serif"
            font-size="22" font-weight="700" fill="#ffb3d1">Sin foto</text>
    </svg>`.replace(/\s+/g, ' '),
  );

/**
 * Pick the stored variant closest to what will actually be displayed.
 *
 * `width` is the CSS width the image is rendered at. Anything at or below the
 * card size gets the 400px file; larger gets the 800px original. Non-CDN urls
 * (payment icons, category art, banner images uploaded elsewhere) pass through
 * untouched -- no other host has the `.400` variant.
 */
export function getOptimizedImage(url: string | null | undefined, width = CARD_WIDTH): string {
  if (!url || typeof url !== 'string' || url.trim() === '') return IMAGE_PLACEHOLDER;

  const trimmed = url.trim();
  if (!trimmed.includes(CDN_HOST)) return trimmed;

  // Already a card-size url: only downgrade, never re-append the suffix.
  if (trimmed.includes('.400.webp')) {
    return width > CARD_WIDTH ? trimmed.replace('.400.webp', '.webp') : trimmed;
  }

  if (width <= CARD_WIDTH) return trimmed.replace(/\.webp$/i, '.400.webp');
  return trimmed;
}

/**
 * `srcset` so a retina phone gets the 800px file for a 400px slot while an
 * ordinary display keeps the small one. Only meaningful for CDN images, which
 * are the only ones with two stored sizes.
 */
export function getImageSrcSet(url: string | null | undefined): string | undefined {
  if (!url || !url.includes(CDN_HOST)) return undefined;
  const large = url.includes('.400.webp') ? url.replace('.400.webp', '.webp') : url;
  const small = large.replace(/\.webp$/i, '.400.webp');
  return `${small} 400w, ${large} 800w`;
}

/** True when the url is a real photo rather than the fallback. */
export function hasImage(url: string | null | undefined): boolean {
  return !!url && typeof url === 'string' && url.trim() !== '';
}
