import React from 'react';
import type { Metadata } from 'next';
import TaxonomyIndex from '../../components/TaxonomyIndex';
import { getCatalog } from '../../lib/catalog';

/**
 * Every collection, in one place. Counterpart to /categorias — see the note
 * there on why both exist.
 */

export const metadata: Metadata = {
  title: 'Colecciones | Indigo Store',
  description: 'Explora todas las colecciones de Indigo Store.',
};

export const revalidate = 600;

export default async function ColeccionesPage() {
  const { collections } = await getCatalog();

  return (
    <TaxonomyIndex
      title="Colecciones"
      subtitle="Nuestras lineas y colaboraciones favoritas."
      items={collections}
      basePath="/collection"
    />
  );
}
