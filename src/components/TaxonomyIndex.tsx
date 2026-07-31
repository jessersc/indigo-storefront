import React from 'react';
import Link from 'next/link';
import type { CatalogTaxonomy } from '../lib/catalog';

/**
 * A full, browsable index of every category or collection.
 *
 * The home page shows these as horizontal carousels, which is good for
 * discovery and bad for "show me everything" — on mobile a carousel hides most
 * of the list behind a swipe. This is the page the order emails link to, and
 * the one to reach for when you already know roughly what you want.
 *
 * A server component: the list comes from D1 through the catalog fetch, so a
 * category added in the dashboard appears without a rebuild.
 */

interface TaxonomyIndexProps {
  title: string;
  subtitle: string;
  items: CatalogTaxonomy[];
  basePath: '/category' | '/collection';
}

export default function TaxonomyIndex({ title, subtitle, items, basePath }: TaxonomyIndexProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="text-center mb-10 space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 bubble-font">{title}</h1>
        <p className="text-sm md:text-base font-semibold text-slate-500">{subtitle}</p>
      </header>

      {items.length === 0 ? (
        <p className="text-center text-sm font-bold text-slate-400 py-12">
          Todavia no hay nada por aqui.{' '}
          <Link href="/" className="text-kawaii-pink">Ver toda la tienda</Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {items.map((item) => (
            <Link
              key={item.name}
              href={`${basePath}/${encodeURIComponent(item.name)}`}
              className="group bg-white rounded-3xl border-2 border-transparent hover:border-kawaii-pink/30 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-4 flex flex-col items-center gap-3 text-center"
            >
              <div className="w-20 h-20 flex items-center justify-center">
                {/*
                  Icons come from the dashboard as either an uploaded image or
                  pasted SVG, matching the carousels. A category with neither
                  still gets a card — the name is the point, the art is a bonus.
                */}
                {item.display_type === 'svg' && item.svg_code ? (
                  <span
                    className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                    dangerouslySetInnerHTML={{ __html: item.svg_code }}
                  />
                ) : item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <span className="text-3xl">🎀</span>
                )}
              </div>
              <span className="text-sm font-black text-slate-700 leading-tight group-hover:text-kawaii-pink transition-colors">
                {item.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
