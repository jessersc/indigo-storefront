import { cache } from 'react';
import assetsRaw from './assets.json';
import ratesData from './rates.json';
import socialFeeds from './social_feeds.json';

/**
 * Server-side loader for the storefront's dynamic customization (banner,
 * favicon, logo, social icons, scalar config and exchange rates).
 *
 * Source of truth is the shared Worker (`indigo-api` /config, backed by D1).
 * If the Worker is unreachable -- offline, worker not running, unstable network
 * -- it falls back to the bundled static JSON so the store still renders. The
 * per-request `cache()` wrapper dedupes the two call sites (layout body +
 * generateMetadata) into a single fetch.
 */

export interface ExchangeRates {
  bcv_fijo: number;
  paralelo_fijo: number;
  bcv_diario: number;
}

export interface Asset {
  id?: string;
  name?: string;
  asset_type?: string | null;
  social_platform?: string | null;
  url?: string | null;
  html_content?: string | null;
  is_active?: number;
  display_order?: number;
}

export interface Video {
  id: string;
  platform: 'tiktok' | 'instagram' | 'upload';
  source: string;
  poster_url?: string | null;
  title?: string | null;
}

export interface StoreConfig {
  config: Record<string, string>;
  assets: Asset[];
  rates: ExchangeRates;
  videos: Video[];
}

const API_URL = process.env.INDIGO_API_URL || 'http://localhost:8787';

/**
 * This is the banner, logo, favicon, social icons and shipping messages -- the
 * things an operator edits in the dashboard and then immediately checks on the
 * storefront. It used to be 10 seconds for exactly that reason: at 60s an edit
 * looked like it had not saved.
 *
 * That 10s was extremely expensive, and not because of this fetch. In the App
 * Router a route's revalidate is the MINIMUM of every fetch inside it, and this
 * one runs in the shared layout -- so it set the window for EVERY page on the
 * site. Each expiry plus a request meant a full page regeneration: an ISR
 * write, a function invocation and origin transfer. With only a handful of real
 * visitors, crawler traffic alone drove 86k of the 200k monthly ISR writes.
 *
 * The window is now long, and freshness comes from `revalidateTag` instead:
 * saving in the dashboard calls /api/revalidate, which drops this tag and the
 * next request rebuilds immediately. The operator sees the edit at once AND
 * idle traffic stops regenerating pages. See app/api/revalidate/route.ts.
 */
const REVALIDATE_SECONDS = 600;

/** Cache tag dropped by /api/revalidate when the dashboard saves. */
export const STORE_CONFIG_TAG = 'store-config';
const FETCH_TIMEOUT_MS = 2500;

function fallbackVideos(): Video[] {
  const feeds = socialFeeds as { tiktok?: string[]; instagram?: string[] };
  const tiktok = (feeds.tiktok ?? []).map((id, i) => ({ id: `tt-${i}`, platform: 'tiktok' as const, source: id }));
  const instagram = (feeds.instagram ?? []).map((id, i) => ({ id: `ig-${i}`, platform: 'instagram' as const, source: id }));
  return [...tiktok, ...instagram];
}

/**
 * Offline snapshot, used when the Worker cannot be reached within
 * FETCH_TIMEOUT_MS.
 *
 * It must only carry STRUCTURAL chrome -- logo, favicon, social icons. Never
 * promotional copy. `assets.json` used to include a `header` banner reading
 * "SE ACEPTAN PAGOS CON CASHEA", captured in May 2026; because this fallback
 * fires on any slow response, that dead promotion reappeared on the live store
 * at random, months after it had been removed from the database, and no amount
 * of editing in the dashboard could get rid of it. Anything time-sensitive
 * belongs in D1 only, where turning it off actually turns it off.
 */
function staticFallback(): StoreConfig {
  const assets = (((assetsRaw as unknown) as { results?: Asset[] }[])[0]?.results) ?? [];
  const rates =
    (((ratesData as unknown) as { results?: ExchangeRates[] }[])[0]?.results?.[0]) ??
    { bcv_fijo: 1, paralelo_fijo: 1, bcv_diario: 1 };
  return { config: {}, assets, rates, videos: fallbackVideos() };
}

export const getStoreConfig = cache(async (): Promise<StoreConfig> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API_URL}/config`, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS, tags: [STORE_CONFIG_TAG] },
    });
    clearTimeout(timer);
    if (!res.ok) return staticFallback();

    const data = (await res.json()) as Partial<StoreConfig>;
    const fallback = staticFallback();
    return {
      config: data.config ?? {},
      // Empty arrays / missing rates fall back so a half-populated D1 never
      // blanks out the storefront chrome.
      assets: data.assets && data.assets.length > 0 ? data.assets : fallback.assets,
      rates: data.rates ?? fallback.rates,
      videos: data.videos && data.videos.length > 0 ? data.videos : fallback.videos,
    };
  } catch {
    return staticFallback();
  }
});

/** Convenience: locate an asset by its asset_type (favicon, logotipo, header, ...). */
export function findAsset(assets: Asset[], assetType: string): Asset | undefined {
  return assets.find((a) => a.asset_type === assetType);
}
