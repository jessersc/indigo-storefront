import React from 'react';
import { Metadata } from 'next';
import { getStoreConfig } from '../../../lib/store-config';
import { getCatalog, getLiveProduct, toDisplayProduct } from '../../../lib/catalog';
import ProductDetailWrapper from './ProductDetailWrapper';

function parseIdFromSlug(slug: string): string {
  const parts = slug.split('-');
  return parts[parts.length - 1];
}

/**
 * Resolves a slug against the catalog, then overlays LIVE stock and price.
 *
 * The catalog fetch is cached for five minutes because it is ~6,000 D1 rows and
 * its heavy parts -- names, descriptions, images -- effectively never change.
 * Stock and price do change constantly, and this is the page where being wrong
 * actually costs something: a customer adding six units of something with one
 * left, or seeing a price checkout will refuse.
 *
 * So those two fields (plus the rates they derive from) come from a small
 * uncached endpoint instead, about ten rows. The page is then correct on first
 * load with no dependence on cache invalidation firing, on which admin endpoint
 * performed the write, or on revalidateTag behaving -- all three of which have
 * failed silently here before.
 *
 * If the live call fails the cached values stand: a five-minute-old price is far
 * better than a broken page, and checkout re-verifies both anyway.
 */
async function getProductBySlug(slug: string) {
  const [{ products, variants }, { rates }] = await Promise.all([getCatalog(), getStoreConfig()]);
  const id = parseIdFromSlug(slug);
  const p = products.find((x) => String(x.id) === id);
  if (!p) return null;

  const live = await getLiveProduct(id);
  const merged = live
    ? { ...p, base_price_usd: live.base_price_usd ?? p.base_price_usd, stock: live.stock, stock_status: live.stock_status ?? p.stock_status }
    : p;
  const liveRates = live?.rates ?? rates;

  const ownVariants = variants
    .filter((v) => String(v.parent_id) === String(p.id))
    .map((v) => {
      const lv = live?.variants?.find((x) => String(x.id) === String(v.id));
      return lv ? { ...v, stock_count: lv.stock_count } : v;
    });

  return { product: toDisplayProduct(merged, liveRates), variants: ownVariants };
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
