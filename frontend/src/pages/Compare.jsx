import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GitCompareArrows, X } from 'lucide-react';
import api from '../lib/api';
import { img, inr } from '../lib/format';
import { useShop } from '../context/ShopContext';
import { Badge, Button, EmptyState, PageHeader, Price, usePageTitle } from '../components/ui';
import { PageSkeleton } from '../components/Skeletons';

export default function Compare() {
  usePageTitle('Compare products');
  const navigate = useNavigate();
  const { compare, setCompare, toggleCompare, addToCart } = useShop();
  const [products, setProducts] = useState(null);

  const ids = compare.join(',');
  useEffect(() => {
    if (!ids) {
      setProducts([]);
      return;
    }
    api.get(`/products/compare?ids=${ids}`).then((d) => {
      setProducts(d.products);
      // forget products that no longer exist
      const found = d.products.map((p) => p.id);
      if (found.length !== ids.split(',').length) setCompare(found);
    }).catch(() => setProducts([]));
  }, [ids, setCompare]);

  // Every specification label that appears on at least one product, in first-seen order.
  const specLabels = useMemo(() => {
    const labels = [];
    const builtIn = ['Price', 'Availability', 'Category', 'Options', 'About']; // already shown as their own rows
    for (const p of products || []) {
      for (const s of p.specifications) if (!labels.includes(s.label) && !builtIn.includes(s.label)) labels.push(s.label);
    }
    return labels;
  }, [products]);

  if (products === null) return <PageSkeleton />;

  const rows = [
    { label: 'Price', render: (p) => <Price price={p.price} compare={p.comparePrice} from={p.hasVariants} size="sm" /> },
    { label: 'Availability', render: (p) => (p.inStock ? <Badge tone="green">In stock</Badge> : <Badge tone="red">Sold out</Badge>) },
    { label: 'Category', render: (p) => p.category?.name || '—' },
    { label: 'Options', render: (p) => (p.variants.length ? p.variants.map((v) => `${v.label} (${inr(v.price)})`).join(', ') : 'Single size') },
    { label: 'About', render: (p) => <span className="line-clamp-5 text-sm leading-relaxed text-ink-500">{p.shortDescription || '—'}</span> },
    ...specLabels.map((label) => ({ label, render: (p) => p.specifications.find((s) => s.label === label)?.value || '—' })),
  ];

  return (
    <>
      <PageHeader eyebrow="Side by side" title="Compare products" description="Compare up to 4 products to find the right one." />
      <div className="container-page py-10">
        {!products.length ? (
          <EmptyState icon={GitCompareArrows} title="Nothing to compare yet" description="Use the compare button on any product to add it here.">
            <Link to="/shop" className="btn btn-primary">Browse products</Link>
          </EmptyState>
        ) : (
          <>
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => setCompare([])} className="btn btn-ghost btn-sm">Clear all</button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
                <thead>
                  <tr>
                    <th scope="col" className="w-36 p-4 align-bottom text-sm font-semibold text-ink-400 sm:w-44"><span className="sr-only">Feature</span></th>
                    {products.map((p) => (
                      <th key={p.id} scope="col" className="relative min-w-48 p-4 align-top font-normal">
                        <button type="button" onClick={() => toggleCompare(p)} aria-label={`Remove ${p.name} from compare`} className="absolute top-2 right-2 z-10 flex size-9 items-center justify-center rounded-full bg-white text-ink-500 shadow-sm ring-1 ring-sand-200 hover:text-clay-600">
                          <X className="size-4" aria-hidden />
                        </button>
                        <Link to={`/product/${p.slug}`} className="block">
                          <img src={img(p.image)} alt="" className="aspect-square w-full max-w-44 rounded-xl bg-sand-100 object-cover" />
                          <span className="mt-3 block leading-snug font-semibold hover:text-brand-600">{p.name}</span>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-t border-sand-200">
                      <th scope="row" className="bg-sand-100/50 p-4 align-top text-sm font-semibold text-ink-500">{row.label}</th>
                      {products.map((p) => <td key={p.id} className="p-4 align-top">{row.render(p)}</td>)}
                    </tr>
                  ))}
                  <tr className="border-t border-sand-200">
                    <th scope="row" className="bg-sand-100/50 p-4"><span className="sr-only">Actions</span></th>
                    {products.map((p) => (
                      <td key={p.id} className="p-4">
                        <Button size="sm" disabled={!p.inStock} onClick={() => (p.hasVariants ? navigate(`/product/${p.slug}`) : addToCart(p))}>
                          {!p.inStock ? 'Sold out' : p.hasVariants ? 'Choose options' : 'Add to cart'}
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
