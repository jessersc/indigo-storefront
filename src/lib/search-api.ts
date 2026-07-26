/**
 * Storefront product search. Runs against the Worker (D1) so the browser never
 * needs the whole catalog in memory just to filter it.
 */

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

export interface SearchHit {
  id: string;
  name: string;
  base_price_usd: number;
  compare_at_price_usd?: number | null;
  description?: string | null;
  category?: string | null;
  collection?: string | null;
  image: string;
  stock?: number | null;
}

export async function searchProducts(query: string, limit = 40): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `${API_URL}/catalog/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { products: SearchHit[] };
    return data.products ?? [];
  } catch {
    return [];
  }
}
