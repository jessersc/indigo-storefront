import React from 'react';
import { getCatalog } from '../lib/catalog';
import HomeClient from '../components/HomeClient';
import TaxonomyCarousel from '../components/TaxonomyCarousel';

/**
 * Home page. Server component: the catalog is read from D1 (through the Worker)
 * here and handed to the client parts, so dashboard edits reach the store
 * without a rebuild. The category/collection carousels render the icons chosen
 * in the dashboard.
 */
export default async function HomePage() {
  const { products, variants, categories, collections } = await getCatalog();

  return (
    <>
      <HomeClient products={products} variants={variants} />

      <div className="max-w-7xl mx-auto px-6 pb-20">
        <TaxonomyCarousel title="Categorías" items={categories} basePath="/category" />
        <TaxonomyCarousel title="Colecciones" items={collections} basePath="/collection" />
      </div>
    </>
  );
}
