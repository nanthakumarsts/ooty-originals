import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GitCompareArrows, Heart, ShoppingBag } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { img } from '../../lib/format';
import Reveal from '../Reveal';
import { Price, cx } from '../ui';

export default function ProductCard({ product, priority = false }) {
  const { addToCart, toggleWishlist, wishlistIds, toggleCompare, compare } = useShop();
  const navigate = useNavigate();
  const wished = wishlistIds.has(product.id);
  const compared = compare.includes(product.id);
  const href = `/product/${product.slug}`;

  const handleAdd = () => (product.hasVariants ? navigate(href) : addToCart(product));

  // The photo fades in over a shimmering placeholder; a photo that cannot be loaded is swapped for a neutral one.
  const [photo, setPhoto] = useState('loading'); // loading | ready | failed
  const photoRef = useCallback((el) => {
    if (el?.complete && el.naturalWidth > 0) setPhoto((p) => (p === 'loading' ? 'ready' : p)); // already in the browser's cache
  }, []);

  return (
    <article className="group flex w-full flex-col">
      <div className={cx('relative overflow-hidden rounded-2xl bg-sand-100', photo === 'loading' && 'skeleton')}>
        <Link to={href} aria-label={product.name} className="block">
          <img
            ref={photoRef}
            src={photo === 'failed' ? '/images/placeholder.svg' : img(product.image)}
            alt={product.name}
            width="480"
            height="480"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setPhoto((p) => (p === 'loading' ? 'ready' : p))}
            onError={() => setPhoto('failed')}
            className={cx(
              'aspect-square w-full object-cover transition-[opacity,scale] duration-500 ease-soft group-hover:scale-[1.035]',
              photo === 'loading' ? 'opacity-0' : product.inStock ? 'opacity-100' : 'opacity-60 grayscale-[35%]'
            )}
          />
        </Link>

        {/* Product artwork carries its own title, so the only overlay is the sold-out flag. */}
        {!product.inStock && (
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold text-white">Sold out</span>
        )}

        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            aria-pressed={wished}
            className={cx('flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur transition-colors duration-200 hover:bg-white sm:size-10', wished ? 'text-clay-600' : 'text-ink-700 hover:text-clay-600')}
          >
            {/* re-keyed so the heart "pops" each time it is saved */}
            <Heart key={String(wished)} className={cx('size-[18px]', wished && 'animate-pop')} fill={wished ? 'currentColor' : 'none'} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => toggleCompare(product)}
            aria-label={compared ? `Remove ${product.name} from compare` : `Add ${product.name} to compare`}
            aria-pressed={compared}
            className={cx(
              // compare lives on the product page on phones, where card space is tight
              'hidden size-10 items-center justify-center rounded-full shadow-sm backdrop-blur transition-all duration-200 sm:flex lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100',
              compared ? 'bg-brand-600 text-white lg:opacity-100' : 'bg-white/95 text-ink-700 hover:bg-white hover:text-brand-600'
            )}
          >
            <GitCompareArrows className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-3.5">
        <p className="mb-1 flex items-center gap-2 text-xs font-medium tracking-wide text-ink-400 uppercase">
          {product.category?.name}
          {product.isNew && product.inStock && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold tracking-wider text-brand-700">New</span>}
        </p>
        <h3 className="font-sans text-[15.5px] leading-snug font-semibold tracking-normal text-ink-900">
          <Link to={href} className="-my-1.5 line-clamp-2 py-1.5 hover:text-brand-600">{product.name}</Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <Price price={product.price} compare={product.comparePrice} from={product.hasVariants} size="sm" />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!product.inStock}
            aria-label={product.hasVariants ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
            className="circle-fill flex size-10 shrink-0 items-center justify-center rounded-full border border-sand-300 bg-white text-ink-900 transition-[color,border-color,transform] duration-300 hover:border-brand-600 hover:text-white focus-visible:text-white active:scale-90 disabled:opacity-40 disabled:hover:border-sand-300 disabled:hover:text-ink-900"
          >
            <ShoppingBag className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6';
const WIDE = 'md:grid-cols-3 lg:grid-cols-4'; // full-width rows
const NARROW = 'md:grid-cols-3'; // beside the filter sidebar: fewer, larger cards

export function ProductGrid({ products, narrow, priorityCount = 0 }) {
  return (
    <div className={cx(GRID, narrow ? NARROW : WIDE)}>
      {products.map((p, i) => (
        <Reveal key={p.id} delay={(i % 4) * 80} className="flex">
          <ProductCard product={p} priority={i < priorityCount} />
        </Reveal>
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, narrow }) {
  return (
    <div className={cx(GRID, narrow ? NARROW : WIDE)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-square w-full rounded-2xl" />
          <div className="skeleton mt-4 h-3 w-1/3" />
          <div className="skeleton mt-2 h-4 w-4/5" />
          <div className="skeleton mt-3 h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
