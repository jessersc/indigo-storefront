'use client';

import React from 'react';
import { X, Minus, Plus, ShoppingBag, Trash2, Check } from 'lucide-react';
import { calculatePrices } from '../lib/currency';
import { useStorefront, type CartItem } from '../context/StorefrontContext';
import { getOptimizedImage } from '../lib/image';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

/**
 * Cart with per-line selection.
 *
 * Lines start selected, so someone who ignores the checkboxes sees the old
 * behaviour. Deselecting parks a line: it stays in the cart, is excluded from
 * the total, and does not become part of the order. That is why the totals and
 * the checkout button below read from `selectedCartItems` rather than the whole
 * cart — the number shown must be the number charged.
 */
export default function CartModal({ isOpen, onClose, onCheckout }: CartModalProps) {
  const {
    cartItems,
    rates,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    selectedCartItems,
    toggleCartSelection,
    setAllCartSelected,
  } = useStorefront();

  if (!isOpen) return null;

  const selectedIds = new Set(selectedCartItems.map((i) => String(i.id)));
  const allSelected = cartItems.length > 0 && selectedCartItems.length === cartItems.length;
  const noneSelected = selectedCartItems.length === 0;

  // Sum the per-line shelf prices rather than converting the summed cost basis:
  // rounding happens per line, so converting the sum disagrees with the line
  // prices shown below (2 x $0.80 base -> lines $1.50+$1.50 = $3.00, but the
  // summed-then-converted figure is $2.50). Checkout sums the same way.
  const totalPrices = selectedCartItems.reduce(
    (acc, item: CartItem) => {
      const prices = calculatePrices(item.base_price_usd || item.USD || 0, rates);
      acc.usd += prices.usd * item.quantity;
      acc.bs += prices.bs * item.quantity;
      return acc;
    },
    { usd: 0, bs: 0 },
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-kawaii-pink/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-kawaii-pink px-8 py-6 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <ShoppingBag size={24} />
            TU CARRITO ♡
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
            aria-label="Cerrar carrito"
          >
            <X size={24} />
          </button>
        </div>

        {/* Bulk actions */}
        {cartItems.length > 0 && (
          <div className="px-6 md:px-8 py-3 flex items-center justify-between border-b border-slate-100 gap-3">
            <button
              onClick={() => setAllCartSelected(!allSelected)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-kawaii-pink transition-colors"
            >
              <span
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  allSelected ? 'bg-kawaii-pink border-kawaii-pink' : 'border-slate-300'
                }`}
              >
                {allSelected && <Check size={13} className="text-white" strokeWidth={4} />}
              </span>
              {allSelected ? 'Quitar selección' : 'Seleccionar todo'}
            </button>

            <button
              onClick={clearCart}
              className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
              Vaciar carrito
            </button>
          </div>
        )}

        {/* Lines */}
        <div className="max-h-[52vh] overflow-y-auto p-6 md:p-8 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 font-bold italic">¡Tu carrito está vacío! ✨</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const itemPrices = calculatePrices(item.base_price_usd || item.USD || 0, rates);
              const isSelected = selectedIds.has(String(item.id));
              const image = item.image || item.Image;
              return (
                <div
                  key={item.id}
                  className={`flex gap-3 items-center p-4 rounded-3xl border transition-all ${
                    isSelected
                      ? 'bg-slate-50 border-slate-100'
                      : 'bg-white border-dashed border-slate-200 opacity-60'
                  }`}
                >
                  <button
                    onClick={() => toggleCartSelection(String(item.id))}
                    aria-label={isSelected ? 'Quitar del pedido' : 'Incluir en el pedido'}
                    className={`w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-kawaii-pink border-kawaii-pink' : 'border-slate-300 hover:border-kawaii-pink'
                    }`}
                  >
                    {isSelected && <Check size={15} className="text-white" strokeWidth={4} />}
                  </button>

                  {image && (
                    <img src={getOptimizedImage(image, 400)} loading="lazy" decoding="async" className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" alt={item.name || item.Product} />
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-slate-800 line-clamp-1">
                      {item.name || item.Product}
                    </h4>
                    {item.variant && (
                      <span className="text-xs text-kawaii-pink font-bold mt-0.5 block">
                        Modelo: {typeof item.variant === 'string' ? item.variant : (item.variant as any).variant_name}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-kawaii-pink font-black text-sm">${itemPrices.usd.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400">| Bs. {itemPrices.bs.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => updateCartQuantity(String(item.id), item.quantity - 1)}
                        className="text-kawaii-pink hover:scale-125 transition-transform"
                        aria-label="Quitar uno"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-slate-700 min-w-[18px] text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(String(item.id), item.quantity + 1)}
                        className="text-kawaii-pink hover:scale-125 transition-transform"
                        aria-label="Agregar uno"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(String(item.id))}
                      className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Total a pagar
                {cartItems.length > 0 && (
                  <span className="ml-1 normal-case tracking-normal text-slate-400">
                    ({selectedCartItems.length} de {cartItems.length})
                  </span>
                )}
              </p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                ${totalPrices.usd.toFixed(2)}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-kawaii-pink font-mono">
                Bs. {totalPrices.bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {noneSelected && cartItems.length > 0 && (
            <p className="text-xs font-bold text-amber-600 text-center">
              Selecciona al menos un producto para continuar.
            </p>
          )}

          <button
            disabled={noneSelected}
            onClick={onCheckout}
            className="w-full bg-kawaii-pink hover:bg-kawaii-pink/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-full font-black text-lg tracking-widest kawaii-shadow transition-all hover:scale-[1.02] active:scale-95"
          >
            IR A PAGAR! ♡
          </button>
        </div>
      </div>
    </div>
  );
}
