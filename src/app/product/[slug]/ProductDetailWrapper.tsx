'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStorefront } from '../../../context/StorefrontContext';
import ProductDetail from '../../../components/ProductDetail';

export default function ProductDetailWrapper({ product, variants }: { product: any; variants: any[] }) {
  const router = useRouter();
  const { addToCart } = useStorefront();

  return (
    <ProductDetail 
      product={product} 
      variants={variants}
      onAddToCart={(p, q) => {
        addToCart(p, q);
      }}
      onCheckout={(p, q) => {
        addToCart(p, q);
        router.push('/checkout');
      }}
      onBack={() => router.push('/')}
    />
  );
}
