/**
 * Live stock for items already sitting in a cart.
 *
 * WHY: every cart line carries a `Stock` number captured at the moment it was
 * added, and the catalogue that number came from is cached for five minutes.
 * The cart itself is persisted in localStorage, so that snapshot can be days
 * old. The quantity clamps in StorefrontContext are correct, but they clamp
 * against that stale figure -- which is how a customer ends up holding six of
 * something with one left, and only finds out when checkout refuses the whole
 * order.
 *
 * This asks the uncached per-product endpoint (the same one the detail page
 * uses, ~10 D1 rows) what the true number is right now.
 *
 * Deliberately best-effort: any failure returns no opinion at all, and the
 * caller leaves the cart exactly as it was. A backend blip must never empty
 * somebody's basket -- and it cannot oversell either, because checkout
 * re-verifies stock server-side before an order exists.
 */

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

const TIMEOUT_MS = 3000;

/** Guard against a pathological cart turning into a request storm. */
const MAX_LOOKUPS = 20;

export interface LiveStockEntry {
  /** Stock for the product as a whole. */
  stock: number;
  /** Per-variant counts, keyed by variant name. */
  variants: Record<string, number>;
  /** Operator override; 'unavailable' means do not sell regardless of count. */
  stockStatus: string | null;
}

/**
 * Look up live stock for the given product ids.
 *
 * Returns a map keyed by product id. Ids that could not be fetched are simply
 * absent -- absence means "no information", never "zero".
 */
export async function fetchLiveStock(productIds: string[]): Promise<Map<string, LiveStockEntry>> {
  const out = new Map<string, LiveStockEntry>();
  const unique = Array.from(new Set(productIds.filter(Boolean).map(String))).slice(0, MAX_LOOKUPS);
  if (unique.length === 0) return out;

  await Promise.allSettled(
    unique.map(async (id) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${API_URL}/catalog/product/${encodeURIComponent(id)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          stock?: unknown;
          stock_status?: unknown;
          variants?: Array<{ id?: unknown; variant_name?: unknown; stock_count?: unknown }>;
        };

        const variants: Record<string, number> = {};
        for (const v of data.variants ?? []) {
          // Cart lines key their variant by NAME, so index by name and fall
          // back to id for older lines that stored the id instead.
          const count = Number(v.stock_count);
          if (!Number.isFinite(count)) continue;
          if (typeof v.variant_name === 'string' && v.variant_name) variants[v.variant_name] = count;
          if (v.id !== undefined && v.id !== null) variants[String(v.id)] = count;
        }

        out.set(id, {
          stock: Number.isFinite(Number(data.stock)) ? Number(data.stock) : 0,
          variants,
          stockStatus: typeof data.stock_status === 'string' ? data.stock_status : null,
        });
      } catch {
        // Leave the id absent: the caller keeps whatever it already had.
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return out;
}

/**
 * What a cart line is actually allowed to be, given live stock.
 *
 * `null` means "no live information" -- the caller must not change anything.
 */
export function allowedForLine(
  entry: LiveStockEntry | undefined,
  variantName: string | null | undefined,
): number | null {
  if (!entry) return null;
  // An explicit operator override outranks any count.
  if (entry.stockStatus === 'unavailable') return 0;
  if (variantName) {
    const count = entry.variants[variantName];
    // A variant that has vanished from the catalogue is not purchasable.
    return Number.isFinite(count) ? count : 0;
  }
  return entry.stock;
}
