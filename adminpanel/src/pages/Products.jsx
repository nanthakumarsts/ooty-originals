import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { img, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Badge, Confirm, EmptyState, PageHeader, Pagination, SearchInput, Select, TableSkeleton, cx, useDebounced, usePageTitle } from '../components/ui';

export default function Products() {
  usePageTitle('Products');
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search);

  const status = params.get('status') || '';
  const category = params.get('category') || '';
  const page = Number(params.get('page')) || 1;

  const setParam = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) (value ? next.set(key, value) : next.delete(key));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  // keep the URL in step with the search box
  useEffect(() => {
    if ((params.get('q') || '') !== q) setParam({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    api.get('/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const query = params.toString();
  const load = useCallback(() => api.get(`/products?${query}`).then(setData).catch((err) => toast.error(err.message)), [query, toast]);
  useEffect(() => { load(); }, [load]);

  const toggleVisible = async (p) => {
    try {
      await api.patch(`/products/${p.id}`, { is_active: !p.is_active });
      toast.success(p.is_active ? 'Hidden from the store' : 'Now visible in the store');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/products/${removing.id}`);
      toast.success('Product deleted');
      setRemoving(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const parents = categories.filter((c) => !c.parent_id);
  const categoryOptions = [['', 'All categories'], ...parents.flatMap((c) => [[String(c.id), c.name], ...categories.filter((s) => s.parent_id === c.id).map((s) => [String(s.id), `— ${s.name}`])])];

  return (
    <>
      <PageHeader title="Products" description="Add, edit and organise everything you sell.">
        <Link to="/products/new" className="btn btn-primary"><Plus className="size-4" aria-hidden /> Add product</Link>
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_200px_180px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or SKU" />
          <Select label="Category" value={category} onChange={(v) => setParam({ category: v })} options={categoryOptions} />
          <Select label="Status" value={status} onChange={(v) => setParam({ status: v })} options={[['', 'All statuses'], ['active', 'Visible'], ['hidden', 'Hidden'], ['low', 'Low stock'], ['out', 'Out of stock']]} />
        </div>

        {!data ? (
          <TableSkeleton />
        ) : !data.items.length ? (
          <EmptyState icon={Package} title="No products found" description="Try another search or filter, or add a new product.">
            <Link to="/products/new" className="btn btn-primary btn-sm"><Plus className="size-4" aria-hidden /> Add product</Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Category</th><th className="text-right">Price</th><th className="text-right">Stock</th><th>Visible</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/products/${p.id}`} className="group flex min-w-56 items-center gap-3">
                        <img src={img(p.image)} alt="" loading="lazy" className="h-12 w-10 shrink-0 rounded-md bg-canvas object-cover" />
                        <span className="min-w-0">
                          <span className="line-clamp-1 font-semibold group-hover:text-brand-600">{p.name}</span>
                          <span className="flex flex-wrap gap-1 pt-0.5">
                            {p.variant_count > 0 && <span className="text-xs text-ink-500">{p.variant_count} options</span>}
                            {!!p.is_bestseller && <Badge tone="amber">Best seller</Badge>}
                            {!!p.is_new && <Badge tone="green">New</Badge>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-ink-500">{p.category_name || '—'}{p.sub_name ? ` › ${p.sub_name}` : ''}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      <span className="font-semibold">{p.variant_count > 0 ? 'from ' : ''}{inr(p.price)}</span>
                      {p.compare_price > p.price && <span className="block text-xs text-ink-400 line-through">{inr(p.compare_price)}</span>}
                    </td>
                    <td className="text-right">
                      <Badge tone={p.stock <= 0 ? 'red' : p.stock <= 5 ? 'amber' : 'gray'}>{p.stock <= 0 ? 'Out of stock' : p.stock}</Badge>
                    </td>
                    <td>
                      <button type="button" role="switch" aria-checked={!!p.is_active} aria-label={`${p.name} visible in store`} onClick={() => toggleVisible(p)} className={cx('relative h-6 w-11 rounded-full transition-colors duration-200', p.is_active ? 'bg-brand-600' : 'bg-line-strong')}>
                        <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200', p.is_active && 'translate-x-5')} />
                      </button>
                    </td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <Link to={`/products/${p.id}`} className="icon-btn" aria-label={`Edit ${p.name}`} title="Edit"><Pencil className="size-4" aria-hidden /></Link>
                        <button type="button" onClick={() => setRemoving(p)} className="icon-btn hover:bg-clay-50 hover:text-clay-600" aria-label={`Delete ${p.name}`} title="Delete"><Trash2 className="size-4" aria-hidden /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => setParam({ page: p > 1 ? String(p) : '' })} />}
      </div>

      <Confirm open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} busy={busy} title="Delete this product?">
        <strong className="text-ink-900">{removing?.name}</strong> will be removed from the store permanently. Past orders that include it are kept. To take it off sale temporarily, switch off “Visible” instead.
      </Confirm>
    </>
  );
}
