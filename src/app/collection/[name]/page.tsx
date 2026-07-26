import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import ProductGridWrapper from '../../../components/ProductGridWrapper';
import { getCatalog } from '../../../lib/catalog';

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  return {
    title: `Colección ${decodedName} | Indigo Store`,
    description: `Explora la colección especial ${decodedName} de Indigo Store. Productos únicos y adorables con envíos a todo el país. 𖹭`,
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const { products, variants } = await getCatalog();

  return (
    <main className="max-w-7xl mx-auto px-6 py-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-4">
        <div className="text-center md:text-left">
          <h3 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4 uppercase">
            {decodedName}
            <div className="h-2 w-2 bg-kawaii-pink rounded-full animate-ping"></div>
          </h3>
          <div className="h-2 w-32 bg-gradient-to-r from-kawaii-pink to-kawaii-yellow rounded-full mt-2 mx-auto md:mx-0 shadow-lg shadow-kawaii-pink/20"></div>
        </div>
        <Link 
          href="/" 
          className="text-sm font-bold uppercase tracking-widest text-kawaii-pink hover:text-kawaii-purple transition-all flex items-center gap-2 group hover:scale-105 cursor-pointer"
        >
          Ver todo el catálogo
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
      
      <ProductGridWrapper
        activeCategory={null}
        activeCollection={decodedName}
        sourceProducts={products}
        sourceVariants={variants}
      />
    </main>
  );
}
