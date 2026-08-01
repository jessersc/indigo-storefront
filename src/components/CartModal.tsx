'use client';

import React, { useEffect, useRef } from 'react';
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
 * Cart drawer: a panel on the right at `sm` and up, full screen below.
 *
 * WHY IT IS A DRAWER: the old centred dialog capped its list at 52vh, so with
 * more than two lines the customer scrolled a short window inside a box that
 * was itself floating in a scrollable page. A drawer owns the full height, and
 * on a phone it owns the screen, which is what every storefront does now
 * because it works.
 *
 * WHY EACH LINE IS TWO ROWS: the previous layout put the title and the quantity
 * stepper on ONE row, so a long product name — most of this catalogue — was
 * squeezed into whatever the controls left over and truncated to a single line
 * with an ellipsis. Names now get the full width and wrap to two lines, and the
 * controls sit on their own row underneath. That is the mangling fix; nothing
 * about it is decorative.
 *
 * Per-line selection is unchanged: lines start selected, deselecting parks a
 * line without deleting it, and the totals read from `selectedCartItems` so the
 * number shown is always the number charged.
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

  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes it. Cheap, expected, and the only keyboard way out of a
  // drawer that covers the whole screen on a phone.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  /*
    Lock the page behind the drawer.

    Without this, scrolling inside the drawer on a phone hands the gesture to
    the page underneath once the list hits its end, and the customer loses their
    place in the catalogue. The scroll position is captured and restored because
    `position: fixed` on the body otherwise jumps them back to the top.
  */
  useEffect(() => {
    if (!isOpen) return;
    const y = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, y);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedIds = new Set(selectedCartItems.map((i) => String(i.id)));
  const allSelected = cartItems.length > 0 && selectedCartItems.length === cartItems.length;
  const noneSelected = selectedCartItems.length === 0;
  const totalUnits = cartItems.reduce((n, i) => n + i.quantity, 0);

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
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Tu carrito"
    >
      {/* Click-off to close. */}
      <div
        className="absolute inset-0 bg-kawaii-pink/20 backdrop-blur-sm cart-overlay-in"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="absolute inset-y-0 right-0 w-full sm:w-[27rem] bg-white shadow-2xl flex flex-col
                   sm:rounded-l-[32px] overflow-hidden cart-panel-in"
      >
        {/* ── Header (fixed) ── */}
        <div className="bg-kawaii-pink px-5 sm:px-6 py-5 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5 min-w-0">
            <ShoppingBag size={22} className="flex-shrink-0" />
            <span className="truncate">TU CARRITO ♡</span>
            {totalUnits > 0 && (
              <span className="flex-shrink-0 bg-white/25 rounded-full px-2.5 py-0.5 text-sm">
                {totalUnits}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 hover:bg-white/20 rounded-full text-white transition-colors flex-shrink-0"
            aria-label="Cerrar carrito"
          >
            <X size={24} />
          </button>
        </div>

        {/* ── Bulk actions ── */}
        {cartItems.length > 0 && (
          <div className="px-5 sm:px-6 py-3 flex items-center justify-between border-b border-slate-100 gap-3 flex-shrink-0">
            <button
              onClick={() => setAllCartSelected(!allSelected)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-kawaii-pink transition-colors"
            >
              <span
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                  allSelected ? 'bg-kawaii-pink border-kawaii-pink' : 'border-slate-300'
                }`}
              >
                {allSelected && <Check size={13} className="text-white" strokeWidth={4} />}
              </span>
              {allSelected ? 'Quitar selección' : 'Seleccionar todo'}
            </button>

            <button
              onClick={clearCart}
              className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <Trash2 size={14} />
              Vaciar
            </button>
          </div>
        )}

        {/* ── Lines (the only scrolling region) ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-3">
          {cartItems.length === 0 ? (
            <div className="text-center py-20 px-6">
              <p className="text-slate-400 font-bold italic mb-6">¡Tu carrito está vacío! ✨</p>
              <button
                onClick={onClose}
                className="text-kawaii-pink font-black text-sm uppercase tracking-widest underline"
              >
                Seguir comprando
              </button>
            </div>
          ) : (
            cartItems.map((item) => {
              const itemPrices = calculatePrices(item.base_price_usd || item.USD || 0, rates);
              const isSelected = selectedIds.has(String(item.id));
              const image = item.image || item.Image;
              const variantName =
                typeof item.variant === 'string'
                  ? item.variant
                  : (item.variant as { variant_name?: string } | null)?.variant_name;
              // Stock is refreshed against the live endpoint when the drawer
              // opens, so this ceiling reflects reality rather than whatever was
              // true when the line was added.
              const max = Number.isFinite(Number(item.Stock)) ? Number(item.Stock) : null;
              const atMax = max !== null && max > 0 && item.quantity >= max;

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-3.5 transition-all ${
                    isSelected
                      ? 'bg-white border-slate-200 shadow-sm'
                      : 'bg-slate-50/60 border-dashed border-slate-200 opacity-70'
                  }`}
                >
                  {/* Row 1: checkbox, thumbnail, name. The name gets the whole
                      remaining width here, which is the point. */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleCartSelection(String(item.id))}
                      aria-label={isSelected ? 'Quitar del pedido' : 'Incluir en el pedido'}
                      className={`w-6 h-6 mt-0.5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-kawaii-pink border-kawaii-pink'
                          : 'border-slate-300 hover:border-kawaii-pink'
                      }`}
                    >
                      {isSelected && <Check size={15} className="text-white" strokeWidth={4} />}
                    </button>

                    {image && (
                      <img
                        src={getOptimizedImage(image, 400)}
                        loading="lazy"
                        decoding="async"
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-2xl object-contain bg-slate-50 border border-slate-100 flex-shrink-0"
                        alt=""
                      />
                    )}

                    {/* min-w-0 is what actually allows the text to wrap instead
                        of forcing the flex row wider than the drawer. */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-slate-800 leading-snug line-clamp-2 break-words">
                        {item.name || item.Product}
                      </h4>
                      {variantName && (
                        <span className="text-xs text-kawaii-pink font-bold mt-1 block truncate">
                          Modelo: {variantName}
                        </span>
                      )}
                      <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                        <span className="text-kawaii-pink font-black text-base">
                          ${itemPrices.usd.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          Bs. {itemPrices.bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: controls, clear of the name entirely. */}
                  <div className="flex items-center justify-between gap-3 mt-3 pl-9">
                    <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => updateCartQuantity(String(item.id), item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-kawaii-pink hover:bg-kawaii-light-pink/20 rounded-xl transition-colors"
                        aria-label={`Quitar uno de ${item.name || item.Product}`}
                      >
                        <Minus size={15} />
                      </button>
                      <span className="font-black text-slate-700 min-w-[24px] text-center text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(String(item.id), item.quantity + 1)}
                        disabled={atMax}
                        className="w-8 h-8 flex items-center justify-center text-kawaii-pink hover:bg-kawaii-light-pink/20 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Agregar uno de ${item.name || item.Product}`}
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 min-w-0">
                      {atMax && (
                        <span className="text-[10px] font-black uppercase tracking-wide text-amber-600 truncate">
                          Máx. {max}
                        </span>
                      )}
                      <button
                        onClick={() => removeFromCart(String(item.id))}
                        className="p-2 -mr-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label={`Eliminar ${item.name || item.Product}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer (fixed) ── */}
        {cartItems.length > 0 && (
          <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 flex-shrink-0">
            <div className="flex justify-between items-end gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Total
                  <span className="ml-1 normal-case tracking-normal">
                    ({selectedCartItems.length} de {cartItems.length})
                  </span>
                </p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                  ${totalPrices.usd.toFixed(2)}
                </h3>
              </div>
              <p className="text-xs font-bold text-kawaii-pink font-mono text-right flex-shrink-0">
                Bs. {totalPrices.bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {noneSelected && (
              <p className="text-xs font-bold text-amber-600 text-center">
                Selecciona al menos un producto para continuar.
              </p>
            )}

            <button
              disabled={noneSelected}
              onClick={onCheckout}
              className="w-full bg-kawaii-pink hover:bg-kawaii-pink/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-full font-black text-base tracking-widest kawaii-shadow transition-all hover:scale-[1.02] active:scale-95"
            >
              IR A PAGAR! ♡
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
