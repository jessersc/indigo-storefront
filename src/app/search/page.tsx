'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useStorefront, HIDE_PRODUCTS_WITHOUT_IMAGE } from '../../context/StorefrontContext';
import { getOptimizedImage } from '../../lib/image';
import { toDisplayProduct } from '../../lib/catalog';
import { searchProducts } from '../../lib/search-api';

function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/['’"`]/g, '') // remove apostrophes/quotes
    .replace(/[^\w\s-]/g, '') // remove emojis/punctuation
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawQuery = searchParams.get('q') || '';
  const cleanQuery = rawQuery.trim();

  const { addToCart, toSlug, rates } = useStorefront();
  const [matchingProducts, setMatchingProducts] = useState<any[]>([]);

  useEffect(() => {
    const query = cleanQuery;
    if (query.length < 2) {
      setMatchingProducts([]);
      return;
    }

    let cancelled = false;
    searchProducts(query, 60).then((hits) => {
      if (cancelled) return;
      // Same mapper the grid uses, so prices match everywhere.
      setMatchingProducts(hits.map((p) => toDisplayProduct(p as never, rates)));
    });

    return () => { cancelled = true; };
  }, [cleanQuery, rates]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-20 animate-in fade-in duration-500">
      {/* Dynamic SEO/Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-4">
        <div className="text-center md:text-left">
          <h3 className="text-4xl font-black text-slate-800 tracking-tight flex flex-col md:flex-row md:items-center gap-4 uppercase">
            <span>Resultados de búsqueda</span>
            {cleanQuery && (
              <span className="text-kawaii-pink text-3xl font-bold font-sans lowercase italic">
                "{cleanQuery}"
              </span>
            )}
            <span className="text-xs font-bold text-slate-400 font-sans tracking-widest normal-case">
              ({matchingProducts.length} {matchingProducts.length === 1 ? 'producto encontrado' : 'productos encontrados'})
            </span>
          </h3>
          <div className="h-2 w-32 bg-gradient-to-r from-kawaii-pink to-kawaii-yellow rounded-full mt-2 mx-auto md:mx-0 shadow-lg shadow-kawaii-pink/20"></div>
        </div>
        <Link 
          href="/" 
          className="text-sm font-bold uppercase tracking-widest text-kawaii-pink hover:text-kawaii-purple transition-all flex items-center gap-2 group hover:scale-105 cursor-pointer"
        >
          Ver todo el catálogo
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>

      {/* Product Results */}
      {matchingProducts.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-center border-4 border-dashed border-pink-100 rounded-[40px] bg-white">
          <h2 className="text-2xl font-black text-slate-700 mb-4 bubble-font">No se encontraron productos 😿</h2>
          <p className="text-slate-400 max-w-md font-bold mb-8 italic">
            Lo sentimos, no pudimos encontrar ningún artículo que coincida con tu búsqueda. Intenta usar otros términos.
          </p>
          <Link 
            href="/" 
            className="bg-kawaii-pink text-white px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-lg cursor-pointer"
          >
            Volver a la tienda
          </Link>
        </div>
      ) : (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
          {matchingProducts.map((product) => (
            <div 
              key={product.ItemID} 
              className="product-card-kawaii group relative flex flex-col h-full bg-white rounded-[32px] overflow-hidden shadow-lg border-2 border-transparent hover:border-kawaii-pink/30 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer"
              onClick={() => {
                const slug = toSlug(product.Product, product.ItemID);
                router.push(`/product/${slug}`);
              }}
            >
              {/* Badge de Oferta */}
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                {product.CompareAtPrice && (
                  <span className="bg-[#ff0000] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-widest">
                    -{Math.round((1 - (product.USD / product.CompareAtPrice)) * 100)}%
                  </span>
                )}
                {/*
                  Gated on IsNew like the grid. Search receives only the matching
                  rows, never the whole catalogue, so it cannot know the global
                  newest-20 and this stays false here -- which beats the old
                  behaviour of calling every result "Nuevo".
                */}
                {!product.CompareAtPrice && product.IsNew && (
                  <span className="bg-kawaii-yellow text-kawaii-dark text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-widest">
                    Nuevo ✨
                  </span>
                )}
              </div>

              {/* Image Container */}
              <div className="relative aspect-square overflow-hidden bg-slate-50 p-4">
                <img 
                  src={getOptimizedImage(product.Image, 300)} 
                  alt={product.Product}
                  onError={(e) => {
                    (e.target as any).src = 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&q=80&w=400';
                  }}
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700"
                />
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col flex-grow text-center">
                <h3 className="text-sm md:text-base font-black text-slate-800 line-clamp-2 leading-tight mb-3 min-h-[2.5rem] bubble-font">
                  {product.Product}
                </h3>

                <div className="flex flex-col items-center gap-1 mb-6">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      {product.CompareAtPrice && (
                        <span className="text-sm font-bold text-slate-400 line-through">${product.CompareAtPrice.toFixed(2)}</span>
                      )}
                      <span className={`text-xl md:text-2xl font-black tracking-tight ${product.CompareAtPrice ? 'text-[#ff0000]' : 'text-kawaii-pink'}`}>
                        ${product.USD.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-slate-300 text-lg">|</span>
                    <span className="text-xs md:text-sm font-bold text-slate-400">Bs {product.Bs.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-auto space-y-3 pt-2 border-t border-slate-50">
                  <button 
                    className="w-full py-3 rounded-full border-2 border-kawaii-pink text-kawaii-pink font-black text-[10px] uppercase tracking-[0.15em] hover:bg-kawaii-pink hover:text-white transition-all bubble-font cursor-pointer"
                  >
                    SELECCIONAR MODELO
                  </button>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                      className="flex-1 py-3 bg-kawaii-light-pink/20 text-kawaii-pink rounded-full hover:bg-kawaii-pink hover:text-white transition-all flex items-center justify-center cursor-pointer"
                    >
                      <ShoppingCart size={18} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-xl font-bold text-kawaii-pink animate-pulse">Buscando en la Tienda Mágica... ✨</div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
