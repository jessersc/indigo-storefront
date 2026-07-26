'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStorefront } from '../context/StorefrontContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import CartModal from './CartModal';
import SupportWidget from './SupportWidget';
import { CheckCircle2, User, Heart, Search, X, Package, Tag, ChevronDown } from 'lucide-react';
import { getOptimizedImage } from '../lib/image';
import { calculatePrices } from '../lib/currency';
import { searchProducts, type SearchHit } from '../lib/search-api';

interface StorefrontShellProps {
  children: React.ReactNode;
}

export default function StorefrontShell({ children }: StorefrontShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  /**
   * Mobile only: the search input is hidden behind an icon.
   *
   * A 96px-wide input crammed into the header row overlapped the logo and was
   * too small to read what you had typed. Below `sm` the icon opens a full-width
   * bar under the header instead; from `sm` up the inline input is always shown
   * and this is ignored.
   */
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { toSlug } = useStorefront();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search runs on the server (Worker -> D1) so the browser never holds the
  // whole catalog. Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const hits = await searchProducts(query, 5);
      if (cancelled) return;
      setSearchResults(hits);
      setIsSearchOpen(true);
    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      setIsSearchOpen(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  
  const {
    cartItems,
    setCartItems,
    isCartOpen,
    setIsCartOpen,
    isMenuOpen,
    setIsMenuOpen,
    toast,
    rates,
    assets,
    categories,
    collections,
    config,
  } = useStorefront();

  const { user } = useAuth();
  const { count: favoritesCount } = useFavorites();

  // Social links are dashboard-editable (store_config), with sensible fallbacks.
  const igUrl = config.social_instagram_url || 'https://www.instagram.com/indig0.store';
  const ttUrl = config.social_tiktok_url || 'https://www.tiktok.com/@indig0.store';
  const waUrl = config.social_whatsapp_url || 'https://www.whatsapp.com/catalog/584128503608/?app_absent=0';

  const headerBanner = assets.find(a => a.asset_type === 'header')?.html_content || '🌟 BIENVENIDO A INDIGO 🌟';
  const logoUrl = assets.find(a => a.asset_type === 'logotipo')?.url || '/assets/logotipo.png';
  const instagramIconUrl = assets.find(a => a.social_platform === 'instagram')?.url || '/assets/ig.png';
  const tiktokIconUrl = assets.find(a => a.social_platform === 'tiktok')?.url || '/assets/tt.png';
  const whatsappIconUrl = assets.find(a => a.social_platform === 'whatsapp')?.url || '/assets/wa.png';

  // Active state checking
  const getActiveCategory = () => {
    if (pathname.startsWith('/category/')) {
      return decodeURIComponent(pathname.split('/').pop() || '');
    }
    return null;
  };

  const getActiveCollection = () => {
    if (pathname.startsWith('/collection/')) {
      return decodeURIComponent(pathname.split('/').pop() || '');
    }
    return null;
  };

  const activeCategory = getActiveCategory();
  const activeCollection = getActiveCollection();
  const activePromotion = pathname === '/promociones' || (pathname === '/' && typeof window !== 'undefined' && window.location.search.includes('promo=true'));

  return (
    <div className="min-h-screen font-nunito selection:bg-kawaii-light-pink selection:text-white flex flex-col">
      {/* The cart reads its own state from the context now, so selection
          survives closing and reopening the modal and is the same list the
          checkout uses. */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          router.push('/checkout');
        }}
      />

      {/* Banner Superior - Kawaii Ticker */}
      <div className="kawaii-ticker">
        <div className="ticker-content" dangerouslySetInnerHTML={{ 
          __html: `${headerBanner} &nbsp;&nbsp;&nbsp;&nbsp; ${headerBanner} &nbsp;&nbsp;&nbsp;&nbsp; ${headerBanner}` 
        }} />
      </div>

      {/* ── HEADER — exact copy of indigostores.com reference ── */}
      <header
        className="bg-white/80 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b-2 border-[#FF69B4] py-1 px-4"
        style={{ fontFamily: "'Nunito', sans-serif" }}
      >
        <div className="flex flex-row items-center justify-between w-full max-w-7xl mx-auto flex-nowrap min-h-[2.5rem]">

          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden flex flex-col gap-[5px] cursor-pointer bg-none border-none p-1"
            >
              <span className="block w-5 h-0.5 bg-kawaii-pink rounded-sm" />
              <span className="block w-5 h-0.5 bg-kawaii-pink rounded-sm" />
              <span className="block w-5 h-0.5 bg-kawaii-pink rounded-sm" />
            </button>

            {/* Logo */}
            <div className="flex justify-center items-center flex-shrink-0">
              <Link href="/">
                <img
                  src={logoUrl}
                  alt="Indigo Store Logo"
                  className="cursor-pointer hover:opacity-80 transition-opacity h-28 w-auto object-contain block m-0 p-0"
                />
              </Link>
            </div>
          </div>

          {/* Nav Links — centered, flex-grow */}
          <nav
            className="hidden lg:flex flex-grow flex-wrap justify-center items-center gap-10"
            style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, padding: 0 }}
          >
            {/* Categorías */}
            <div className="relative group inline-block">
              <span className="dropdown-toggle-ref">Categorías ♡</span>
              <div className="dropdown-panel-ref">
                <Link
                  href="/"
                  className="dropdown-item-ref col-span-full border-b border-[#ffd2e9] mb-2 pb-3 text-kawaii-pink font-bold"
                >
                  Ver Todo →
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/category/${encodeURIComponent(cat)}`}
                    className={`dropdown-item-ref ${activeCategory === cat ? 'active' : ''}`}
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>

            {/* Colecciones */}
            <div className="relative group inline-block">
              <span className="dropdown-toggle-ref">Colecciones ♡</span>
              <div className="dropdown-panel-ref">
                <Link
                  href="/"
                  className="dropdown-item-ref col-span-full border-b border-[#ffd2e9] mb-2 pb-3 text-kawaii-pink font-bold"
                >
                  Ver Todo →
                </Link>
                {collections.map((col) => (
                  <Link
                    key={col}
                    href={`/collection/${encodeURIComponent(col)}`}
                    className={`dropdown-item-ref ${activeCollection === col ? 'active' : ''}`}
                  >
                    {col}
                  </Link>
                ))}
              </div>
            </div>

            {/* Promociones */}
            <div className="relative group inline-block">
              <Link 
                href="/?promo=true"
                className={`dropdown-toggle-ref cursor-pointer ${activePromotion ? 'text-kawaii-pink' : ''}`}
              >
                Promociones ♡
              </Link>
            </div>

            {/* Redes */}
            <div className="relative group inline-block">
              <span className="dropdown-toggle-ref">Redes ♡</span>
              <div className="dropdown-panel-ref right-0 left-auto min-w-[180px] grid-cols-1">
                <a href={igUrl} target="_blank" rel="noopener noreferrer" className="dropdown-item-ref flex items-center gap-3">
                  <img src={instagramIconUrl} className="w-6 h-6 object-contain" alt="IG" /> Instagram
                </a>
                <a href={ttUrl} target="_blank" rel="noopener noreferrer" className="dropdown-item-ref flex items-center gap-3">
                  <img src={tiktokIconUrl} className="w-6 h-6 object-contain" alt="TT" /> TikTok
                </a>
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="dropdown-item-ref flex items-center gap-3">
                  <img src={whatsappIconUrl} className="w-6 h-6 object-contain" alt="WA" /> WhatsApp
                </a>
                <div className="dropdown-item-ref flex items-center gap-3">
                  <img src="/assets/pin.png" className="w-6 h-6" alt="Pin" /> Dirección
                </div>
              </div>
            </div>
          </nav>

          {/* Right side: Search + Cart */}
          <div className="flex items-center ml-2 gap-2 flex-shrink-0">
            {/* Search bar — reference style */}
            {/* Mobile trigger. Hidden from `sm` up, where the inline input fits. */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={mobileSearchOpen ? 'Cerrar busqueda' : 'Buscar'}
              aria-expanded={mobileSearchOpen}
              className="sm:hidden w-10 h-10 rounded-full border-2 border-[#ffd2e9] text-kawaii-pink flex items-center justify-center bg-white/70 active:scale-95 transition-transform flex-shrink-0"
            >
              {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
            </button>

            {/*
              Below `sm` this is a full-width bar pinned under the header rather
              than a box competing with the logo for space. `absolute` + inset
              rather than a width, so it can never be wider than the screen.
            */}
            <div
              ref={searchContainerRef}
              className={`${
                mobileSearchOpen
                  ? 'absolute left-2 right-2 top-full mt-2 flex'
                  : 'hidden'
              } sm:static sm:mt-0 sm:flex sm:left-auto sm:right-auto relative sm:w-48 lg:w-64`}
            >
              <input
                type="text"
                placeholder="Buscar producto..."
                autoFocus={mobileSearchOpen}
                className="w-full text-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={e => {
                  if (searchQuery.trim() !== '') setIsSearchOpen(true);
                  e.target.style.borderColor = '#FF69B4';
                  e.target.style.boxShadow = '0 0 20px rgba(255,107,157,0.2)';
                  e.target.style.background = 'white';
                }}
                style={{
                  border: '2px solid #ffd2e9',
                  borderRadius: '25px',
                  padding: '8px 20px',
                  background: 'rgba(255,255,255,0.8)',
                  outline: 'none',
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 500,
                  color: '#444',
                  transition: 'all 0.3s ease',
                }}
                onBlur={e => { e.target.style.borderColor = '#ffd2e9'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.8)'; }}
              />

              {/* Live Dropdown Overlay */}
              {isSearchOpen && (
                /*
                  Two positioning modes.

                  Mobile: `fixed` with left/right insets, so the panel is bounded
                  by the viewport itself. It used to be `absolute right-0 w-72`
                  anchored to a narrow box that sits ~150px in from the screen
                  edge -- 288px of panel extending leftward from there started
                  off-screen, which is why the results were sliced down the left.

                  sm and up: back to anchoring under the input, where there is
                  room. max-h + scroll keeps a long result list from running off
                  the bottom on a short screen.
                */
                <div
                  className="fixed left-2 right-2 top-[4.5rem] sm:absolute sm:top-full sm:left-auto sm:right-0 sm:mt-3 sm:w-80 md:w-96 max-h-[70vh] overflow-y-auto bg-white/95 backdrop-blur-md border-2 border-[#ffd2e9] rounded-3xl shadow-[0_10px_30px_rgba(255,107,157,0.15)] z-[1000] p-3 flex flex-col gap-2"
                >
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 pb-1 border-b border-pink-50">
                    Resultados de búsqueda
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="text-center py-6 text-sm font-bold text-slate-400 italic">
                      No se encontraron resultados 😿
                    </div>
                  ) : (
                    searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                          router.push(`/product/${toSlug(item.name, item.id)}`);
                        }}
                        className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gradient-to-r hover:from-kawaii-light-pink/5 hover:to-kawaii-light-pink/20 transition-all cursor-pointer border border-transparent hover:border-kawaii-pink/20 group"
                      >
                        <img 
                          src={getOptimizedImage(item.image, 80)} 
                          className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-100 group-hover:scale-105 transition-transform" 
                          alt={item.name} 
                          onError={(e) => {
                            (e.target as any).src = 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&q=80&w=400';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-kawaii-pink transition-colors">
                            {item.name}
                          </h4>
                          <span className="text-[10px] font-black text-kawaii-pink">
                            ${calculatePrices(item.base_price_usd, rates).usd.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  {searchResults.length > 0 && (
                    <button
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      }}
                      className="w-full text-center py-2 text-[10px] font-black uppercase text-kawaii-pink hover:text-kawaii-purple hover:bg-pink-50/50 rounded-xl border border-dashed border-[#ffd2e9] mt-1 transition-colors cursor-pointer"
                    >
                      Ver todos los resultados ({searchResults.length}+) →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Favoritos */}
            <Link
              href="/favoritos"
              title="Mis favoritos"
              className="relative flex items-center justify-center cursor-pointer transition-all duration-300 w-11 h-11 rounded-full flex-shrink-0 border-2 border-[#ffd2e9] text-kawaii-pink hover:bg-[#fff6fa] hover:border-kawaii-pink"
            >
              <Heart size={19} strokeWidth={2.5} fill={favoritesCount > 0 ? 'currentColor' : 'none'} />
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center bg-kawaii-pink text-white text-[10px] font-black rounded-full min-w-5 min-h-5 p-1 border-2 border-white">
                  {favoritesCount}
                </span>
              )}
            </Link>

            {/* Account link */}
            <Link
              href={user ? '/account' : '/account/login'}
              title={user ? 'Mi cuenta' : 'Iniciar sesion'}
              className="relative flex items-center justify-center cursor-pointer transition-all duration-300 w-11 h-11 rounded-full flex-shrink-0 border-2 border-[#ffd2e9] text-kawaii-pink hover:bg-[#fff6fa] hover:border-kawaii-pink"
            >
              <User size={20} strokeWidth={2.5} />
              {user && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
              )}
            </Link>

            {/* Cart button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center justify-center cursor-pointer transition-all duration-300 w-12 h-12 rounded-full flex-shrink-0 shadow-[0_4px_15px_rgba(255,107,157,0.3)] bg-gradient-to-br from-kawaii-pink to-kawaii-light-pink hover:translate-y-[-2px] hover:shadow-[0_6px_20px_rgba(255,107,157,0.4)]"
            >
              {/* Cart SVG */}
              <svg fill="white" stroke="white" width="22px" height="22px" viewBox="144 144 512 512" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#cart-clip)">
                  <defs>
                    <clipPath id="cart-clip">
                      <path d="m148.09 190h503.81v420h-503.81z"/>
                    </clipPath>
                  </defs>
                  <path d="m246.17 257.25-6.9961-41.984h-25.105c-3.7422-14.445-16.777-25.191-32.387-25.191-18.523 0-33.586 15.062-33.586 33.586 0 18.523 15.062 33.586 33.586 33.586 15.609 0 28.641-10.746 32.395-25.191h10.867l4.1992 25.191-0.32031 0.003906 43.422 218.45c-20.699 1.5781-37.938 17.516-39.969 37.566-1.1914 11.797 2.6875 23.613 10.648 32.395 7.9648 8.8086 19.316 13.871 31.125 13.871h16.793c0 27.785 22.598 50.383 50.383 50.383s50.383-22.598 50.383-50.383h92.363c0 27.785 22.598 50.383 50.383 50.383 27.785 0 50.383-22.598 50.383-50.383h33.586c4.6445 0 8.3984-3.7539 8.3984-8.3984s-3.7539-8.3984-8.3984-8.3984h-36.527c-6.9375-19.539-25.551-33.586-47.441-33.586-21.891 0-40.508 14.047-47.441 33.586h-98.242c-6.9375-19.539-25.551-33.586-47.441-33.586-21.891 0-40.508 14.047-47.441 33.586l-19.738 0.003906c-7.0703 0-13.871-3.0391-18.676-8.3398-4.8438-5.3672-7.1211-12.27-6.3906-19.445 1.2773-12.672 12.98-22.586 26.645-22.586h6.6406 0.32812 327.43c23.102-0.011719 41.883-18.797 41.883-41.887v-193.23zm-64.488-16.797c-9.2617 0-16.793-7.5312-16.793-16.793 0-9.2617 7.5312-16.793 16.793-16.793 9.2617 0 16.793 7.5312 16.793 16.793 0.003906 9.2617-7.5312 16.793-16.793 16.793zm352.67 285.49c18.523 0 33.586 15.062 33.586 33.586 0 18.523-15.062 33.586-33.586 33.586-18.523 0-33.586-15.062-33.586-33.586 0-18.52 15.062-33.586 33.586-33.586zm-193.12 0c18.523 0 33.586 15.062 33.586 33.586 0 18.523-15.062 33.586-33.586 33.586-18.523 0-33.586-15.062-33.586-33.586-0.003907-18.52 15.062-33.586 33.586-33.586zm293.89-75.461c0 13.828-11.25 25.082-25.082 25.082h-320.69l-40.055-201.52h385.83z"/>
                </g>
              </svg>
              {/* Badge */}
              {cartItems.reduce((s, i) => s + i.quantity, 0) > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center bg-kawaii-pink text-white text-[10px] font-black rounded-full min-w-5 min-h-5 p-1 border-2 border-white shadow-[0_2px_8px_rgba(255,107,157,0.3)] font-sans"
                >
                  {cartItems.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-white shadow-xl border-b-2 border-kawaii-pink flex flex-col p-4 z-40 max-h-[80vh] overflow-y-auto">
            
            {/*
              Three destinations that were three stacked full-width rows, each
              costing a whole line of a menu already ~40 rows long. As a row of
              tiles they fit on one line and are easier to hit with a thumb.
            */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { href: user ? '/account' : '/account/login', label: 'Pedidos', Icon: Package, active: false },
                { href: '/favoritos', label: 'Favoritos', Icon: Heart, active: false },
                { href: '/?promo=true', label: 'Promos', Icon: Tag, active: activePromotion },
              ].map(({ href, label, Icon, active }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-colors ${
                    active
                      ? 'bg-kawaii-pink border-kawaii-pink text-white'
                      : 'bg-[#fff8fc] border-[#ffe3f1] text-slate-600 active:bg-[#fff0f7]'
                  }`}
                >
                  <Icon size={19} className={active ? 'text-white' : 'text-kawaii-pink'} />
                  <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
                </Link>
              ))}
            </div>

            {/*
              Categories and collections as a two-column pill grid rather than one
              name per row. With ~22 categories and ~39 collections the old list
              was over 60 lines of scrolling to reach the social links at the
              bottom; two columns halves that, and pills give a much bigger tap
              target than a bare text link.
            */}
            {([
              { title: 'Categorías', items: categories, base: '/category', active: activeCategory },
              { title: 'Colecciones', items: collections, base: '/collection', active: activeCollection },
            ] as const).map(({ title, items, base, active }) => (
              <details key={title} className="mb-3 group" open>
                <summary className="font-bold text-kawaii-pink uppercase text-xs tracking-widest border-b border-pink-100 pb-2 cursor-pointer flex justify-between items-center list-none outline-none">
                  <span>
                    {title} <span className="text-slate-300 font-semibold normal-case tracking-normal">({items.length})</span>
                  </span>
                  <ChevronDown size={16} className="text-kawaii-pink group-open:rotate-180 transition-transform" />
                </summary>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Link
                    href="/"
                    onClick={() => setIsMenuOpen(false)}
                    className="col-span-2 text-center text-xs font-black uppercase tracking-wider text-kawaii-pink bg-[#fff0f7] rounded-xl py-2.5"
                  >
                    Ver todo →
                  </Link>
                  {items.map((name) => (
                    <Link
                      key={name}
                      href={`${base}/${encodeURIComponent(name)}`}
                      onClick={() => setIsMenuOpen(false)}
                      className={`text-[12px] leading-tight font-semibold rounded-xl px-3 py-2.5 border transition-colors ${
                        active === name
                          ? 'bg-kawaii-pink border-kawaii-pink text-white'
                          : 'bg-white border-[#ffe3f1] text-slate-600 active:bg-[#fff8fc]'
                      }`}
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              </details>
            ))}

            <div className="font-bold text-kawaii-pink mb-1 uppercase text-xs tracking-widest border-b border-pink-100 pb-2 mt-2">Redes ♡</div>
            <div className="flex gap-5 justify-center py-4">
              <a href={igUrl} target="_blank" rel="noopener noreferrer"><img src={instagramIconUrl} className="w-9 h-9 object-contain active:scale-95 transition-transform" alt="IG" /></a>
              <a href={ttUrl} target="_blank" rel="noopener noreferrer"><img src={tiktokIconUrl} className="w-9 h-9 object-contain active:scale-95 transition-transform" alt="TT" /></a>
              <a href={waUrl} target="_blank" rel="noopener noreferrer"><img src={whatsappIconUrl} className="w-9 h-9 object-contain active:scale-95 transition-transform" alt="WA" /></a>
            </div>
          </div>
        )}
      </header>

      {/* Main content slot */}
      <div className="flex-grow">
        {children}
      </div>

      {/* Pretty Notification Pop-up */}
      {toast && (
        <div className="fixed top-24 right-4 z-[200] animate-in fade-in slide-in-from-right-8 duration-500">
           <div className="bg-gradient-to-r from-kawaii-pink via-[#FF8DC7] to-[#FFAACC] text-white px-6 py-4 rounded-2xl shadow-[0_10px_30px_rgba(255,107,157,0.35)] flex items-center gap-3 border border-white/30 backdrop-blur-md">
              <div className="bg-white/20 p-2 rounded-full border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                <CheckCircle2 size={24} strokeWidth={3} />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-widest bubble-font flex items-center gap-1.5">
                  {toast.message}
                </p>
                <p className="text-[9px] text-pink-50/95 font-extrabold tracking-widest">
                  RECUERDA COMPLETAR TU PAGO ♡
                </p>
              </div>
           </div>
        </div>
      )}

      {/* Floating support widget (chat + WhatsApp + email) */}
      <SupportWidget />

      {/* Footer Kawaii */}
      <footer className="bg-slate-50 border-t-2 border-kawaii-light-pink/20 py-20 px-6 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
          <div className="col-span-2">
            <h1 className="text-3xl font-black tracking-tighter mb-4 text-kawaii-pink">INDIGO STORE</h1>
            <p className="text-slate-500 max-w-sm leading-relaxed font-medium italic">
              "Llevando dulzura y estilo a cada rincón. Rejuvenece tu mundo con nuestros accesorios únicos."
            </p>
            <div className="flex gap-4 mt-8">
              <a href={igUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-2xl text-kawaii-pink shadow-sm hover:scale-110 transition-transform">
                <img src={instagramIconUrl} className="w-6 h-6 object-contain" alt="Instagram" />
              </a>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-2xl text-kawaii-pink shadow-sm hover:scale-110 transition-transform">
                <img src={whatsappIconUrl} className="w-6 h-6 object-contain" alt="WhatsApp" />
              </a>
              <div className="p-3 bg-white rounded-2xl text-kawaii-pink shadow-sm hover:scale-110 transition-transform">
                <img src="/assets/pin.png" className="w-6 h-6 object-contain" alt="Dirección" />
              </div>
            </div>
          </div>
          
          <div>
            <h5 className="font-bold uppercase tracking-widest text-xs mb-6 text-slate-400">Soporte</h5>
            <ul className="space-y-4 text-sm text-slate-600 font-bold">
              <li><Link href="/paginas/envios-nacionales" className="hover:text-kawaii-pink transition-colors">Envíos Nacionales</Link></li>
              <li><Link href="/paginas/retiro-en-tienda" className="hover:text-kawaii-pink transition-colors">Retiro en Tienda</Link></li>
              <li><Link href="/paginas/cashea" className="hover:text-kawaii-pink transition-colors">Pagos con Cashea</Link></li>
              <li><a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-kawaii-pink transition-colors">WhatsApp Help</a></li>
            </ul>
          </div>

          <div>
             <h5 className="font-bold uppercase tracking-widest text-xs mb-6 text-slate-400">Información</h5>
            <ul className="space-y-4 text-sm text-slate-600 font-bold">
              <li><Link href="/paginas/nosotros" className="hover:text-kawaii-pink transition-colors">Sobre Nosotros</Link></li>
              <li><Link href="/paginas/terminos" className="hover:text-kawaii-pink transition-colors">Términos y Condiciones</Link></li>
              <li><Link href="/paginas/privacidad" className="hover:text-kawaii-pink transition-colors">Política de Privacidad</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-200 text-center text-xs text-slate-400 uppercase tracking-widest font-bold">
          &copy; 2026 Indigo Store - Hecho con ✨ en la Nube
        </div>
      </footer>
    </div>
  );
}
