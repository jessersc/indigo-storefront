'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Heart } from 'lucide-react';
import productsData from '../lib/products.json';
import variantsData from '../lib/variants.json';
import {
  toDisplayProduct, visibleProducts,
  type CatalogProduct, type CatalogVariant, type DisplayProduct,
} from '../lib/catalog';
import { HIDE_PRODUCTS_WITHOUT_IMAGE, useStorefront } from '../context/StorefrontContext';
import {
  resolveStockStatus,
  isPurchasable,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_CLASSES,
} from '../lib/stock-status';
import { useFavorites } from '../context/FavoritesContext';

// Bundled snapshots: used only when a caller does not pass live D1 data.
const fallbackProducts: CatalogProduct[] = ((productsData as any)[0]?.results) || [];
const fallbackVariants: CatalogVariant[] = ((variantsData as any)[0]?.results) || [];

interface ProductGridProps {
  /** Live catalog from D1. Falls back to the bundled snapshot when omitted. */
  sourceProducts?: CatalogProduct[];
  sourceVariants?: CatalogVariant[];
  activeCategory: string | null;
  activeCollection: string | null;
  activePromotion?: boolean;
  limit?: number;
  randomize?: boolean;
  onAddToCart: (product: any) => void;
  onProductClick: (product: any) => void;
}

export default function ProductGrid({ 
  sourceProducts,
  sourceVariants,
  activeCategory, 
  activeCollection, 
  activePromotion,
  limit,
  randomize,
  onAddToCart, 
  onProductClick 
}: ProductGridProps) {
  const router = useRouter();
  const { addToCart, rates } = useStorefront();
  const { isFavorite, toggleFavorite } = useFavorites();

  const rawProducts = sourceProducts ?? fallbackProducts;
  const variantsRaw = sourceVariants ?? fallbackVariants;

  // Rebuilt when the catalog or the rates change, so a rate edit in the
  // dashboard reprices the grid without a rebuild.
  const products: DisplayProduct[] = useMemo(() => {
    const list = HIDE_PRODUCTS_WITHOUT_IMAGE ? visibleProducts(rawProducts) : rawProducts;
    return list.map((p) => toDisplayProduct(p, rates));
  }, [rawProducts, rates]);

  const handleBuyNow = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    addToCart(product, 1);
    router.push('/checkout');
  };
  
  // Memoized: the shuffle ran during render, so ANY state change (favoriting a
  // product, opening the cart) reshuffled the grid under the customer. Keeping
  // it in a memo means the selection only changes when the inputs actually do.
  const filteredProducts = useMemo(() => {
    let list = products.filter(p => {
      if (activePromotion && !p.CompareAtPrice) return false;
      if (activeCategory) {
        const cats = p.Category.split(',').map(s => s.trim());
        if (!cats.includes(activeCategory)) return false;
      }
      if (activeCollection) {
        const cols = p.Collection.split(',').map(s => s.trim());
        if (!cols.includes(activeCollection)) return false;
      }
      return true;
    });

    if (randomize) {
      list = [...list].sort(() => Math.random() - 0.5);
    }

    return limit ? list.slice(0, limit) : list;
  }, [products, activeCategory, activeCollection, activePromotion, randomize, limit]);

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
      {filteredProducts.map((product) => {
        const productVariants = variantsRaw.filter((v: any) => String(v.parent_id) === String(product.ItemID));
        const hasVariants = productVariants.length > 0 && productVariants.some((v: any) => v.variant_name !== 'Default');

        // product.Stock is already EFFECTIVE stock (the Worker subtracted live
        // reservations), so an item whose last units are held reads as sold out
        // here rather than tempting a customer into a checkout that will fail.
        const cardStatus = resolveStockStatus(product.StockStatus, product.Stock);
        const cardPurchasable = isPurchasable(product.StockStatus, product.Stock);

        return (
          <div 
            key={product.ItemID} 
            className="product-card-kawaii group relative flex flex-col h-full bg-white rounded-[32px] overflow-hidden shadow-lg border-2 border-transparent hover:border-kawaii-pink/30 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer"
            onClick={() => onProductClick(product)}
          >
          {/* Favorito */}
          <button
            type="button"
            aria-label={isFavorite(product.ItemID) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(product.ItemID); }}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur border border-[#ffe0ef] flex items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-pointer"
          >
            <Heart
              size={17}
              className={isFavorite(product.ItemID) ? 'text-kawaii-pink' : 'text-slate-300'}
              fill={isFavorite(product.ItemID) ? 'currentColor' : 'none'}
            />
          </button>

          {/* Badge de Oferta */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            {product.CompareAtPrice && (
              <span className="bg-[#ff0000] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-widest">
                -{Math.round((1 - (product.USD / product.CompareAtPrice)) * 100)}%
              </span>
            )}
            {!product.CompareAtPrice && (
              <span className="bg-kawaii-yellow text-kawaii-dark text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-widest">
                Nuevo ✨
              </span>
            )}
          </div>

          {/* Image Container */}
          <div className="relative aspect-square overflow-hidden bg-slate-50 p-4">
            <img 
              src={product.Image} 
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
              {/* Availability badge. Only shown when it is worth saying: a
                  fully-stocked item does not need a label, but running low,
                  sold out, or withdrawn all change what the customer does. */}
              {cardStatus !== 'in_stock' && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${STOCK_STATUS_CLASSES[cardStatus]}`}
                >
                  {STOCK_STATUS_LABELS[cardStatus]}
                </span>
              )}

              {hasVariants ? (
                <button
                  className="w-full py-3 rounded-full border-2 border-kawaii-pink text-kawaii-pink font-black text-[10px] uppercase tracking-[0.15em] hover:bg-kawaii-pink hover:text-white transition-all bubble-font"
                >
                  SELECCIONAR MODELO
                </button>
              ) : !cardPurchasable ? (
                <button
                  disabled
                  onClick={(e) => e.stopPropagation()}
                  className="w-full py-3 rounded-full bg-slate-100 text-slate-400 border-2 border-slate-200 font-black text-[10px] uppercase tracking-[0.15em] cursor-not-allowed bubble-font"
                >
                  {STOCK_STATUS_LABELS[cardStatus]}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-full py-3 bg-kawaii-pink text-white rounded-full font-black text-[10px] uppercase tracking-[0.15em] hover:scale-[1.02] active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 bubble-font"
                  >
                    <ShoppingCart size={14} strokeWidth={3} />
                    AGREGAR AL CARRITO
                  </button>
                  <button
                    onClick={(e) => handleBuyNow(e, product)}
                    className="w-full py-3 bg-white text-kawaii-pink border-2 border-kawaii-pink rounded-full font-black text-[10px] uppercase tracking-[0.15em] hover:bg-kawaii-light-pink/10 transition-all bubble-font"
                  >
                    COMPRAR AHORA
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })}
    </section>
  );
}
