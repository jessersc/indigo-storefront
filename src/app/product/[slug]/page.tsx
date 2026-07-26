import React from 'react';
import { Metadata } from 'next';
import { getStoreConfig } from '../../../lib/store-config';
import { getCatalog, toDisplayProduct } from '../../../lib/catalog';
import ProductDetailWrapper from './ProductDetailWrapper';

function parseIdFromSlug(slug: string): string {
  const parts = slug.split('-');
  return parts[parts.length - 1];
}

/** Resolves a slug against the live catalog, priced with the live rates. */
async function getProductBySlug(slug: string) {
  const [{ products, variants }, { rates }] = await Promise.all([getCatalog(), getStoreConfig()]);
  const id = parseIdFromSlug(slug);
  const p = products.find((x) => String(x.id) === id);
  if (!p) return null;
  return {
    product: toDisplayProduct(p, rates),
    variants: variants.filter((v) => String(v.parent_id) === String(p.id)),
  };
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const found = await getProductBySlug(decodedSlug);
  const product = found?.product;
  
  if (!product) {
    return {
      title: 'Producto no encontrado - Indigo Store',
      description: 'El producto buscado no se encuentra disponible.',
    };
  }

  const cleanDescription = product.Description
    ? product.Description.replace(/\\n/g, ' ').substring(0, 160)
    : 'Llevando dulzura y estilo a cada rincón.';

  return {
    title: `${product.Product} | Indigo Store`,
    description: `${cleanDescription} - Adquiérelo por $${product.USD.toFixed(2)} / Bs ${product.Bs.toFixed(2)}`,
    openGraph: {
      title: product.Product,
      description: cleanDescription,
      images: [
        {
          url: product.Image,
          alt: product.Product,
        },
      ],
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const found = await getProductBySlug(decodedSlug);
  const product = found?.product;

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-black text-slate-800 mb-4 bubble-font">¡Ups! Producto no encontrado 😿</h2>
        <p className="text-slate-500 max-w-md font-bold mb-8">
          El artículo que estás buscando no existe o se encuentra agotado temporalmente.
        </p>
        <a 
          href="/" 
          className="bg-kawaii-pink text-white px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
        >
          Volver al Inicio
        </a>
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.Product,
    'image': product.Image,
    'description': product.Description,
    'sku': product.ItemID,
    'offers': {
      '@type': 'Offer',
      'url': `https://indigostores.com/product/${slug}`,
      'priceCurrency': 'USD',
      'price': product.USD,
      'priceValidUntil': '2030-01-01',
      'availability': product.Stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  const productVariants = found?.variants ?? [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        <ProductDetailWrapper product={product} variants={productVariants} />
      </div>
    </>
  );
}
