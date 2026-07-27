'use client';

import React, { useState } from 'react';
import { Minus, Plus, ShoppingBag, ArrowLeft, Check, Clipboard, Heart } from 'lucide-react';
import { useStorefront } from '../context/StorefrontContext';
import { useFavorites } from '../context/FavoritesContext';
import {
  resolveStockStatus,
  isPurchasable,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_CLASSES,
} from '../lib/stock-status';
import { resolvePaymentMethods } from '../lib/payment-methods';

interface Product {
  ItemID: string;
  Product: string;
  USD: number;
  Bs: number;
  Category: string;
  Collection: string;
  Image: string;
  Description: string;
  Stock: number;
}

interface ProductDetailProps {
  product: Product;
  variants?: any[];
  onAddToCart: (product: any, quantity: number) => void;
  onCheckout: (product: any, quantity: number) => void;
  onBack: () => void;
}

export default function ProductDetail({ product, variants, onAddToCart, onCheckout, onBack }: ProductDetailProps) {
  const { assets, config } = useStorefront();
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(product.ItemID);

  // Dashboard-editable (Imagenes y banner -> Shipping Price Message). Only
  // active assets reach the storefront, so toggling it off hides the line.
  const shippingPriceMessage = (assets || []).find(
    (a: any) => a.asset_type === 'shipping_price_message',
  )?.html_content?.trim();

  const hasVariants = variants && variants.length > 0 && variants.some((v: any) => v.variant_name !== 'Default');

  const [quantity, setQuantity] = useState(hasVariants ? 1 : 1);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);

  const rawMaxStock = hasVariants
    ? (selectedVariant ? selectedVariant.stock_count : 0)
    : product.Stock;

  // The operator's override wins over the count for how this is presented, and
  // 'unavailable' / 'out_of_stock' block the sale outright.
  const stockStatus = resolveStockStatus((product as any).StockStatus, rawMaxStock);
  const purchasable = isPurchasable((product as any).StockStatus, rawMaxStock);
  const maxStock = purchasable ? rawMaxStock : 0;

  const displayImage = (selectedVariant && selectedVariant.image_path)
    ? selectedVariant.image_path
    : product.Image;

  const handleVariantSelect = (v: any) => {
    setSelectedVariant(v);
    if (v.stock_count > 0) {
      setQuantity(1);
    } else {
      setQuantity(0);
    }
  };

  const handleAddToCart = () => {
    onAddToCart({ ...product, variant: selectedVariant }, quantity);
  };

  /*
    Accepted payment methods, from the same shared definitions the checkout
    uses. This was a second hardcoded list with the icons rewritten as JSX, so
    the two screens could — and did — disagree: the product page advertised
    methods the checkout no longer offered, and neither honoured
    `methods_enabled` or any dashboard-supplied icon.
  */
  const paymentMethods = React.useMemo(
    () => resolvePaymentMethods(config, assets),
    [config, assets],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-kawaii-pink font-bold mb-8 hover:translate-x-1 transition-transform group"
      >
        <div className="bg-kawaii-light-pink/20 p-2 rounded-full group-hover:bg-kawaii-pink group-hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </div>
        Volver al inicio
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left: Image */}
        <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-50">
          <div className="aspect-square relative overflow-hidden rounded-[32px] bg-slate-50">
            <img
              src={displayImage}
              alt={product.Product}
              className="w-full h-full object-contain p-4"
            />

            {/* Favourite toggle. The grid card had one but the detail page did
                not, so the only way to save a product was from the listing. */}
            <button
              type="button"
              onClick={() => toggleFavorite(product.ItemID)}
              aria-label={saved ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              title={saved ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/90 backdrop-blur border border-[#ffe0ef] shadow-md flex items-center justify-center text-kawaii-pink hover:scale-110 active:scale-95 transition-transform"
            >
              <Heart size={22} strokeWidth={2.5} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Right: Info */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-4 bubble-font">{product.Product}</h1>
            <div className="flex items-center gap-4">
               <span className="text-3xl md:text-4xl font-black text-kawaii-pink">${product.USD.toFixed(2)}</span>
               <span className="text-2xl text-slate-300">|</span>
               <span className="text-lg md:text-xl font-bold text-slate-400">Bs {product.Bs.toFixed(2)}</span>
            </div>
            {shippingPriceMessage && (
              <p className="mt-2 text-kawaii-pink text-sm font-bold flex items-center gap-2 italic">
                📍 {shippingPriceMessage}
              </p>
            )}

            {/* Availability, straight from the resolved status so the badge and
                the buy buttons can never disagree. */}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${STOCK_STATUS_CLASSES[stockStatus]}`}
              >
                {STOCK_STATUS_LABELS[stockStatus]}
              </span>
              {stockStatus === 'low_stock' && rawMaxStock > 0 && (
                <span className="text-xs font-bold text-amber-600">
                  Quedan {rawMaxStock} unidad{rawMaxStock === 1 ? '' : 'es'}
                </span>
              )}
              {stockStatus === 'unavailable' && (
                <span className="text-xs font-semibold text-slate-400">
                  Este producto no esta a la venta por ahora.
                </span>
              )}
            </div>
          </div>

          <p className="text-slate-500 leading-relaxed font-medium">
            {product.Description || 'Sin descripción disponible para este producto.'}
          </p>

          {/* Modelos / Variantes */}
          {hasVariants && (
            <div className="space-y-4">
              <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Selecciona el modelo que deseas:</h4>
              <div className="grid grid-cols-1 gap-3">
                  {variants?.map((v) => (
                    <div 
                     key={v.id}
                     onClick={() => handleVariantSelect(v)}
                     className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                       selectedVariant?.id === v.id 
                       ? 'border-kawaii-pink bg-kawaii-light-pink/10' 
                       : 'border-slate-100 hover:border-kawaii-pink/30'
                     }`}
                    >
                      <div className="flex items-center gap-3">
                        {v.image_path && (
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 flex-shrink-0 bg-slate-50">
                            <img 
                              src={v.image_path} 
                              alt={v.variant_name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <span className="font-bold text-slate-700">{v.variant_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-xs text-slate-400 font-bold">Stock: {v.stock_count}</span>
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                           selectedVariant?.id === v.id ? 'border-kawaii-pink bg-kawaii-pink text-white' : 'border-slate-200'
                         }`}>
                           {selectedVariant?.id === v.id && <Check size={14} strokeWidth={4} />}
                         </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Cantidad */}
          <div className="space-y-4">
            <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Quantity:</h4>
            <div className="flex items-center gap-6">
              <div className="flex items-center bg-slate-100 p-1.5 rounded-full border-2 border-slate-50 shadow-inner">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || maxStock === 0}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-kawaii-pink hover:bg-kawaii-pink hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-kawaii-pink disabled:cursor-not-allowed"
                >
                  <Minus size={18} strokeWidth={3} />
                </button>
                <span className="w-12 text-center font-black text-lg text-slate-700">{quantity}</span>
                <button 
                  onClick={() => setQuantity(Math.min(maxStock, quantity + 1))}
                  disabled={quantity >= maxStock || maxStock === 0}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-kawaii-pink hover:bg-kawaii-pink hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-kawaii-pink disabled:cursor-not-allowed"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col gap-4">
            {(() => {
              let addToCartText = "Agregar al Carrito";
              let isAddToCartDisabled = false;

              if (hasVariants) {
                if (!selectedVariant) {
                  addToCartText = "Selecciona un modelo";
                  isAddToCartDisabled = true;
                } else if (selectedVariant.stock_count === 0) {
                  addToCartText = "Agotado";
                  isAddToCartDisabled = true;
                }
              } else {
                if (product.Stock === 0) {
                  addToCartText = "Agotado";
                  isAddToCartDisabled = true;
                }
              }

              return (
                <button 
                  onClick={handleAddToCart}
                  disabled={isAddToCartDisabled}
                  className="w-full bg-kawaii-pink text-white py-5 rounded-full font-black text-lg uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 bubble-font disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <ShoppingBag size={24} />
                  {addToCartText}
                </button>
              );
            })()}
            {!hasVariants && (
              <button 
                onClick={() => onCheckout({ ...product, variant: selectedVariant }, quantity)}
                disabled={product.Stock === 0}
                className="w-full bg-white text-kawaii-pink border-2 border-kawaii-pink py-5 rounded-full font-black text-lg uppercase tracking-widest hover:bg-kawaii-light-pink/10 transition-all bubble-font disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Comprar ahora
              </button>
            )}
          </div>

          {/* Métodos de Pago */}
          <div className="pt-8 border-t border-slate-100">
             <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-6 text-center">Métodos de pago disponibles:</h4>
             <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {paymentMethods.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col items-center gap-2 hover:bg-kawaii-light-pink/5 transition-colors shadow-sm">
                    {m.iconUrl ? (
                      <img src={m.iconUrl} alt="" className="w-6 h-6 object-contain" loading="lazy" />
                    ) : (
                      <span
                        className="flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
                        dangerouslySetInnerHTML={{ __html: m.svg }}
                      />
                    )}
                    <span className="text-[10px] font-bold text-slate-400 uppercase text-center leading-tight">
                      {m.title}
                    </span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
