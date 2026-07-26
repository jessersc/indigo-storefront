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
 * Kept short on purpose. This is the banner, logo, favicon, social icons and
 * shipping messages -- the things an operator edits in the dashboard and then
 * immediately checks on the storefront. At 60s the edit appeared not to have
 * saved at all, which is worse than the cost of revalidating more often: it is
 * one small JSON fetch, and only on the first request after the window.
 */
const REVALIDATE_SECONDS = 10;
const FETCH_TIMEOUT_MS = 2500;

function fallbackVideos(): Video[] {
  const feeds = socialFeeds as { tiktok?: string[]; instagram?: string[] };
  const tiktok = (feeds.tiktok ?? []).map((id, i) => ({ id: `tt-${i}`, platform: 'tiktok' as const, source: id }));
  const instagram = (feeds.instagram ?? []).map((id, i) => ({ id: `ig-${i}`, platform: 'instagram' as const, source: id }));
  return [...tiktok, ...instagram];
}

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
      next: { revalidate: REVALIDATE_SECONDS },
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
