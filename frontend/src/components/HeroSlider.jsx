import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { img } from '../lib/format';
import { cx } from './ui';

const SLIDE_TIME = 6000;
const DEFAULT_PHOTO = '/images/hero-estate.webp';

export default function HeroSlider({ slides }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [stopped] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const touchStart = useRef(null);

  const current = Math.min(index, count - 1);
  const slide = slides[current];
  const running = count > 1 && !hovering && !stopped;
  const go = (next) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setTimeout(() => {
      if (!document.hidden) setIndex((item) => (item + 1) % count);
    }, SLIDE_TIME);
    return () => clearTimeout(timer);
  }, [running, current, count]);

  const onTouchStart = (event) => {
    touchStart.current = event.touches[0].clientX;
  };

  const onTouchEnd = (event) => {
    if (touchStart.current == null || count < 2) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 50) go(current + (distance < 0 ? 1 : -1));
    touchStart.current = null;
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') go(current + 1);
    if (event.key === 'ArrowLeft') go(current - 1);
  };

  const link = slide.button_link || '/shop';
  const external = /^https?:\/\//.test(link);
  const ActionLink = external ? 'a' : Link;
  const actionProps = external ? { href: link } : { to: link };

  return (
    <section
      className="group/hero relative w-full overflow-hidden bg-sand-100"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={() => setHovering(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
    >
      {/* Background Banner Image — Bright original image */}
      {slides.map((item, itemIndex) => (
        <img
          key={`${item.image}-${itemIndex}`}
          src={item.image ? img(item.image) : DEFAULT_PHOTO}
          alt={item.title || 'Sannara'}
          loading={itemIndex === 0 ? 'eager' : 'lazy'}
          fetchPriority={itemIndex === 0 ? 'high' : undefined}
          className={cx(
            'pointer-events-none absolute inset-0 size-full object-cover object-center transition-opacity duration-700 ease-soft',
            itemIndex === current ? 'opacity-100' : 'opacity-0'
          )}
        />
      ))}

      {/* Directional Vignette Overlay — Left-side only soft gradient protects text legibility, leaving the center and right screen 100% bright, light, and natural */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full sm:w-3/5 lg:w-1/2 z-[1] bg-gradient-to-r from-black/75 via-black/35 to-transparent"
        aria-hidden
      />

      {/* Main Content Layout — Seamless Editorial Typography directly on the image */}
      <div className="container-page relative z-10 flex min-h-[420px] items-center py-12 sm:min-h-[480px] sm:py-16 lg:min-h-[540px]">
        <div
          key={current}
          className="w-full max-w-xl py-4 animate-fade-in"
          aria-live={running ? 'off' : 'polite'}
        >
          <h1 className="font-display text-3xl leading-[1.1] font-semibold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] sm:text-5xl lg:text-[3.25rem]">
            {slide.title}
          </h1>

          {slide.subtitle && (
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-sand-100 drop-shadow-[0_1px_5px_rgba(0,0,0,0.8)] sm:text-[15.5px] font-normal line-clamp-3">
              {slide.subtitle}
            </p>
          )}

          <div className="mt-8">
            <ActionLink
              {...actionProps}
              className="inline-flex items-center gap-2.5 rounded-full bg-brand-500 px-8 py-3.5 text-sm sm:text-[15px] font-semibold tracking-wide text-white shadow-xl shadow-black/30 transition-all duration-200 hover:bg-brand-400 hover:shadow-2xl hover:translate-x-0.5 active:scale-95"
            >
              <span>{slide.button_label || 'Shop the collection'}</span>
              <ArrowRight className="size-4" aria-hidden />
            </ActionLink>
          </div>
        </div>
      </div>

      {/* Navigation Arrows — Sleek Translucent Glass Buttons */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label="Previous banner"
            className="hidden sm:flex absolute left-5 top-1/2 z-20 size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:border-white hover:bg-white hover:text-ink-950"
          >
            <ChevronLeft className="size-5 shrink-0 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label="Next banner"
            className="hidden sm:flex absolute right-5 top-1/2 z-20 size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:border-white hover:bg-white hover:text-ink-950"
          >
            <ChevronRight className="size-5 shrink-0 stroke-[2.5]" />
          </button>

          {/* Simple Clean Bottom Dots */}
          <div
            className="absolute bottom-6 inset-x-0 z-20 flex justify-center items-center gap-2"
            role="tablist"
            aria-label="Choose a banner"
          >
            {slides.map((_, itemIndex) => (
              <button
                key={itemIndex}
                type="button"
                aria-label={`Slide ${itemIndex + 1}`}
                onClick={() => go(itemIndex)}
                className={cx(
                  'h-2 rounded-full transition-all duration-300',
                  itemIndex === current ? 'w-8 bg-white shadow-md' : 'w-2 bg-white/40 hover:bg-white/70'
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
