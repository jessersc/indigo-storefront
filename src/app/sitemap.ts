import { MetadataRoute } from 'next';
import { getCatalog, visibleProducts, namesFrom } from '../lib/catalog';
import { HIDE_PRODUCTS_WITHOUT_IMAGE } from '../context/StorefrontContext';

function toSlug(name: string, id: string): string {
  if (!name) return id;
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  const cleaned = normalized
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  return `${cleaned}-${id}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://indigostores.com';

  const catalog = await getCatalog();
  const productsRaw = HIDE_PRODUCTS_WITHOUT_IMAGE ? visibleProducts(catalog.products) : catalog.products;

  const routes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
  ];

  const productRoutes = productsRaw.map((p: any) => {
    const slug = toSlug(p.name, p.id);
    return {
      url: `${baseUrl}/product/${slug}`,
      lastModified: new Date(p.updated_at || p.created_at || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    };
  });

  const categories = namesFrom(productsRaw, 'category');

  const categoryRoutes = categories.map((cat) => ({
    url: `${baseUrl}/category/${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const collections = namesFrom(productsRaw, 'collection');

  const collectionRoutes = collections.map((col) => ({
    url: `${baseUrl}/collection/${encodeURIComponent(col)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...routes, ...productRoutes, ...categoryRoutes, ...collectionRoutes];
}
