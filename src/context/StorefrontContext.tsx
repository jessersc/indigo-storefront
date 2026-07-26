'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import ratesData from '../lib/rates.json';
import productsRaw from '../lib/products.json';
import assetsRaw from '../lib/assets.json';
import { useAuth } from './AuthContext';

/**
 * Legacy switch, now OFF.
 *
 * The store used to hide any product without an image, which meant a product
 * saved before its photo was ready simply vanished with no explanation — 87 of
 * 806 products were invisible this way. Visibility is now an explicit operator
 * decision: the "No disponible" status in the dashboard. Products without a
 * photo show a placeholder instead of disappearing.
 *
 * Kept as a constant (rather than deleted) because several views branch on it;
 * flip it back only if you want the old automatic behaviour.
 */
export const HIDE_PRODUCTS_WITHOUT_IMAGE = false;

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';
const CART_STORAGE_KEY = 'indigo_cart';

export interface ExchangeRates {
  bcv_fijo: number;
  paralelo_fijo: number;
  bcv_diario: number;
}

export interface CalculatedPrices {
  usd_real: number;
  usd: number;
  bs: number;
}

export interface CartItem {
  ItemID: string;
  Product: string;
  USD: number;
  Bs: number;
  Category: string;
  Collection: string;
  Image: string;
  Description: string;
  Stock: number;
  variant?: string | null;
  quantity: number;
  id?: string;
  name?: string;
  image?: string;
  base_price_usd?: number;
  /**
   * Whether this line goes to checkout. New lines start selected, so the
   * default behaviour is unchanged for anyone who never touches the
   * checkboxes; deselecting is how you park something for later without
   * losing it.
   */
  selected?: boolean;
}

interface StorefrontContextType {
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, qty: number) => void;
  clearCart: () => void;
  /** Lines ticked for checkout. Only these become an order. */
  selectedCartItems: CartItem[];
  toggleCartSelection: (itemId: string) => void;
  setAllCartSelected: (selected: boolean) => void;
  /** Drop specific lines, leaving the rest of the cart intact. */
  removeCartItems: (itemIds: string[]) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  activeCategory: string | null;
  setActiveCategory: (cat: string | null) => void;
  activeCollection: string | null;
  setActiveCollection: (col: string | null) => void;
  activePromotion: boolean;
  setActivePromotion: (promo: boolean) => void;
  toast: { show: boolean; message: string } | null;
  setToast: (toast: { show: boolean; message: string } | null) => void;
  rates: ExchangeRates;
  assets: any[];
  config: Record<string, string>;
  videos: any[];
  categories: string[];
  collections: string[];
  toSlug: (name: string, id: string) => string;
}

const StorefrontContext = createContext<StorefrontContextType | undefined>(undefined);

function readLocalCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCart(items: CartItem[]): void {
  if (items.length > 0) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } else {
    localStorage.removeItem(CART_STORAGE_KEY);
  }
}

/** The variant identifier a cart line keys on: the variant name, or none. */
function variantKeyFor(item: { variant?: any }): string {
  const v = item?.variant;
  const name = v?.variant_name || (typeof v === 'string' ? v : null);
  return name || '';
}

function itemToWire(item: CartItem) {
  return {
    productId: String(item.ItemID ?? item.id),
    variantId: variantKeyFor(item) || null,
    quantity: item.quantity,
    snapshot: item,
  };
}

function wireToItem(entry: { productId: string; variantId?: string | null; quantity: number; snapshot?: unknown }): CartItem {
  const snapshot = (entry.snapshot && typeof entry.snapshot === 'object' ? entry.snapshot : {}) as Partial<CartItem>;
  const uniqueId = entry.variantId ? `${entry.productId}-${entry.variantId}` : String(entry.productId);
  return {
    ...(snapshot as CartItem),
    id: uniqueId,
    ItemID: entry.productId,
    quantity: entry.quantity,
  };
}

export function toSlug(name: string, id: string): string {
  if (!name) return id;
  // Convert basic Spanish characters and lowercase
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip accents
  
  const cleaned = normalized
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric chars
    .trim()
    .replace(/\s+/g, '-') // convert spaces to hyphens
    .replace(/-+/g, '-'); // squeeze multiple hyphens
  
  return `${cleaned}-${id}`;
}

export function parseIdFromSlug(slug: string): string {
  const parts = slug.split('-');
  return parts[parts.length - 1];
}

interface StorefrontProviderProps {
  children: React.ReactNode;
  // Server-loaded, dashboard-controlled config. When absent (or empty) the
  // bundled static JSON is used so the provider still works standalone/offline.
  initialAssets?: any[];
  initialRates?: ExchangeRates;
  initialConfig?: Record<string, string>;
  initialVideos?: any[];
  initialCategories?: string[];
  initialCollections?: string[];
}

export const StorefrontProvider: React.FC<StorefrontProviderProps> = ({
  children,
  initialAssets,
  initialRates,
  initialConfig,
  initialVideos,
  initialCategories,
  initialCollections,
}) => {
  const { token, user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const mergedCartFor = useRef<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [activePromotion, setActivePromotion] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string } | null>(null);

  const commitCart = useCallback((next: CartItem[]) => {
    cartRef.current = next;
    setCartItems(next);
  }, []);

  // Load cart from localStorage after hydration. This is the guest baseline;
  // if a customer is signed in, the merge effect below replaces it with the
  // account's D1 cart right after.
  useEffect(() => {
    commitCart(readLocalCart());
  }, [commitCart]);

  // Sync cart to localStorage -- only while browsing as a guest. A signed-in
  // customer's cart lives in D1; leaving a copy in localStorage would let a
  // stale account cart resurface after logging out on the same browser.
  useEffect(() => {
    if (token) return;
    writeLocalCart(cartItems);
  }, [cartItems, token]);

  // On sign-in, merge the guest cart into the account and adopt the result,
  // same pattern as favorites (FavoritesContext.tsx). Runs once per user id.
  useEffect(() => {
    if (!token || !user) {
      mergedCartFor.current = null;
      return;
    }
    if (mergedCartFor.current === user.id) return;
    mergedCartFor.current = user.id;

    const guestItems = readLocalCart();
    fetch(`${API_URL}/account/cart/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: guestItems.map(itemToWire) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: Array<{ productId: string; variantId?: string | null; quantity: number; snapshot?: unknown }> } | null) => {
        if (!data?.items) return;
        commitCart(data.items.map(wireToItem));
        localStorage.removeItem(CART_STORAGE_KEY);
      })
      .catch(() => {});
  }, [token, user, commitCart]);

  const syncUpsert = useCallback((item: CartItem) => {
    if (!token) return;
    fetch(`${API_URL}/account/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(itemToWire(item)),
    }).catch(() => {});
  }, [token]);

  const syncRemove = useCallback((item: CartItem) => {
    if (!token) return;
    const variantId = variantKeyFor(item) || '_';
    fetch(`${API_URL}/account/cart/${encodeURIComponent(String(item.ItemID))}/${encodeURIComponent(variantId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [token]);

  const staticRates = ((ratesData as any)[0]?.results?.[0]) || { bcv_fijo: 1, paralelo_fijo: 1, bcv_diario: 1 };
  const staticAssets = ((assetsRaw as any)[0]?.results) || [];
  const rates = initialRates ?? staticRates;
  const assets = initialAssets && initialAssets.length > 0 ? initialAssets : staticAssets;
  const config = initialConfig ?? {};
  const videos = initialVideos ?? [];
  const rawProductResults = ((productsRaw as any)[0]?.results) || [];
  const allProductResults = HIDE_PRODUCTS_WITHOUT_IMAGE
    ? rawProductResults.filter((p: any) => p.image && p.image.trim() !== '')
    : rawProductResults;

  const staticCategories: string[] = Array.from(
    new Set(
      allProductResults
        .flatMap((p: any) => (p.category || '').split(',').map((s: string) => s.trim()))
        .filter(Boolean)
    )
  ).sort() as string[];
  const categories = initialCategories?.length ? initialCategories : staticCategories;

  const staticCollections: string[] = Array.from(
    new Set(
      allProductResults
        .flatMap((p: any) => (p.collection || '').split(',').map((s: string) => s.trim()))
        .filter((s: string) => s && s !== 'Default' && s !== '')
    )
  ).sort() as string[];
  const collections = initialCollections?.length ? initialCollections : staticCollections;

  const addToCart = useCallback((product: any, qty = 1) => {
    const idVal = product.ItemID || product.id;
    const variantName = product.variant?.variant_name || (typeof product.variant === 'string' ? product.variant : null);
    const uniqueId = variantName ? `${idVal}-${variantName}` : String(idVal);

    // A variant carries its own count; otherwise the product's. `null`/absent
    // means the operator is not tracking stock for this item, so no ceiling.
    const rawStock = product.variant?.stock_count ?? product.Stock ?? product.stock;
    const stockLimit =
      rawStock === null || rawStock === undefined ? null : Number(rawStock) || 0;

    const prev = cartRef.current;
    const existing = prev.find((item) => String(item.id) === String(uniqueId));

    // Clamp against what exists. Without this, adding from the grid and again
    // from the product page stacked past the real stock (1 + 3 = 4 of 3), and
    // the customer only found out when checkout rejected the whole order.
    const wanted = (existing?.quantity ?? 0) + qty;
    const allowed = stockLimit === null ? wanted : Math.min(wanted, stockLimit);

    if (stockLimit !== null && allowed <= 0) {
      setToast({ show: true, message: 'Ese producto esta agotado 😿' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (allowed < wanted) {
      setToast({
        show: true,
        message: `Solo quedan ${allowed} unidad${allowed === 1 ? '' : 'es'} de este producto`,
      });
      setTimeout(() => setToast(null), 3500);
    }

    let changed: CartItem;
    let next: CartItem[];
    if (existing) {
      if (allowed === existing.quantity) return; // already at the ceiling
      changed = { ...existing, quantity: allowed };
      next = prev.map((item) => (String(item.id) === String(uniqueId) ? changed : item));
    } else {
      changed = {
        ...product,
        id: uniqueId,
        ItemID: idVal,
        name: product.Product || product.name,
        Product: product.Product || product.name,
        // Keep the two apart: base_price_usd is the cost basis the checkout
        // re-derives prices from, USD is the shelf price already converted.
        // Collapsing them would convert a second time at checkout.
        base_price_usd: product.base_price_usd ?? product.USD,
        USD: product.USD ?? product.base_price_usd,
        image: (product.variant && product.variant.image_path) || product.Image || product.image,
        Image: (product.variant && product.variant.image_path) || product.Image || product.image,
        quantity: qty,
        variant: product.variant || null,
        selected: true,
      };
      next = [...prev, changed];
    }
    commitCart(next);
    syncUpsert(changed);

    setToast({ show: true, message: '¡Agregado al carrito! ✨' });
    setTimeout(() => setToast(null), 3000);
  }, [commitCart, syncUpsert]);

  const removeFromCart = useCallback((itemId: string) => {
    const prev = cartRef.current;
    const target = prev.find((item) => String(item.id) === String(itemId));
    commitCart(prev.filter((item) => String(item.id) !== String(itemId)));
    if (target) syncRemove(target);
  }, [commitCart, syncRemove]);

  const updateCartQuantity = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }
    const prev = cartRef.current;
    let changed: CartItem | null = null;
    let clampedTo: number | null = null;

    const next = prev.map((item) => {
      if (String(item.id) !== String(itemId)) return item;
      // Same ceiling as addToCart: the cart's own +/- controls must not be a
      // way around it either.
      const variantStock = (item.variant as any)?.stock_count;
      const raw = variantStock ?? item.Stock;
      const limit = raw === null || raw === undefined ? null : Number(raw) || 0;
      const allowed = limit === null ? qty : Math.min(qty, limit);
      if (allowed < qty) clampedTo = allowed;
      changed = { ...item, quantity: allowed };
      return changed;
    });

    if (clampedTo !== null) {
      setToast({
        show: true,
        message: `Solo quedan ${clampedTo} unidad${clampedTo === 1 ? '' : 'es'} de este producto`,
      });
      setTimeout(() => setToast(null), 3500);
    }

    commitCart(next);
    if (changed) syncUpsert(changed);
  }, [commitCart, removeFromCart, syncUpsert]);

  const clearCart = useCallback(() => {
    commitCart([]);
    if (token) {
      fetch(`${API_URL}/account/cart/clear`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [commitCart, token]);

  /**
   * Remove specific lines and leave the rest. Used after an order is placed:
   * only the lines that were actually bought should go, so anything the
   * customer deselected stays in the cart for next time.
   */
  const removeCartItems = useCallback((itemIds: string[]) => {
    const ids = new Set(itemIds.map(String));
    const prev = cartRef.current;
    const going = prev.filter((item) => ids.has(String(item.id)));
    commitCart(prev.filter((item) => !ids.has(String(item.id))));
    for (const item of going) syncRemove(item);
  }, [commitCart, syncRemove]);

  const toggleCartSelection = useCallback((itemId: string) => {
    commitCart(
      cartRef.current.map((item) =>
        String(item.id) === String(itemId)
          // Absent means selected, so the first click on an untouched line
          // must deselect it rather than appear to do nothing.
          ? { ...item, selected: item.selected === false }
          : item,
      ),
    );
  }, [commitCart]);

  const setAllCartSelected = useCallback((selected: boolean) => {
    commitCart(cartRef.current.map((item) => ({ ...item, selected })));
  }, [commitCart]);

  // `selected !== false` so lines saved before this feature existed (and any
  // restored from the server without the flag) count as selected.
  const selectedCartItems = cartItems.filter((item) => item.selected !== false);

  return (
    <StorefrontContext.Provider
      value={{
        cartItems,
        setCartItems,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        selectedCartItems,
        toggleCartSelection,
        setAllCartSelected,
        removeCartItems,
        isCartOpen,
        setIsCartOpen,
        isMenuOpen,
        setIsMenuOpen,
        activeCategory,
        setActiveCategory,
        activeCollection,
        setActiveCollection,
        activePromotion,
        setActivePromotion,
        toast,
        setToast,
        rates,
        assets,
        config,
        videos,
        categories,
        collections,
        toSlug,
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
};

export const useStorefront = () => {
  const context = useContext(StorefrontContext);
  if (!context) {
    throw new Error('useStorefront must be used within a StorefrontProvider');
  }
  return context;
};
