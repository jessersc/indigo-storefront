/**
 * How a product's availability is shown in the store.
 *
 * Mirrors `workers/indigo-api/src/stock-status.ts` — keep the two in step. The
 * count passed in is the EFFECTIVE stock the Worker already computed (on hand
 * minus live reservations), not a raw column, so an item whose last units are
 * held by an unpaid order reads as sold out rather than available.
 */

export type StockStatusOverride =
  | 'auto'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'unavailable';

export type ResolvedStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unavailable';

/** Matches LOW_STOCK_THRESHOLD in the Worker. */
export const LOW_STOCK_THRESHOLD = 10;

export const STOCK_STATUS_LABELS: Record<ResolvedStockStatus, string> = {
  in_stock: 'Disponible',
  low_stock: 'Ultimas unidades',
  out_of_stock: 'Agotado',
  unavailable: 'No disponible',
};

/** Tailwind classes per state. 'unavailable' is deliberately grey, not red. */
export const STOCK_STATUS_CLASSES: Record<ResolvedStockStatus, string> = {
  in_stock: 'bg-green-100 text-green-700 border-green-200',
  low_stock: 'bg-amber-100 text-amber-700 border-amber-200',
  out_of_stock: 'bg-red-100 text-red-600 border-red-200',
  unavailable: 'bg-slate-200 text-slate-500 border-slate-300',
};

const OVERRIDES: StockStatusOverride[] = [
  'auto', 'in_stock', 'low_stock', 'out_of_stock', 'unavailable',
];

export function normalizeOverride(value: unknown): StockStatusOverride {
  const v = String(value ?? 'auto').trim().toLowerCase() as StockStatusOverride;
  return OVERRIDES.includes(v) ? v : 'auto';
}

export function resolveStockStatus(
  override: unknown,
  effectiveStock: number | null | undefined,
): ResolvedStockStatus {
  const chosen = normalizeOverride(override);
  if (chosen !== 'auto') return chosen;

  // Untracked stock means "not counting this", not "sold out".
  if (effectiveStock === null || effectiveStock === undefined) return 'in_stock';

  const n = Number(effectiveStock) || 0;
  if (n <= 0) return 'out_of_stock';
  if (n <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}

/**
 * Whether the buy controls should be enabled. A forced in_stock/low_stock does
 * not conjure inventory: the server rejects an order for an empty shelf anyway,
 * so letting the button through would only move the failure to checkout.
 */
export function isPurchasable(
  override: unknown,
  effectiveStock: number | null | undefined,
): boolean {
  const chosen = normalizeOverride(override);
  if (chosen === 'unavailable' || chosen === 'out_of_stock') return false;
  if (effectiveStock === null || effectiveStock === undefined) return true;
  return (Number(effectiveStock) || 0) > 0;
}
