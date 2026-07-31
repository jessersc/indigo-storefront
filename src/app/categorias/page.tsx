import React from 'react';
import type { Metadata } from 'next';
import TaxonomyIndex from '../../components/TaxonomyIndex';
import { getCatalog } from '../../lib/catalog';

/**
 * Every category, in one place.
 *
 * This page did not exist, which is why the "Categorias" link in every order
 * email pointed at "/" — it had nowhere else to go, so two of the three nav
 * links in our emails simply dropped the customer on the home page.
 */

export const metadata: Metadata = {
  title: 'Categorias | Indigo Store',
  description: 'Explora todas las categorias de accesorios de Indigo Store.',
};

export const revalidate = 600;

export default async function CategoriasPage() {
  const { categories } = await getCatalog();

  return (
    <TaxonomyIndex
      title="Categorias"
      subtitle="Encuentra lo que buscas por tipo de producto."
      items={categories}
      basePath="/category"
    />
  );
}
