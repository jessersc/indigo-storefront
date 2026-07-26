'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStorefront } from '../context/StorefrontContext';
import ProductGrid from './ProductGrid';
import type { CatalogProduct, CatalogVariant } from '../lib/catalog';

interface ProductGridWrapperProps {
  activeCategory: string | null;
  activeCollection: string | null;
  /** Live catalog from D1, loaded by the server page. */
  sourceProducts?: CatalogProduct[];
  sourceVariants?: CatalogVariant[];
}

export default function ProductGridWrapper({
  activeCategory,
  activeCollection,
  sourceProducts,
  sourceVariants,
}: ProductGridWrapperProps) {
  const router = useRouter();
  const { addToCart, toSlug } = useStorefront();

  return (
    <ProductGrid 
      sourceProducts={sourceProducts}
      sourceVariants={sourceVariants}
      activeCategory={activeCategory} 
      activeCollection={activeCollection} 
      activePromotion={false}
      onAddToCart={addToCart} 
      onProductClick={(p) => {
        const slug = toSlug(p.Product, p.ItemID);
        router.push(`/product/${slug}`);
      }}
    />
  );
}
