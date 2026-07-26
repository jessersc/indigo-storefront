'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStorefront } from '../context/StorefrontContext';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';
import ProductGrid from './ProductGrid';
import type { CatalogProduct, CatalogVariant } from '../lib/catalog';

interface FavoritesListProps {
  products: CatalogProduct[];
  variants: CatalogVariant[];
}

export default function FavoritesList({ products, variants }: FavoritesListProps) {
  const router = useRouter();
  const { addToCart, toSlug } = useStorefront();
  const { favorites, count } = useFavorites();
  const { user } = useAuth();

  const favoriteProducts = useMemo(
    () => products.filter((p) => favorites.includes(String(p.id))),
    [products, favorites],
  );

  return (
    <main className="max-w-7xl mx-auto px-6 py-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-4">
        <div className="text-center md:text-left">
          <h3 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4 uppercase">
            Mis Favoritos
            <span className="text-xs font-bold text-slate-400 tracking-widest normal-case">
              ({count} {count === 1 ? 'producto' : 'productos'})
            </span>
          </h3>
          <div className="h-2 w-32 bg-gradient-to-r from-kawaii-pink to-kawaii-yellow rounded-full mt-2 mx-auto md:mx-0 shadow-lg shadow-kawaii-pink/20" />
          {!user && count > 0 && (
            <p className="text-xs text-slate-400 font-bold mt-3">
              Inicia sesion para guardarlos en tu cuenta.
            </p>
          )}
        </div>
        <Link
          href="/"
          className="text-sm font-bold uppercase tracking-widest text-kawaii-pink hover:text-kawaii-purple transition-all flex items-center gap-2 group hover:scale-105 cursor-pointer"
        >
          Ver todo el catalogo
          <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
        </Link>
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-center border-4 border-dashed border-pink-100 rounded-[40px] bg-white">
          <h2 className="text-2xl font-black text-slate-700 mb-4 bubble-font">Aun no tienes favoritos</h2>
          <p className="text-slate-400 max-w-md font-bold mb-8 italic">
            Toca el corazon en cualquier producto para guardarlo aqui.
          </p>
          <Link
            href="/"
            className="bg-kawaii-pink text-white px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-lg cursor-pointer"
          >
            Explorar la tienda
          </Link>
        </div>
      ) : (
        <ProductGrid
          sourceProducts={favoriteProducts}
          sourceVariants={variants}
          activeCategory={null}
          activeCollection={null}
          onAddToCart={addToCart}
          onProductClick={(p) => router.push(`/product/${toSlug(p.Product, p.ItemID)}`)}
        />
      )}
    </main>
  );
}
