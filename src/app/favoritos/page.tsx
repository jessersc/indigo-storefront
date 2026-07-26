import React from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '../../lib/catalog';
import FavoritesList from '../../components/FavoritesList';

export const metadata: Metadata = {
  title: 'Mis Favoritos | Indigo Store',
  description: 'Los productos que guardaste en Indigo Store.',
};

/**
 * Favorites page. The catalog is loaded server-side; which products are
 * favorited is client state (localStorage for guests, D1 for signed-in
 * customers), so the list itself filters on the client.
 */
export default async function FavoritesPage() {
  const { products, variants } = await getCatalog();
  return <FavoritesList products={products} variants={variants} />;
}
