import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContentPage, getContentPages, toParagraphs } from '../../../lib/content';

/**
 * Renders any dashboard-authored content page by slug (nosotros, terminos,
 * privacidad, and anything else the operator adds). Body text is rendered as
 * escaped paragraphs -- deliberately not HTML.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const pages = await getContentPages();
  return pages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getContentPage(slug);
  if (!page) return { title: 'Pagina no encontrada | Indigo Store' };
  return {
    title: `${page.title} | Indigo Store`,
    description: toParagraphs(page.body)[0]?.slice(0, 150),
  };
}

export default async function ContentPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = await getContentPage(slug);
  if (!page) notFound();

  const paragraphs = toParagraphs(page.body);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <nav className="mb-6">
        <Link href="/" className="text-sm font-bold text-kawaii-pink hover:underline">
          &larr; Volver a la tienda
        </Link>
      </nav>

      <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-8">{page.title}</h1>

      <article className="space-y-5">
        {paragraphs.length === 0 ? (
          <p className="text-slate-400 font-bold italic">Esta pagina aun no tiene contenido.</p>
        ) : (
          paragraphs.map((text, i) => (
            <p key={i} className="text-slate-600 leading-relaxed font-medium whitespace-pre-line">
              {text}
            </p>
          ))
        )}
      </article>

      {page.updated_at && (
        <p className="mt-12 pt-6 border-t border-slate-100 text-xs text-slate-400 font-bold uppercase tracking-widest">
          Actualizado: {new Date(page.updated_at).toLocaleDateString('es-VE')}
        </p>
      )}
    </main>
  );
}
