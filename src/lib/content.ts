/**
 * Editable storefront content pages (Sobre nosotros / Terminos / Privacidad),
 * authored in the dashboard and stored in D1. Bodies are plain text with
 * blank-line paragraphs -- rendered as escaped text, never as HTML.
 */

const API_URL = process.env.INDIGO_API_URL || 'http://localhost:8787';
const REVALIDATE_SECONDS = 300;

export interface ContentPage {
  slug: string;
  title: string;
  body: string;
  updated_at?: string;
}

export async function getContentPage(slug: string): Promise<ContentPage | null> {
  try {
    const res = await fetch(`${API_URL}/content/${encodeURIComponent(slug)}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { page: ContentPage };
    return data.page ?? null;
  } catch {
    return null;
  }
}

export async function getContentPages(): Promise<ContentPage[]> {
  try {
    const res = await fetch(`${API_URL}/content`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return [];
    const data = (await res.json()) as { pages: ContentPage[] };
    return data.pages ?? [];
  } catch {
    return [];
  }
}

/** Split a body into paragraphs on blank lines. */
export function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
