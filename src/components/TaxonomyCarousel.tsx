'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CatalogTaxonomy } from '../lib/catalog';

/**
 * Horizontal carousel of categories or collections. Each entry shows the icon
 * chosen in the dashboard -- inline `svg_code` or `image_url`, per its
 * `display_type` -- and links to that filtered listing.
 */

/**
 * The SVG string comes from the database, so it is treated as untrusted even
 * though only an admin can set it: strip script/foreignObject elements and any
 * event handler or javascript: URL before it reaches innerHTML. This codebase
 * has stored XSS payloads in legacy rows, so injection here is not theoretical.
 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\s*(script|foreignObject|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|foreignObject|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '');
}

function Icon({ item }: { item: CatalogTaxonomy }) {
  const useImage = item.display_type === 'image' && item.image_url;

  if (useImage) {
    return (
      <img
        src={item.image_url as string}
        alt={item.name}
        className="w-10 h-10 object-contain"
        loading="lazy"
      />
    );
  }

  if (item.svg_code && item.svg_code.trim()) {
    return (
      <div
        className="w-10 h-10 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(item.svg_code) }}
      />
    );
  }

  // No icon configured: fall back to the first letter so the row stays even.
  // Guarded because a nameless row must degrade to a blank tile, not take the
  // whole page down with it.
  return (
    <span className="text-xl font-black text-kawaii-pink">
      {(item.name ?? '').charAt(0).toUpperCase()}
    </span>
  );
}

interface TaxonomyCarouselProps {
  title: string;
  items: CatalogTaxonomy[];
  basePath: '/category' | '/collection';
}

export default function TaxonomyCarousel({ title, items, basePath }: TaxonomyCarouselProps) {
  const scroller = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const scrollBy = (delta: number) => {
    scroller.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <section className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{title}</h3>
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => scrollBy(-320)}
            aria-label="Anterior"
            className="w-9 h-9 rounded-full border-2 border-[#ffd2e9] text-kawaii-pink flex items-center justify-center hover:bg-[#fff6fa] transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scrollBy(320)}
            aria-label="Siguiente"
            className="w-9 h-9 rounded-full border-2 border-[#ffd2e9] text-kawaii-pink flex items-center justify-center hover:bg-[#fff6fa] transition-colors cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={`${basePath}/${encodeURIComponent(item.name)}`}
            className="snap-start shrink-0 w-28 sm:w-32 flex flex-col items-center gap-2 group"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-[#ffe0ef] shadow-[0_4px_14px_rgba(255,107,157,0.12)] flex items-center justify-center group-hover:border-kawaii-pink group-hover:-translate-y-1 transition-all">
              <Icon item={item} />
            </div>
            <span className="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2 group-hover:text-kawaii-pink transition-colors">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
