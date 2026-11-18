import { useEffect, useMemo, useState } from 'react';
import { LoadError } from '../components/Skeletons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, GitCompareArrows, Heart, PackageCheck, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import api from '../lib/api';
import { setBuyNow } from '../lib/buyNow';
import { img } from '../lib/format';
import { useShop } from '../context/ShopContext';
import { ProductGrid } from '../components/product/ProductCard';
import { Badge, Breadcrumbs, Button, EmptyState, Price, QuantityStepper, cx, usePageTitle } from '../components/ui';

/** Splits multi-line text from Site settings into separate points. */
const lines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

function Gallery({ images, name }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [images]);
  const list = images.length ? images : [null];
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row lg:sticky lg:top-28">
      {list.length > 1 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-none sm:flex-col sm:overflow-visible" role="tablist" aria-label="Product images">
          {list.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Image ${i + 1} of ${list.length}`}
              onClick={() => setIndex(i)}
              className={cx('w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors duration-200 sm:w-20', i === index ? 'border-brand-600' : 'border-transparent hover:border-sand-300')}
            >
              <img src={img(src)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-hidden rounded-3xl bg-sand-100">
        <img key={list[index]} src={img(list[index])} alt={name} width="960" height="720" fetchPriority="high" className="aspect-square sm:aspect-[4/3] w-full animate-fade-in object-cover" />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-2 lg:gap-16" aria-hidden>
      <div className="skeleton aspect-square sm:aspect-[4/3] rounded-3xl" />
      <div>
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-4 h-10 w-4/5" />
        <div className="skeleton mt-5 h-8 w-32" />
        <div className="skeleton mt-8 h-24 w-full" />
        <div className="skeleton mt-8 h-13 w-full rounded-full" />
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, wishlistIds, toggleCompare, compare, settings } = useShop();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(''); // could not be loaded (connection) — not the same as "does not exist"
  const [tries, setTries] = useState(0);
  const [variantId, setVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('description');

  useEffect(() => {
    let active = true;
    setData(null);
    setMissing(false);
    setFailed('');
    setQuantity(1);
    setTab('description');
    api
      .get(`/products/${slug}`)
      .then((d) => {
        if (!active) return;
        setData(d);
        const firstAvailable = d.product.variants.find((v) => v.stock > 0) || d.product.variants[0];
        setVariantId(firstAvailable ? firstAvailable.id : null);
      })
      .catch((err) => active && (err.status === 404 ? setMissing(true) : setFailed(err.message)));
    return () => { active = false; };
  }, [slug, tries]);

  // After a failed load keep trying quietly — the page fills in as soon as the connection is back.
  useEffect(() => {
    if (!failed) return undefined;
    const again = () => !document.hidden && setTries((n) => n + 1);
    const timer = setTimeout(again, 8000);
    window.addEventListener('online', again);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', again);
    };
  }, [failed, tries]);

  const product = data?.product;
  usePageTitle(product?.name || (missing ? 'Product not found' : 'Product'));

  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId) || null, [product, variantId]);

  if (missing) {
    return (
      <div className="container-page">
        <EmptyState icon={PackageCheck} title="This product is not available" description="It may have been removed or renamed.">
          <Link to="/shop" className="btn btn-primary">Browse all products</Link>
        </EmptyState>
      </div>
    );
  }
  if (failed) return <div className="container-page py-16"><LoadError message={failed} onRetry={() => setTries((n) => n + 1)} /></div>;
  if (!product) return <Skeleton />;

  const price = variant ? variant.price : product.price;
  const comparePrice = variant ? variant.comparePrice : product.comparePrice;
  const stock = variant ? variant.stock : product.stock;
  const inStock = stock > 0;
  const maxQty = Math.min(20, stock);
  const wished = wishlistIds.has(product.id);
  const compared = compare.includes(product.id);

  const add = () => addToCart(product, variant?.id, quantity);
  // Straight to checkout with only this item; the cart is left as it is.
  const buyNow = () => {
    setBuyNow({ productId: product.id, variantId: variant?.id || null, quantity });
    navigate('/checkout?buy=1');
  };

  const crumbs = [
    { label: 'Shop', to: '/shop' },
    product.category && { label: product.category.name, to: `/shop?category=${product.category.slug}` },
    { label: product.name },
  ].filter(Boolean);

  const tabs = [
    product.description && { id: 'description', label: 'Description' },
    product.specifications.length > 0 && { id: 'specs', label: 'Specifications' },
    { id: 'shipping', label: 'Delivery & returns' },
  ].filter(Boolean);
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
        <Gallery images={product.images} name={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.category && (
              <Link to={`/shop?category=${product.category.slug}`} className="eyebrow inline-flex min-h-8 items-center hover:text-brand-600">{product.category.name}</Link>
            )}
            {product.isBestseller && <Badge tone="amber">Best seller</Badge>}
            {product.isNew && <Badge tone="green">New</Badge>}
          </div>
          <h1 className="mt-3 text-3xl leading-tight font-medium sm:text-[2.6rem]">{product.name}</h1>

          <div className="mt-5">
            <Price price={price} compare={comparePrice} size="lg" />
            <p className="mt-1 text-sm text-ink-400">Inclusive of all taxes</p>
          </div>

          {product.shortDescription && <p className="mt-6 leading-relaxed text-ink-700">{product.shortDescription}</p>}

          {product.variants.length > 0 && (
            <fieldset className="mt-7">
              <legend className="mb-2.5 text-sm font-semibold">
                Choose an option{variant && <span className="ml-2 font-normal text-ink-500">{variant.label}</span>}
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const selected = v.id === variantId;
                  const soldOut = v.stock <= 0;
                  return (
                    <label
                      key={v.id}
                      className={cx(
                        'relative flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
                        selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-sand-300 bg-white text-ink-900 hover:border-ink-900',
                        soldOut && !selected && 'text-ink-300 line-through'
                      )}
                    >
                      <input type="radio" name="variant" value={v.id} checked={selected} onChange={() => { setVariantId(v.id); setQuantity(1); }} className="sr-only" />
                      {v.label}
                      {soldOut && <span className="sr-only"> (sold out)</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <p className={cx('mt-6 flex items-center gap-2 text-sm font-medium', inStock ? 'text-brand-600' : 'text-clay-600')} aria-live="polite">
            <span className={cx('size-2 rounded-full', inStock ? 'bg-brand-500' : 'bg-clay-600')} aria-hidden />
            {!inStock ? 'Out of stock' : stock <= 5 ? `Only ${stock} left in stock` : 'In stock — ready to ship'}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, maxQty)} disabled={!inStock} />
            <Button size="lg" className="min-w-44 flex-1" onClick={add} disabled={!inStock}>
              {inStock ? 'Add to cart' : 'Sold out'}
            </Button>
          </div>
          {inStock && (
            <Button variant="dark" size="lg" className="mt-3 w-full" onClick={buyNow}>Buy it now</Button>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => toggleWishlist(product)} aria-pressed={wished} className={cx('btn btn-ghost flex-1 border border-sand-200', wished && 'text-clay-600')}>
              <Heart className="size-[18px]" fill={wished ? 'currentColor' : 'none'} aria-hidden />
              {wished ? 'Saved' : 'Add to wishlist'}
            </button>
            <button type="button" onClick={() => toggleCompare(product)} aria-pressed={compared} className={cx('btn btn-ghost flex-1 border border-sand-200', compared && 'text-brand-600')}>
              {compared ? <Check className="size-[18px]" aria-hidden /> : <GitCompareArrows className="size-[18px]" aria-hidden />}
              {compared ? 'In compare' : 'Compare'}
            </button>
          </div>

          <ul className="mt-8 grid gap-4 rounded-2xl border border-sand-200 bg-white p-5 sm:grid-cols-3">
            {[
              [Truck, 'Fast delivery', settings.delivery_short],
              [ShieldCheck, 'Secure checkout', 'UPI, cards, net banking'],
              [RotateCcw, 'Easy returns', settings.returns_short],
            ].map(([Icon, heading, text]) => (
              <li key={heading} className="flex items-start gap-3 sm:flex-col sm:gap-2">
                <Icon className="size-5 shrink-0 text-brand-600" strokeWidth={1.7} aria-hidden />
                <div>
                  <p className="text-sm font-semibold">{heading}</p>
                  <p className="text-sm text-ink-500">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Details */}
      <section className="mt-16 lg:mt-24" aria-label="Product details">
        <div role="tablist" aria-label="Product information" className="flex gap-1 overflow-x-auto border-b border-sand-200 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cx('-mb-px min-h-12 shrink-0 border-b-2 px-4 text-[15px] font-semibold transition-colors duration-200', activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-900')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="max-w-3xl pt-8">
          {activeTab === 'description' && <div className="rich" dangerouslySetInnerHTML={{ __html: product.description }} />}
          {activeTab === 'specs' && (
            <dl className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
              {product.specifications.map((s, i) => (
                <div key={s.label} className={cx('grid grid-cols-[minmax(120px,35%)_1fr] gap-4 px-5 py-3.5 text-[15px]', i > 0 && 'border-t border-sand-200')}>
                  <dt className="text-ink-500">{s.label}</dt>
                  <dd className="font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {activeTab === 'shipping' && (
            <div className="rich">
              <h3>Delivery</h3>
              <ul>{lines(settings.delivery_info).map((line) => <li key={line}>{line}</li>)}</ul>
              <h3>Returns</h3>
              <ul>{lines(settings.returns_info).map((line) => <li key={line}>{line}</li>)}</ul>
              <p>Read the full <Link to="/refund-policy">refund &amp; returns policy</Link>.</p>
            </div>
          )}
        </div>
      </section>

      {data.related.length > 0 && (
        <section className="mt-16 border-t border-sand-200 pt-14 lg:mt-24">
          <h2 className="section-title mb-8">You may also like</h2>
          <ProductGrid products={data.related} />
        </section>
      )}
    </div>
  );
}
