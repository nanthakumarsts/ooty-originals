import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Leaf, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { img, photoFit } from '../lib/format';
import { useShop } from '../context/ShopContext';
import useApi from '../hooks/useApi';
import { HeroSkeleton, LoadError } from '../components/Skeletons';
import { ProductGrid, ProductGridSkeleton } from '../components/product/ProductCard';
import HeroSlider from '../components/HeroSlider';
import Reveal from '../components/Reveal';
import TextReveal from '../components/TextReveal';
import { usePageTitle } from '../components/ui';

// Everything on this page comes from the admin panel:
//   hero, highlights and story  → Site settings
//   categories and collections  → Categories (name, description, photo, position)
//   product rows                → Products (best seller flag, newest)
const PROMISE_ICONS = [Leaf, PackageCheck, Truck, ShieldCheck];

function SectionHeading({ eyebrow, title, to, linkLabel = 'View all' }) {
  return (
    <Reveal className="mb-8 flex items-end justify-between gap-6 sm:mb-10">
      <div>
        <p className="eyebrow mb-2.5">{eyebrow}</p>
        <TextReveal as="h2" text={title} className="section-title" />
      </div>
      {to && (
        <Link to={to} className="group hidden shrink-0 items-center gap-1.5 pb-1 text-[15px] font-semibold text-brand-600 sm:inline-flex">
          {linkLabel}
          <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </Reveal>
  );
}

function ProductRow({ query, eyebrow, title, to }) {
  // keeps trying by itself if the request fails, so the row is never silently missing
  const { data, error, loading, reload } = useApi(`/products?${query}&limit=4`);
  const products = data?.items;
  if (products && !products.length) return null; // nothing to show in this row (e.g. no best sellers picked yet)
  return (
    <section className="container-page py-14 sm:py-20">
      <SectionHeading eyebrow={eyebrow} title={title} to={to} />
      {products ? <ProductGrid products={products} /> : error && !loading ? <LoadError message={error} onRetry={reload} /> : <ProductGridSkeleton count={4} />}
      <Link to={to} className="btn btn-outline mt-8 w-full sm:hidden">View all</Link>
    </section>
  );
}

function CategoryCarousel({ categories }) {
  const containerRef = useRef(null);
  const isInteractingRef = useRef(false);
  const resumeTimerRef = useRef(null);

  const items = categories.length ? [...categories, ...categories] : [];

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !items.length) return;

    let animId;
    let lastTime = performance.now();
    const speed = 0.55; // pixels per frame (smooth ~35px/s glide)

    const tick = (now) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      if (!isInteractingRef.current) {
        el.scrollLeft += speed * (dt / 16.67);
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [items.length]);

  const pause = () => {
    isInteractingRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };

  const resume = (delay = 1200) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, delay);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={pause}
      onMouseLeave={() => resume(200)}
      onTouchStart={pause}
      onTouchEnd={() => resume(1500)}
      className="flex gap-4 sm:gap-5 overflow-x-auto py-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {(items.length ? items : Array.from({ length: 12 })).map((c, i) => (
        <div key={`${c?.id || 'skel'}-${i}`} className="w-36 shrink-0 sm:w-52">
          {c ? (
            <Link to={`/shop?category=${c.slug}`} className="group block">
              <div className="overflow-hidden rounded-2xl bg-sand-100 shadow-xs transition-shadow duration-300 group-hover:shadow-md">
                <img
                  src={img(c.image)}
                  alt={c.name}
                  loading="lazy"
                  draggable="false"
                  className={`aspect-[8/5] w-full object-cover transition-transform duration-700 ease-soft group-hover:scale-110 ${photoFit(c.image)}`}
                />
              </div>
              <p className="mt-2.5 text-[14px] sm:text-[15px] leading-snug font-semibold text-ink-900 transition-colors duration-200 group-hover:text-brand-600 line-clamp-1">
                {c.name}
              </p>
              <p className="text-[11px] sm:text-xs text-ink-400 font-medium">{c.product_count} products</p>
            </Link>
          ) : (
            <div>
              <div className="skeleton aspect-[8/5] rounded-2xl" />
              <div className="skeleton mt-2.5 sm:mt-3 h-4 w-2/3" />
              <div className="skeleton mt-1 sm:mt-1.5 h-3 w-1/3" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const DEFAULT_HERO_SLIDES = [
  {
    image: '/images/hero-estate.webp',
    eyebrow: 'Authentic Nilgiri Products',
    title: 'From the Nilgiri hills to your home',
    subtitle: 'Estate-fresh teas, homemade chocolates, pure essential oils and classic Ooty varkey — sourced directly from local growers and makers, packed fresh in Ooty.',
    button_label: 'Shop the collection',
    button_link: '/shop',
    showcase_image: '/images/story-tea.webp',
    showcase_badge: '✨ SPECIAL HARVEST',
    showcase_category: 'Nilgiri Single Estate Tea',
    showcase_title: 'Nilgiri Whole Leaf Black Tea',
    showcase_rating: '4.9',
    showcase_price: '₹260',
    showcase_link: '/shop?category=nilgiri-teas',
  },
  {
    image: '/images/col-chocolate.webp',
    eyebrow: 'Handmade in Ooty · Pure Cocoa',
    title: 'Rich, artisanal homemade chocolates',
    subtitle: 'Crafted in small hill-station batches with pure cocoa butter, roasted mountain almonds, and melt-in-mouth fillings.',
    button_label: 'Explore Chocolates',
    button_link: '/shop?category=homemade-chocolates',
    showcase_image: '/uploads/products/assorted-homemade-chocolates-1.webp',
    showcase_badge: '🔥 BEST SELLER',
    showcase_category: 'Artisanal Hill Chocolates',
    showcase_title: 'Assorted Homemade Chocolates',
    showcase_rating: '5.0',
    showcase_price: '₹400',
    showcase_link: '/shop?category=homemade-chocolates',
  },
  {
    image: '/images/col-oils.webp',
    eyebrow: '100% Steam Distilled · Pure & Natural',
    title: 'Pure therapeutic hill essential oils',
    subtitle: 'Wild Nilgiri eucalyptus, wintergreen and cold-pressed botanical oils distilled fresh for natural healing, pain relief and aromatherapy.',
    button_label: 'Discover Essential Oils',
    button_link: '/shop?category=essential-oils',
    showcase_image: '/uploads/products/eucalyptus-oil-1.webp',
    showcase_badge: '🌿 100% PURE',
    showcase_category: 'Nilgiri Forest Extracts',
    showcase_title: 'Pure Nilgiri Eucalyptus Oil',
    showcase_rating: '4.9',
    showcase_price: 'From ₹100',
    showcase_link: '/shop?category=essential-oils',
  },
];

const DEFAULT_PROMO_CARDS = [
  {
    eyebrow: 'ON THIS WEEK',
    title: 'ESTATE FRESH',
    title_highlight: 'NILGIRI TEAS',
    subtitle: 'Limits Time Offer',
    button_label: 'ORDER NOW',
    button_link: '/shop?category=nilgiri-teas',
    badge_text: '100%',
    badge_subtext: 'PURE',
    image: '/uploads/products/nilgiri-black-tea-150g-1.webp',
  },
  {
    eyebrow: 'WELCOME TO SANNARA',
    title: 'ARTISANAL',
    title_highlight: 'CHOCOLATES',
    subtitle: 'Limits Time Offer',
    button_label: 'ORDER NOW',
    button_link: '/shop?category=homemade-chocolates',
    badge_text: '15%',
    badge_subtext: 'OFF',
    image: '/uploads/products/assorted-homemade-chocolates-1.webp',
  },
  {
    eyebrow: 'ON THIS WEEK',
    title: 'PURE NILGIRI',
    title_highlight: 'ESSENTIAL OILS',
    subtitle: 'Limits Time Offer',
    button_label: 'ORDER NOW',
    button_link: '/shop?category=essential-oils',
    badge_text: 'TOP',
    badge_subtext: 'SELLER',
    image: '/uploads/products/eucalyptus-oil-1.webp',
  },
];

const DEFAULT_PROMO_BANNER = {
  eyebrow: 'WELCOME TO SANNARA',
  title: 'TODAY SPECIAL',
  title_highlight: 'TEA TIME HAMPER',
  subtitle: 'Limits Time Offer · 5 Rare Nilgiri Treasures',
  text: 'Experience Nilgiri Cardamom Tea, Fresh Roasted Coffee, Crisp Varkey, Wheat Biscuits & Rich Artisanal Chocolates.',
  button_label: 'ORDER NOW',
  button_link: '/product/ooty-s-finest-five-tea-time-hamper',
  price: '₹999',
  compare_price: '₹1,360',
  badge_text: '27% Off',
  image: '/uploads/products/ooty-s-finest-five-tea-time-hamper-1.webp',
};

export default function Home() {
  usePageTitle('');
  const { settings, settingsReady, categories } = useShop();
  const promoRowRef = useRef(null);

  const scrollPromoRow = (dir) => {
    const el = promoRowRef.current;
    if (!el) return;
    const step = Math.max(320, el.clientWidth * 0.7);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  // Banners from Site settings. Older setups stored a single banner in separate fields — still honoured.
  const banners = settings.hero_slides && settings.hero_slides.length > 0
    ? settings.hero_slides
    : DEFAULT_HERO_SLIDES;

  const promoCards = settings.promo_cards && settings.promo_cards.length ? settings.promo_cards : DEFAULT_PROMO_CARDS;
  const promoBanners = (settings.promo_banners && settings.promo_banners.length)
    ? settings.promo_banners
    : (settings.promo_banner ? [settings.promo_banner] : [DEFAULT_PROMO_BANNER]);

  const promises = settings.promises || [];
  const collections = categories.filter((c) => c.image).slice(0, 5); // the first five categories, in shop order
  const storyParagraphs = String(settings.story_text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      {/* Hero banners */}
      {settingsReady ? <HeroSlider slides={banners} /> : <HeroSkeleton />}

      {/* Highlights */}
      {promises.length > 0 && (
        <section aria-label="Why shop with us" className="border-b border-sand-200 bg-white">
          <ul className="container-page grid grid-cols-2 gap-x-6 gap-y-7 py-9 lg:grid-cols-4">
            {promises.map((promise, i) => {
              const Icon = PROMISE_ICONS[i % PROMISE_ICONS.length];
              return (
                <Reveal as="li" key={promise.title} delay={i * 90} className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Icon className="size-5" strokeWidth={1.7} aria-hidden />
                  </span>
                  <div>
                    <p className="text-[15px] leading-snug font-semibold">{promise.title}</p>
                    {promise.text && <p className="mt-0.5 text-sm leading-snug text-ink-500">{promise.text}</p>}
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </section>
      )}

      {/* Categories — auto-scrolling & touch-swipeable category carousel */}
      <section className="container-page py-10 sm:py-20">
        <SectionHeading eyebrow="Browse" title="Shop by category" to="/shop" linkLabel="All products" />
        <div className="relative -mx-4 overflow-hidden px-4 sm:-mx-6 sm:px-6">
          {/* Subtle edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-cream to-transparent sm:w-16" aria-hidden />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-cream to-transparent sm:w-16" aria-hidden />

          <CategoryCarousel categories={categories} />
        </div>
      </section>

      <div className="bg-white">
        <ProductRow query="tag=bestseller" eyebrow="Most loved" title="Best sellers" to="/shop?tag=bestseller" />
      </div>

      {/* "A taste of the hills" — Atmospheric Offer Cards */}
      {promoCards.length > 0 && (
        <section className="container-page py-14 sm:py-20">
          <div className="mb-8 flex items-end justify-between gap-6 sm:mb-10">
            <Reveal>
              <p className="eyebrow mb-2.5">Collections</p>
              <TextReveal as="h2" text="A taste of the hills" className="section-title" />
            </Reveal>
            <div className="flex items-center gap-3">
              {promoCards.length > 3 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollPromoRow(-1)}
                    aria-label="Scroll offers left"
                    className="flex size-9 items-center justify-center rounded-full border border-sand-300 bg-white text-ink-700 shadow-sm transition-colors hover:border-brand-600 hover:bg-brand-50 hover:text-brand-600"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollPromoRow(1)}
                    aria-label="Scroll offers right"
                    className="flex size-9 items-center justify-center rounded-full border border-sand-300 bg-white text-ink-700 shadow-sm transition-colors hover:border-brand-600 hover:bg-brand-50 hover:text-brand-600"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
              <Link to="/shop" className="group hidden shrink-0 items-center gap-1.5 pb-1 text-[15px] font-semibold text-brand-600 sm:inline-flex">
                All collections
                <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          </div>

          <div
            ref={promoRowRef}
            className={
              promoCards.length === 1
                ? 'grid gap-6 max-w-md mx-auto'
                : promoCards.length === 2
                  ? 'grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto'
                  : 'flex gap-6 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            }
          >
            {promoCards.map((card, i) => (
              <div
                key={`${card.title}-${i}`}
                className={`group relative overflow-hidden rounded-3xl p-7 text-white border border-white/10 shadow-xl transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/60 ${
                  promoCards.length >= 3 ? 'shrink-0 w-[86%] sm:w-[calc(50%-12px)] lg:w-[calc((100%-48px)/3)] snap-start' : ''
                }`}
              >
                {/* Deep dark rich background with subtle atmospheric photo texture */}
                <div className="absolute inset-0 -z-10 overflow-hidden bg-[#121614]">
                  {card.image && (
                    <img
                      src={img(card.image)}
                      alt=""
                      aria-hidden
                      className="size-full object-cover object-center scale-110 blur-[2px] opacity-20 transition-transform duration-700 ease-soft group-hover:scale-125"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121614] via-[#121614]/95 to-[#121614]/80" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#121614]/95 via-[#121614]/90 to-[#121614]/60" />
                </div>

                {/* Decorative ambient subtle green corner glow */}
                <div className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-brand-500/10 blur-2xl group-hover:bg-brand-500/20 transition-colors" aria-hidden />

                <div className="relative z-10 flex flex-col justify-between h-full min-h-[300px]">
                  <div>
                    <span className="inline-block text-xs font-semibold tracking-widest text-white/80 uppercase">
                      {card.eyebrow || 'ON THIS WEEK'}
                    </span>
                    <h3 className="mt-2.5 font-display text-2xl sm:text-[1.7rem] font-medium leading-tight tracking-tight text-white">
                      <Link to={card.button_link || '/shop'} className="hover:underline">
                        {card.title} {card.title_highlight && <><br /><span className="text-white">{card.title_highlight}</span></>}
                      </Link>
                    </h3>
                    {card.subtitle && (
                      <p className="mt-2 text-xs font-semibold text-white/75 uppercase tracking-wider">
                        {card.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-4">
                    <Link
                      to={card.button_link || '/shop'}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-md transition-all duration-300 hover:bg-brand-500 group-hover:shadow-brand-600/30"
                    >
                      {card.button_label || 'ORDER NOW'}
                      <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    {/* Inner small showcase image */}
                    <div className="relative shrink-0 w-36 sm:w-44">
                      {card.badge_text && (
                        <div className="pointer-events-none absolute -top-3.5 right-1 z-20 flex flex-col items-center">
                          <div className="flex size-11 items-center justify-center rounded-full bg-brand-600 text-center font-bold leading-none text-white shadow-lg border border-white/20">
                            <span className="text-[10px] leading-tight font-bold uppercase text-white">
                              {card.badge_text}<br/>{card.badge_subtext && <span className="text-[8px] font-medium text-white/90">{card.badge_subtext}</span>}
                            </span>
                          </div>
                        </div>
                      )}

                      <Link to={card.button_link || '/shop'} className="overflow-hidden rounded-2xl border border-white/20 bg-ink-900/80 p-1 shadow-2xl backdrop-blur-md block">
                        <img
                          src={img(card.image)}
                          alt={card.title}
                          className="aspect-square w-full object-cover rounded-xl drop-shadow-2xl transition-transform duration-500 ease-soft group-hover:scale-110"
                        />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Wide Panoramic Promo Banners (Directly above New arrivals) */}
      {promoBanners.length > 0 && (
        <section className="container-page py-6 sm:py-10 space-y-8">
          {promoBanners.map((promoBanner, idx) => (
            <div
              key={`${promoBanner.title}-${idx}`}
              className="group relative overflow-hidden rounded-3xl p-8 sm:p-12 lg:p-14 text-white border border-white/10 shadow-2xl transition-all duration-500 hover:shadow-black/50"
            >
              {/* Background Image with Dark Vignette so text is crystal clear */}
              <div className="absolute inset-0 -z-10 overflow-hidden bg-[#121614]">
                {promoBanner.image && (
                  <img
                    src={img(promoBanner.image)}
                    alt=""
                    aria-hidden
                    className="size-full object-cover object-center scale-105 blur-[2px] opacity-25 transition-transform duration-700 ease-soft group-hover:scale-110"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-[#121614] via-[#121614]/95 to-[#121614]/70" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121614]/80 via-transparent to-transparent" />
              </div>

              <div className="pointer-events-none absolute top-1/2 right-1/4 -translate-y-1/2 size-96 rounded-full bg-brand-500/10 blur-3xl group-hover:bg-brand-500/20 transition-colors" aria-hidden />

              <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="max-w-xl">
                  <span className="inline-block text-xs font-semibold tracking-widest text-white/80 uppercase sm:text-sm">
                    {promoBanner.eyebrow || 'WELCOME TO SANNARA'}
                  </span>
                  <h2 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                    <Link to={promoBanner.button_link || '/shop'} className="hover:underline">
                      {promoBanner.title} {promoBanner.title_highlight && <><br /><span className="text-white">{promoBanner.title_highlight}</span></>}
                    </Link>
                  </h2>
                  {promoBanner.subtitle && (
                    <p className="mt-2.5 text-xs font-semibold text-white/75 uppercase tracking-wider sm:text-sm">
                      {promoBanner.subtitle}
                    </p>
                  )}
                  {promoBanner.text && (
                    <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base max-w-md">
                      {promoBanner.text}
                    </p>
                  )}

                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <Link
                      to={promoBanner.button_link || '/shop'}
                      className="inline-flex items-center gap-3 rounded-xl bg-brand-600 px-7 py-3.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg transition-all duration-300 hover:bg-brand-500 group-hover:shadow-brand-600/40"
                    >
                      {promoBanner.button_label || 'ORDER NOW'}
                      <span className="flex size-5 items-center justify-center rounded-sm bg-white text-brand-700 font-bold">
                        <ArrowRight className="size-3.5" />
                      </span>
                    </Link>
                    {promoBanner.price && (
                      <span className="text-sm font-semibold text-white/90">
                        Only <span className="text-xl font-bold text-white">{promoBanner.price}</span> {promoBanner.compare_price && <span className="line-through text-xs text-white/50">{promoBanner.compare_price}</span>}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative flex items-center justify-center">
                  {promoBanner.badge_text && (
                    <div className="pointer-events-none absolute -top-4 left-4 sm:left-8 z-20">
                      <div className="relative rounded-xl border border-white/20 bg-brand-600 px-3.5 py-1.5 font-semibold text-white shadow-xl">
                        <span className="text-xs sm:text-sm font-bold tracking-tight uppercase text-white">{promoBanner.badge_text}</span>
                      </div>
                    </div>
                  )}

                  <Link to={promoBanner.button_link || '/shop'} className="relative overflow-hidden rounded-3xl border border-white/20 bg-ink-900/80 p-1.5 shadow-2xl backdrop-blur-md block">
                    <img
                      src={img(promoBanner.image)}
                      alt={promoBanner.title}
                      className="aspect-[4/3] w-full max-w-md object-cover rounded-2xl drop-shadow-2xl transition-transform duration-700 ease-soft group-hover:scale-105"
                    />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="bg-white">
        <ProductRow query="sort=latest" eyebrow="Just in" title="New arrivals" to="/shop?sort=latest" />
      </div>

      {/* Story */}
      {settings.story_title && (
        <section className="container-page py-14 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <Reveal className="relative">
              <div className="overflow-hidden rounded-3xl">
                <img src="/images/hero-estate.webp" alt="Tea pickers at work on a Nilgiri estate" loading="lazy" className="aspect-[4/5] w-full object-cover object-[center_60%] sm:aspect-[5/4] lg:aspect-[4/5]" />
              </div>
              {settings.story_stat && (
                <Reveal delay={250} className="absolute right-3 -bottom-6 rounded-2xl bg-white p-4 shadow-lift sm:-right-3 sm:-bottom-5 sm:p-5 lg:-right-8">
                  <p className="font-display text-3xl text-brand-600 sm:text-4xl">{settings.story_stat}</p>
                  <p className="mt-1 max-w-[10rem] text-[13px] leading-snug text-ink-500 sm:max-w-[11rem] sm:text-sm">{settings.story_stat_text}</p>
                </Reveal>
              )}
            </Reveal>
            <Reveal delay={120}>
              <p className="eyebrow mb-3">Our story</p>
              <TextReveal as="h2" text={settings.story_title} className="section-title" />
              {storyParagraphs.map((paragraph, i) => (
                <p key={i} className={i === 0 ? 'mt-5 text-lg leading-relaxed text-ink-700' : 'mt-4 leading-relaxed text-ink-500'}>{paragraph}</p>
              ))}
              <Link to="/about" className="btn btn-dark mt-8">
                Read our story
                <ArrowRight className="size-[18px]" aria-hidden />
              </Link>
            </Reveal>
          </div>
        </section>
      )}
    </>
  );
}
