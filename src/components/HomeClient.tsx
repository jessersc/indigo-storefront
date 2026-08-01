'use client';

import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStorefront } from '../context/StorefrontContext';
import { NEW_PRODUCT_COUNT, type CatalogProduct, type CatalogVariant } from '../lib/catalog';
import ProductGrid from './ProductGrid';
import { calculatePrices } from '../lib/currency';
import SocialVideos from './SocialVideos';

const getProductEmojis = (productName: string, category: string) => {
  const text = (productName + " " + category).toLowerCase();
  const emojis = [];
  if (text.includes("collar") || text.includes("cadena") || text.includes("joya")) emojis.push("💎", "✨");
  if (text.includes("peluche") || text.includes("plush")) emojis.push("🧸", "🎀");
  if (text.includes("kawaii") || text.includes("lindo") || text.includes("cute")) emojis.push("💖", "🌸");
  if (text.includes("bts") || text.includes("kpop") || text.includes("skz")) emojis.push("🎤", "💜");
  if (text.includes("papeleria") || text.includes("cuaderno") || text.includes("lapiz")) emojis.push("📝", "🖍️");
  if (text.includes("taza") || text.includes("vaso") || text.includes("termo")) emojis.push("☕", "🥤");
  if (text.includes("luna")) emojis.push("🌙", "⭐");
  if (text.includes("brazalete") || text.includes("pulsera")) emojis.push("📿", "✨");
  if (text.includes("corazon") || text.includes("heart")) emojis.push("❤️", "💌");
  if (emojis.length < 3) {
    const fallbacks = ["✨", "🌸", "💖", "⭐"];
    for (const f of fallbacks) {
      if (!emojis.includes(f)) emojis.push(f);
      if (emojis.length >= 3) break;
    }
  }
  return emojis.slice(0, 3);
};

const MagnetEmoji = ({ children, className, style }: any) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setPosition({ x: x * 0.5, y: y * 0.5 }); // adjust multiplier for magnet strength
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
      className={`inline-block transition-transform duration-200 ease-out cursor-pointer ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        ...style
      }}
    >
      <div className="hover:scale-125 transition-transform duration-200">
        {children}
      </div>
    </div>
  );
};

interface HomeContentProps {
  products: CatalogProduct[];
  variants: CatalogVariant[];
}

function HomeContent({ products, variants }: HomeContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePromotion = searchParams.get('promo') === 'true';

  // Live rates from context (D1), not the bundled snapshot -- a stale rate here
  // would price the hero differently from the grid below it.
  const { addToCart, toSlug, setIsCartOpen, videos, rates } = useStorefront();

  const productsRaw = products;
  const variantsRaw = variants;

  const heroSlides = useMemo(() => {
    const vibrantGradients = [
      "from-kawaii-pink via-[#FF8DC7] to-kawaii-pink",
      "from-kawaii-purple via-[#B983FF] to-kawaii-purple",
      "from-kawaii-blue via-[#86C8FF] to-kawaii-blue",
      "from-[#FFB6B1] via-[#FFDAB9] to-[#FFB6B1]", 
      "from-[#98FB98] via-[#7FFFD4] to-[#98FB98]",
      "from-kawaii-yellow via-[#FFFACD] to-kawaii-yellow"
    ];

    const withImages = productsRaw.filter((p: any) => p.image && p.image.trim() !== '');
    const sorted = [...withImages].sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const top20 = sorted.slice(0, 20);

    return top20.map((p: any, index: number) => {
      const pVariants = variantsRaw.filter((v: any) => String(v.parent_id) === String(p.id));
      const hasVariants = pVariants.length > 0 && pVariants.some((v: any) => v.variant_name !== "Default");
      
      // Shelf prices via the CurrencyEngine, never the raw cost basis.
      const { usd: priceUsd, bs: priceBs } = calculatePrices(p.base_price_usd, rates);

      return {
        product: p,
        title: p.name.toUpperCase(),
        priceUsd,
        priceBs,
        hasVariants,
        bgColor: vibrantGradients[index % vibrantGradients.length],
        image: p.image,
        tag: index === 0 ? "¡NUEVO!" : "DESTACADO",
        emojis: getProductEmojis(p.name, p.category || '')
      };
    });
  }, [productsRaw, variantsRaw, rates]);

  const [currentSlide, setCurrentSlide] = useState(0);

  /** Open the product behind the current hero slide. Shared by the name, the
   *  photo and the "Seleccionar modelo" button so they cannot drift apart. */
  const goToHeroProduct = useCallback(() => {
    const slide = heroSlides[currentSlide];
    if (!slide?.product?.id) return;
    router.push(`/product/${toSlug(slide.title, slide.product.id)}`);
  }, [heroSlides, currentSlide, router, toSlug]);


  useEffect(() => {
    if (!activePromotion && heroSlides.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [activePromotion, heroSlides.length]);

  return (
    <div className="animate-in fade-in duration-500">
      {/* Conditionally Render Hero Section (Only on main Home View, not promotions) */}
      {!activePromotion && heroSlides.length > 0 && (
        <header className={`relative bg-gradient-to-br ${heroSlides[currentSlide].bgColor} py-12 md:py-24 px-6 overflow-hidden transition-all duration-1000`}>
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dust.png')] pointer-events-none"></div>
          
          {/*
            Three blocks, ordered differently per breakpoint.

            On mobile the reading order is name -> image -> price/buttons, so the
            customer sees WHAT the product is before being asked to buy it.
            Previously the whole text column stacked above the image column, so
            the photo landed below both the price and the CTAs -- the one thing
            you want people to see first was last.

            On lg the original layout returns via explicit grid placement: name
            and price/buttons stacked in column 1, image spanning both rows in
            column 2. The DOM order stays name -> price/buttons -> image, so only
            `order` changes, not the markup.
          */}
          <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 lg:items-center">
            {/* Name */}
            <div className="order-1 lg:col-start-1 lg:row-start-1 text-center lg:text-left space-y-5 md:space-y-6 animate-in fade-in slide-in-from-left-8 duration-700">
              <div className="inline-block bg-white/20 backdrop-blur-md px-5 py-1.5 rounded-full text-white text-[11px] font-black uppercase tracking-[0.3em] border border-white/40 shadow-sm">
                {heroSlides[currentSlide].tag}
              </div>
              {/* The name is the product's own link. Customers try this before
                  they try any button -- it looked like a heading and did
                  nothing, which reads as broken. */}
              <div key={`title-${currentSlide}`}>
                <button
                  type="button"
                  onClick={goToHeroProduct}
                  className="text-left w-full cursor-pointer group"
                >
                  <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight drop-shadow-2xl leading-[1.1] bubble-font group-hover:text-kawaii-yellow transition-colors">
                    {heroSlides[currentSlide].title}
                  </h2>
                </button>
              </div>
            </div>

            {/* Price + calls to action. order-3 puts these after the image on
                mobile; on lg they return to the left column, under the name. */}
            <div className="order-3 lg:col-start-1 lg:row-start-2 text-center lg:text-left space-y-5 md:space-y-6 animate-in fade-in slide-in-from-left-8 duration-700">
              <div className="flex flex-col lg:flex-row items-center lg:items-end gap-2 lg:gap-4 justify-center lg:justify-start">
                <p className="text-white text-4xl md:text-5xl font-black drop-shadow-md">
                  ${heroSlides[currentSlide].priceUsd.toFixed(2)}
                </p>
                <p className="text-white/90 text-2xl font-bold mb-1">
                  Bs. {heroSlides[currentSlide].priceBs.toFixed(2)}
                </p>
              </div>
              <div className="pt-4 flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                {heroSlides[currentSlide].hasVariants ? (
                  <button 
                    onClick={goToHeroProduct}
                    className="bg-white text-kawaii-pink px-8 py-4 rounded-full font-black text-lg uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:bg-kawaii-yellow hover:text-kawaii-dark bubble-font cursor-pointer text-center"
                  >
                    SELECCIONAR MODELO
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        const productData = {
                          ...heroSlides[currentSlide].product,
                          ItemID: heroSlides[currentSlide].product.id,
                          Product: heroSlides[currentSlide].product.name,
                          USD: heroSlides[currentSlide].priceUsd,
                          Image: heroSlides[currentSlide].image,
                        };
                        addToCart(productData, 1);
                        router.push('/checkout');
                      }}
                      className="bg-white text-kawaii-pink px-8 py-4 rounded-full font-black text-lg uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:bg-kawaii-yellow hover:text-kawaii-dark bubble-font cursor-pointer text-center"
                    >
                      COMPRAR AHORA
                    </button>
                    <button 
                      onClick={() => {
                        const productData = {
                          ...heroSlides[currentSlide].product,
                          ItemID: heroSlides[currentSlide].product.id,
                          Product: heroSlides[currentSlide].product.name,
                          USD: heroSlides[currentSlide].priceUsd,
                          Image: heroSlides[currentSlide].image,
                        };
                        addToCart(productData, 1);
                        setIsCartOpen(true);
                      }}
                      className="bg-kawaii-pink/20 backdrop-blur-md border-2 border-white text-white px-8 py-4 rounded-full font-black text-lg uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.1)] hover:bg-white hover:text-kawaii-pink bubble-font cursor-pointer text-center"
                    >
                      CARRITO
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Image. order-2 places it between the name and the buttons on
                mobile; on lg it spans both rows of the second column. */}
            <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2 relative group animate-in fade-in zoom-in-95 duration-700 delay-200">
              <div className="bg-white/10 backdrop-blur-sm rounded-[40px] p-4 border border-white/20 shadow-2xl relative">
                 <div className="aspect-square bg-white rounded-[32px] overflow-hidden relative shadow-inner">
                    {/* Same reasoning as the name: tapping the photo is the most
                        obvious way to ask for the product, so it has to work.
                        The arrows below sit above this in the stacking order,
                        so paging the carousel does not navigate by accident. */}
                    <button
                      type="button"
                      onClick={goToHeroProduct}
                      aria-label={`Ver ${heroSlides[currentSlide].title}`}
                      className="absolute inset-0 w-full h-full cursor-pointer"
                    >
                      <img
                        key={`img-${currentSlide}`}
                        src={heroSlides[currentSlide].image}
                        alt={heroSlides[currentSlide].title}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <div className="absolute bottom-6 right-6 z-10 bg-white/90 backdrop-blur-md p-2 rounded-full flex gap-2 shadow-lg border border-white">
                      <button 
                        onClick={() => setCurrentSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                        className="w-10 h-10 bg-kawaii-pink text-white rounded-full flex items-center justify-center hover:bg-kawaii-purple transition-colors shadow-md cursor-pointer font-bold"
                      >
                        ←
                      </button>
                      <button 
                        onClick={() => setCurrentSlide(prev => (prev + 1) % heroSlides.length)}
                        className="w-10 h-10 bg-kawaii-pink text-white rounded-full flex items-center justify-center hover:bg-kawaii-purple transition-colors shadow-md cursor-pointer font-bold"
                      >
                        →
                      </button>
                    </div>
                 </div>
              </div>
              
              {/* Product specific dynamic emojis with magnet effect */}
              {heroSlides[currentSlide].emojis.map((emoji: string, idx: number) => {
                const positions = [
                  { top: '-top-12', left: '-left-10', delay: '0s' },
                  { bottom: '-bottom-12', left: '-left-8', delay: '0.8s' },
                  { top: 'top-1/3', right: '-right-12', delay: '1.2s' },
                ];
                const pos = positions[idx % positions.length];
                return (
                  <MagnetEmoji 
                    key={`${currentSlide}-${emoji}-${idx}`} 
                    className={`absolute ${pos.top || ''} ${pos.bottom || ''} ${pos.left || ''} ${pos.right || ''} text-5xl md:text-6xl z-20`}
                  >
                    <div className="floating-star animate-pulse" style={{ animationDelay: pos.delay }}>{emoji}</div>
                  </MagnetEmoji>
                );
              })}
            </div>
          </div>

          {/* Background floating elements with magnet effect */}
          <MagnetEmoji className="absolute top-1/4 left-10 text-kawaii-yellow/40 text-7xl select-none z-0">
             <div className="floating-star animate-pulse">✦</div>
          </MagnetEmoji>
          <MagnetEmoji className="absolute bottom-1/4 right-20 text-white/30 text-8xl select-none z-0">
             <div className="floating-star animate-bounce" style={{ animationDelay: '1.5s' }}>⭐</div>
          </MagnetEmoji>
          <MagnetEmoji className="absolute top-3/4 left-1/3 text-white/40 text-6xl select-none z-0">
             <div className="floating-star animate-pulse" style={{ animationDelay: '0.5s' }}>🌸</div>
          </MagnetEmoji>
          
          <style jsx>{`
            .text-glow {
              text-shadow: 0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 230, 0, 0.3);
            }
          `}</style>

          {/* Slide dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
            {heroSlides.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-3 rounded-full transition-all duration-500 cursor-pointer ${currentSlide === i ? 'w-10 bg-white shadow-lg' : 'w-3 bg-white/40'}`}
              />
            ))}
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main id="product-grid" className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-4">
          <div className="text-center md:text-left">
            <h3 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4 uppercase">
              {activePromotion ? 'PROMOCIONES' : 'PRODUCTOS DESTACADOS'}
              <div className="h-2 w-2 bg-kawaii-pink rounded-full animate-ping"></div>
            </h3>
            <div className="h-2 w-32 bg-gradient-to-r from-kawaii-pink to-kawaii-yellow rounded-full mt-2 mx-auto md:mx-0 shadow-lg shadow-kawaii-pink/20"></div>
          </div>
          {activePromotion && (
            <button 
              onClick={() => router.push('/')}
              className="text-sm font-bold uppercase tracking-widest text-kawaii-pink hover:text-kawaii-purple transition-all flex items-center gap-2 group hover:scale-105 cursor-pointer"
            >
              Ver todo el catálogo
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          )}
        </div>
        
        <ProductGrid 
          sourceProducts={products}
          sourceVariants={variants}
          activeCategory={null} 
          activeCollection={null} 
          activePromotion={activePromotion}
          // The 20 most recently added products, newest first -- the same 20
          // that carry the "Nuevo" badge (NEW_PRODUCT_COUNT), so the section
          // and the marks agree. Promotions show every discounted item instead.
          limit={!activePromotion ? NEW_PRODUCT_COUNT : undefined}
          newestFirst={!activePromotion}
          onAddToCart={addToCart} 
          onProductClick={(p) => {
            const slug = toSlug(p.Product, p.ItemID);
            router.push(`/product/${slug}`);
          }}
        />
        
        {/* Social Feed Section - Only shown on home page without filters */}
        {!activePromotion && (
          <div className="mt-20">
            <h3 className="text-3xl md:text-5xl font-black text-kawaii-dark mb-10 text-center bubble-font flex items-center justify-center gap-4">
              ✨ TRENDING EN REDES 💖
            </h3>
            <SocialVideos videos={videos} />
          </div>
        )}
      </main>
    </div>
  );
}

export default function HomeClient({ products, variants }: HomeContentProps) {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-xl font-bold text-kawaii-pink animate-pulse">Cargando Tienda Magica...</div>
      </div>
    }>
      <HomeContent products={products} variants={variants} />
    </Suspense>
  );
}
