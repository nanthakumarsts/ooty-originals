import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, RotateCcw, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { img, inr, photoFit } from '../lib/format';
import { useShop } from '../context/ShopContext';
import useApi from '../hooks/useApi';
import { ProductGrid, ProductGridSkeleton } from '../components/product/ProductCard';
import { LoadError, PillsSkeleton } from '../components/Skeletons';
import TextReveal from '../components/TextReveal';
import { Button, Drawer, EmptyState, cx, usePageTitle } from '../components/ui';

const SORTS = [
  { value: '', label: 'Recommended' },
  { value: 'latest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const TAGS = { bestseller: 'Best sellers', new: 'New arrivals', sale: 'On offer' };

const PRICE_BANDS = [
  { min: null, max: 200, label: 'Under ₹200' },
  { min: 200, max: 500, label: '₹200 – ₹500' },
  { min: 500, max: 1000, label: '₹500 – ₹1,000' },
  { min: 1000, max: null, label: 'Above ₹1,000' },
];

/** One row in a filter list: a round check mark, a label and an optional count. */
function Option({ active, onClick, children, count }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} className="group flex min-h-10 w-full items-center gap-3 rounded-lg text-left text-[15px]">
      <span className={cx('flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-200', active ? 'border-brand-600 bg-brand-600' : 'border-sand-300 bg-white group-hover:border-ink-400')}>
        <span className={cx('size-1.5 rounded-full bg-white transition-transform duration-200', active ? 'scale-100' : 'scale-0')} />
      </span>
      <span className={cx('flex-1 transition-colors', active ? 'font-semibold text-ink-900' : 'text-ink-700 group-hover:text-ink-900')}>{children}</span>
      {count !== undefined && <span className="text-xs text-ink-400">{count}</span>}
    </button>
  );
}

function FilterGroup({ title, children }) {
  return (
    <section className="border-b border-sand-200 py-5 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="mb-2 font-sans text-xs font-semibold tracking-[0.14em] text-ink-400 uppercase">{title}</h3>
      <div role="radiogroup" aria-label={title}>{children}</div>
    </section>
  );
}

function Filters({ params, update, priceRange }) {
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const [customMin, setCustomMin] = useState(min);
  const [customMax, setCustomMax] = useState(max);

  useEffect(() => {
    setCustomMin(min);
    setCustomMax(max);
  }, [min, max]);

  const applyPrice = (e) => {
    e.preventDefault();
    update({ min: customMin || null, max: customMax || null });
  };

  const bandActive = (band) => String(band.min ?? '') === min && String(band.max ?? '') === max;
  const stock = params.get('stock') || '';
  const tag = params.get('tag') || '';

  return (
    <div>
      <FilterGroup title="Collection">
        <Option active={!tag} onClick={() => update({ tag: null })}>Everything</Option>
        {Object.entries(TAGS).map(([value, label]) => (
          <Option key={value} active={tag === value} onClick={() => update({ tag: value })}>{label}</Option>
        ))}
      </FilterGroup>

      <FilterGroup title="Price">
        <Option active={!min && !max} onClick={() => update({ min: null, max: null })}>Any price</Option>
        {PRICE_BANDS.map((band) => (
          <Option key={band.label} active={bandActive(band)} onClick={() => update({ min: band.min, max: band.max })}>{band.label}</Option>
        ))}
        <form onSubmit={applyPrice} className="mt-3 flex items-center gap-2">
          <label htmlFor="price-min" className="sr-only">Minimum price in rupees</label>
          <input id="price-min" type="number" inputMode="numeric" min="0" value={customMin} onChange={(e) => setCustomMin(e.target.value)} placeholder={`₹${priceRange.min ?? 0}`} className="input min-h-10 px-3 text-sm" />
          <span className="text-ink-300" aria-hidden>–</span>
          <label htmlFor="price-max" className="sr-only">Maximum price in rupees</label>
          <input id="price-max" type="number" inputMode="numeric" min="0" value={customMax} onChange={(e) => setCustomMax(e.target.value)} placeholder={`₹${priceRange.max ?? ''}`} className="input min-h-10 px-3 text-sm" />
          <button type="submit" className="btn btn-outline min-h-10 shrink-0 px-3.5 text-sm">Go</button>
        </form>
      </FilterGroup>

      <FilterGroup title="Availability">
        <Option active={!stock} onClick={() => update({ stock: null })}>All products</Option>
        <Option active={stock === 'in'} onClick={() => update({ stock: 'in' })}>In stock</Option>
        <Option active={stock === 'out'} onClick={() => update({ stock: 'out' })}>Out of stock</Option>
      </FilterGroup>
    </div>
  );
}

/** Scrollable row of category pills with a small photo each. */
function CategoryRail({ categories, ready, category, sub, update }) {
  const pill = (active) =>
    cx(
      'flex min-h-12 shrink-0 snap-start items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200',
      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-sand-200 bg-white text-ink-700 hover:border-ink-400'
    );
  return (
    <div className="border-b border-sand-200 bg-white">
      <div className="container-page">
        <div className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-4 scrollbar-none sm:mx-0 sm:scroll-px-0 sm:px-0" role="tablist" aria-label="Categories">
          <button type="button" role="tab" aria-selected={!category} onClick={() => update({ category: null, sub: null })} className={pill(!category)}>
            <span className={cx('flex size-9 items-center justify-center rounded-full', !category ? 'bg-white/15' : 'bg-sand-100')}>
              <LayoutGrid className="size-4" aria-hidden />
            </span>
            All
          </button>
          {!ready && <PillsSkeleton />}
          {categories.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={category?.id === c.id} onClick={() => update({ category: c.slug, sub: null })} className={pill(category?.id === c.id)}>
              <img src={img(c.image)} alt="" loading="lazy" className={`size-9 rounded-full bg-sand-100 object-cover ${photoFit(c.image)}`} />
              {c.name}
            </button>
          ))}
        </div>
        {category?.children.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-none sm:mx-0 sm:px-0" role="tablist" aria-label={`${category.name} types`}>
            {[{ slug: '', name: `All ${category.name}`, product_count: category.product_count }, ...category.children].map((s) => {
              const active = (sub?.slug || '') === s.slug;
              return (
                <button key={s.slug || 'all'} type="button" role="tab" aria-selected={active} onClick={() => update({ sub: s.slug || null })} className={cx('min-h-9 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-200', active ? 'bg-ink-900 text-white' : 'bg-sand-100 text-ink-700 hover:bg-sand-200')}>
                  {s.name} <span className={active ? 'text-white/70' : 'text-ink-400'}>{s.product_count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Pagination({ page, pages, total, perPage = 12, onChange }) {
  if (pages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const numbers = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) numbers.push(i);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }
  const base = 'flex size-11 items-center justify-center rounded-full text-[15px] font-medium transition-colors duration-200';
  return (
    <nav aria-label="Pagination" className="mt-14 flex flex-col items-center gap-4">
      <div className="flex items-center justify-center gap-1.5">
      <button type="button" className={cx(base, 'border border-sand-300 bg-white hover:border-ink-900 disabled:opacity-40')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {numbers.map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-ink-400">…</span>
        ) : (
          <button key={n} type="button" onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`} className={cx(base, n === page ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-sand-100')}>
            {n}
          </button>
        )
      )}
      <button type="button" className={cx(base, 'border border-sand-300 bg-white hover:border-ink-900 disabled:opacity-40')} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="size-5" aria-hidden />
      </button>
      </div>
      <p className="text-sm text-ink-500">Showing {from}–{to} of {total} products</p>
    </nav>
  );
}

export default function Shop() {
  const { categories, categoriesReady } = useShop();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = params.toString();
  const q = params.get('q') || '';
  const tag = params.get('tag') || '';
  const categorySlug = params.get('category') || '';
  const subSlug = params.get('sub') || '';

  const category = useMemo(() => categories.find((c) => c.slug === categorySlug), [categories, categorySlug]);
  const sub = category?.children.find((s) => s.slug === subSlug);
  const title = q ? `Results for “${q}”` : category ? category.name : TAGS[tag] || 'All products';
  usePageTitle(q ? `Search: ${q}` : sub?.name || category?.name || TAGS[tag] || 'Shop');

  // The last good list stays on screen while the next one loads; a failed request retries by itself.
  const { data, error, loading, reload } = useApi(`/products?${query}${query ? '&' : ''}limit=12`);

  /** Merge changes into the URL; any filter change returns to page 1. */
  const update = (changes, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!keepPage) next.delete('page');
    setParams(next);
    if (keepPage) document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const refinements = [
    q && { label: `Search: ${q}`, clear: { q: null } },
    tag && TAGS[tag] && { label: TAGS[tag], clear: { tag: null } },
    (params.get('min') || params.get('max')) && {
      label: `${params.get('min') ? inr(params.get('min')) : '₹0'} – ${params.get('max') ? inr(params.get('max')) : 'any'}`,
      clear: { min: null, max: null },
    },
    params.get('stock') && { label: params.get('stock') === 'in' ? 'In stock' : 'Out of stock', clear: { stock: null } },
  ].filter(Boolean);

  const clearRefinements = () => update({ q: null, tag: null, min: null, max: null, stock: null });
  const filterProps = { params, update, priceRange: data?.priceRange || {} };
  const total = data?.total ?? 0;

  return (
    <>
      <header className="bg-sand-100/60">
        <div className="container-page pt-8 pb-7 sm:pt-11 sm:pb-9">
          <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-500">
            <Link to="/" className="inline-flex min-h-8 items-center hover:text-ink-900">Home</Link>
            <span className="mx-1.5 text-ink-300">/</span>
            {category || q || tag ? <Link to="/shop" className="inline-flex min-h-8 items-center hover:text-ink-900">Shop</Link> : <span className="text-ink-900">Shop</span>}
            {category && (<><span className="mx-1.5 text-ink-300">/</span><span className="text-ink-900">{category.name}</span></>)}
          </nav>
          <TextReveal as="h1" immediate key={title} text={title} className="text-4xl font-medium sm:text-5xl" />
          <p className="mt-3 max-w-2xl text-[17px] text-ink-500">
            {q ? 'Products matching your search.' : category?.description || 'Authentic Nilgiri products, sourced from the hills and packed fresh in Ooty.'}
          </p>
        </div>
      </header>

      <CategoryRail categories={categories} ready={categoriesReady} category={category} sub={sub} update={update} />

      <div id="results" className="container-page scroll-mt-24 py-8 lg:py-10">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters
            {refinements.length > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{refinements.length}</span>}
          </button>
          <p className="text-[15px] text-ink-500" aria-live="polite">
            {loading && !data ? 'Loading…' : <><span className="font-semibold text-ink-900">{total}</span> {total === 1 ? 'product' : 'products'}</>}
          </p>
          <div className="relative ml-auto">
            <label htmlFor="sort" className="sr-only">Sort products</label>
            <select id="sort" value={params.get('sort') || ''} onChange={(e) => update({ sort: e.target.value || null })} className="h-10 appearance-none rounded-full border border-sand-300 bg-white pr-10 pl-4 text-sm font-medium text-ink-900 hover:border-ink-900 focus:border-brand-600 focus:outline-none">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
          </div>
        </div>

        {refinements.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {refinements.map((f) => (
              <button key={f.label} type="button" onClick={() => update(f.clear)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-50 pr-2 pl-3.5 text-sm font-medium text-brand-700 hover:bg-brand-100" aria-label={`Remove filter ${f.label}`}>
                {f.label}
                <X className="size-4" aria-hidden />
              </button>
            ))}
            <button type="button" onClick={clearRefinements} className="min-h-9 px-2 text-sm font-medium text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline">Clear all</button>
          </div>
        )}

        {error && !loading ? (
          <LoadError message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ProductGridSkeleton count={8} />
        ) : data?.items.length ? (
          <>
            <div className={cx('transition-opacity duration-200', loading && 'opacity-50')}>
              <ProductGrid products={data.items} priorityCount={4} />
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => update({ page: p > 1 ? p : null }, true)} />
          </>
        ) : (
          <EmptyState icon={SearchX} title="No products found" description="Try a different search word, or remove a filter to see more.">
            <Button variant="outline" onClick={() => setParams({})}>Show all products</Button>
          </EmptyState>
        )}
      </div>

      {/* All filters sit behind the Filters button, in a panel that slides in from the right */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={clearRefinements} disabled={!refinements.length}><RotateCcw className="size-4" aria-hidden /> Reset</Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>Show {total} {total === 1 ? 'product' : 'products'}</Button>
          </div>
        }
      >
        <Filters {...filterProps} />
      </Drawer>
    </>
  );
}
