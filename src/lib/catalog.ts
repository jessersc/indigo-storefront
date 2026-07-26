/**
 * Storefront catalog, served from D1 through the Worker so dashboard edits reach
 * the store. Falls back to the bundled JSON snapshot when the Worker is
 * unreachable, so the store still renders offline / during a backend blip.
 *
 * Prices arrive as the base (`base_price_usd`); every shelf price is derived
 * through the CurrencyEngine (`lib/currency.ts`) at render time.
 */

import { cache } from 'react';
import { calculatePrices, type ExchangeRates } from './currency';
import productsData from './products.json';
import variantsData from './variants.json';
import categoriesData from './categories.json';
import collectionsData from './collections.json';

const API_URL = process.env.INDIGO_API_URL || 'http://localhost:8787';
const REVALIDATE_SECONDS = 60;
const FETCH_TIMEOUT_MS = 4000;

export interface CatalogProduct {
  id: string;
  name: string;
  base_price_usd: number;
  compare_at_price_usd?: number | null;
  discount?: number | null;
  sku?: string | null;
  description?: string | null;
  category?: string | null;
  collection?: string | null;
  image?: string | null;
  /** EFFECTIVE stock: on hand minus live reservations, computed by the Worker. */
  stock?: number | null;
  /** Operator override: auto | in_stock | low_stock | out_of_stock | unavailable. */
  stock_status?: string | null;
  created_at?: string | null;
}

export interface CatalogVariant {
  id: string;
  parent_id: string;
  variant_name: string;
  image_path?: string | null;
  stock_count?: number | null;
  sku?: string | null;
}

/** A category or collection: same shape, rendered by the same carousel. */
export interface CatalogTaxonomy {
  id: string;
  name: string;
  image_url?: string | null;
  svg_code?: string | null;
  display_type?: 'svg' | 'image' | null;
  display_order?: number | null;
}

export interface CatalogImage {
  product_id: string;
  image_url: string;
  display_order?: number | null;
}

export interface Catalog {
  products: CatalogProduct[];
  variants: CatalogVariant[];
  categories: CatalogTaxonomy[];
  collections: CatalogTaxonomy[];
  images: CatalogImage[];
}

/** Bundled snapshots are wrapped as [{ results: [...] }] by the export tooling. */
function unwrap<T>(data: unknown): T[] {
  const first = (data as { results?: T[] }[])[0];
  return first?.results ?? [];
}

/**
 * The bundled taxonomy snapshots are the legacy shape -- a bare
 * `{ category: "Collares" }` / `{ collection: "K-Pop" }` per row, with no id or
 * `name`. Everything downstream expects `CatalogTaxonomy` (`item.name` is read
 * directly), so the rows are normalised here rather than at each call site.
 *
 * Getting this wrong is invisible until the Worker is actually unreachable --
 * which is the one moment the fallback has to work.
 */
function unwrapTaxonomy(data: unknown, key: 'category' | 'collection'): CatalogTaxonomy[] {
  const rows = unwrap<Record<string, unknown>>(data);
  const seen = new Set<string>();
  const out: CatalogTaxonomy[] = [];
  for (const row of rows) {
    // Tolerate both the legacy shape and a real CatalogTaxonomy row.
    const name = String(row.name ?? row[key] ?? '').trim();
    if (!name || name === 'Default' || seen.has(name)) continue;
    seen.add(name);
    out.push({ id: String(row.id ?? name), name });
  }
  return out;
}

function staticFallback(): Catalog {
  return {
    products: unwrap<CatalogProduct>(productsData),
    variants: unwrap<CatalogVariant>(variantsData),
    categories: unwrapTaxonomy(categoriesData, 'category'),
    collections: unwrapTaxonomy(collectionsData, 'collection'),
    images: [],
  };
}

export const getCatalog = cache(async (): Promise<Catalog> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API_URL}/catalog`, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });
    clearTimeout(timer);
    if (!res.ok) return staticFallback();

    const data = (await res.json()) as Partial<Catalog>;
    const fallback = staticFallback();
    // A half-populated response must not blank the store out.
    return {
      products: data.products?.length ? data.products : fallback.products,
      variants: data.variants?.length ? data.variants : fallback.variants,
      categories: data.categories?.length ? data.categories : fallback.categories,
      collections: data.collections?.length ? data.collections : fallback.collections,
      images: data.images ?? [],
    };
  } catch {
    return staticFallback();
  }
});

/** Products the storefront should show: hides entries with no image. */
export function visibleProducts(products: CatalogProduct[]): CatalogProduct[] {
  return products.filter((p) => p.image && String(p.image).trim() !== '');
}

/**
 * The shape every storefront view renders. One mapper so the grid, search,
 * product page and header dropdown can never disagree on a price or an image.
 */
export interface DisplayProduct {
  ItemID: string;
  Product: string;
  USD: number;
  base_price_usd: number;
  CompareAtPrice: number | null;
  Bs: number;
  Category: string;
  Collection: string;
  Image: string;
  Description: string;
  Stock: number;
  StockStatus: string;
}

/**
 * Inline SVG placeholder for products with no photo yet.
 *
 * A data URI rather than a file so it cannot 404, and rather than the old
 * guessed Cloudinary path, which 404'd for every product whose image was never
 * uploaded — fine while such products were hidden, visibly broken now that
 * they are shown.
 */
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
       <rect width="400" height="400" fill="#fff6fa"/>
       <circle cx="200" cy="170" r="58" fill="#ffe0ef"/>
       <path d="M170 185a30 30 0 0 1 60 0z" fill="#ffc2dd"/>
       <circle cx="184" cy="158" r="7" fill="#ff6b9d"/>
       <circle cx="216" cy="158" r="7" fill="#ff6b9d"/>
       <text x="200" y="285" font-family="system-ui,sans-serif" font-size="26"
             font-weight="700" fill="#ff9ec4" text-anchor="middle">Sin foto</text>
       <text x="200" y="315" font-family="system-ui,sans-serif" font-size="17"
             fill="#ffb8d5" text-anchor="middle">Proximamente</text>
     </svg>`.replace(/\s+/g, ' '),
  );

/** The product's photo, or a placeholder when it has none. */
function imageFor(p: CatalogProduct): string {
  const image = p.image && String(p.image).trim();
  return image || PLACEHOLDER_IMAGE;
}

export function toDisplayProduct(
  p: CatalogProduct,
  rates: ExchangeRates,
): DisplayProduct {
  // base_price_usd is the cost basis (usd_real), never the shelf price. Both
  // currencies come from one CurrencyEngine call so they cannot disagree.
  const prices = calculatePrices(p.base_price_usd, rates);
  return {
    ItemID: String(p.id),
    Product: p.name,
    USD: prices.usd,
    base_price_usd: p.base_price_usd,
    CompareAtPrice: p.compare_at_price_usd ?? null,
    Bs: prices.bs,
    Category: p.category || '',
    Collection: p.collection || '',
    Image: imageFor(p),
    Description: p.description || '',
    Stock: p.stock ?? 10,
    StockStatus: p.stock_status || 'auto',
  };
}

/** Comma-separated `category`/`collection` fields -> sorted unique names. */
export function namesFrom(products: CatalogProduct[], field: 'category' | 'collection'): string[] {
  const seen = new Set<string>();
  for (const p of products) {
    for (const raw of String(p[field] ?? '').split(',')) {
      const name = raw.trim();
      if (name && name !== 'Default') seen.add(name);
    }
  }
  return Array.from(seen).sort();
}
