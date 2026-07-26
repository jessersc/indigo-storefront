'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

/** Time between automatic steps while the strip is idle. */
const AUTO_ADVANCE_MS = 2800;
/**
 * How long to stay still after someone uses an arrow. Deliberately much longer
 * than the idle cadence: a customer who just navigated is reading, and having
 * the row slide out from under them is worse than not moving at all.
 */
const RESUME_AFTER_INPUT_MS = 9000;

export default function TaxonomyCarousel({ title, items, basePath }: TaxonomyCarouselProps) {
  const scroller = useRef<HTMLDivElement>(null);
  /** Set while the pointer/focus is inside, or briefly after an arrow press. */
  const [paused, setPaused] = useState(false);
  /** False while the strip is scrolled off-screen, so it idles in the background. */
  const [visible, setVisible] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * One card plus its gap, measured rather than hard-coded: the card is w-28 at
   * mobile and w-32 from `sm` up, so a fixed pixel step would drift out of
   * alignment at one breakpoint or the other.
   */
  const stepSize = useCallback((cards: number) => {
    const el = scroller.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return 320 * cards;
    const gap = parseFloat(getComputedStyle(el).columnGap || '16') || 16;
    return (first.offsetWidth + gap) * cards;
  }, []);

  /** Scroll by whole cards, wrapping at either end so the row never dead-ends. */
  const advance = useCallback(
    (cards: number) => {
      const el = scroller.current;
      if (!el) return;
      const delta = stepSize(cards);
      // 1px of slack: fractional scroll positions mean the end rarely lands exact.
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      const atStart = el.scrollLeft <= 1;

      if (delta > 0 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
      else if (delta < 0 && atStart) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      else el.scrollBy({ left: delta, behavior: 'smooth' });
    },
    [stepSize],
  );

  /** Arrow press: move a screenful-ish, then hold still while they look. */
  const nudge = (cards: number) => {
    advance(cards);
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), RESUME_AFTER_INPUT_MS);
  };

  // Only animate while actually on screen. Without this the timer keeps firing
  // for a carousel far below the fold, scrolling it for nobody.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // Honour the OS "reduce motion" setting: unprompted movement is exactly what
    // that preference exists to stop.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || paused || !visible) return;

    const id = setInterval(() => advance(1), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, visible, advance]);

  // A pending resume must not fire into an unmounted component.
  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{title}</h3>
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => nudge(-3)}
            aria-label="Anterior"
            className="w-9 h-9 rounded-full border-2 border-[#ffd2e9] text-kawaii-pink flex items-center justify-center bg-white/70 hover:bg-kawaii-pink hover:border-kawaii-pink hover:text-white hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kawaii-pink focus-visible:ring-offset-2 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => nudge(3)}
            aria-label="Siguiente"
            className="w-9 h-9 rounded-full border-2 border-[#ffd2e9] text-kawaii-pink flex items-center justify-center bg-white/70 hover:bg-kawaii-pink hover:border-kawaii-pink hover:text-white hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kawaii-pink focus-visible:ring-offset-2 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/*
        Pause on hover, on touch, and on keyboard focus. focus-within matters for
        more than tidiness: tabbing through the links moves the scroll container
        natively, and an auto-advance firing at the same time fights the caret.
      */}
      <div
        ref={scroller}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
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
