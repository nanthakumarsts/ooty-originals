import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { img } from '../lib/format';
import { useApp } from '../context/AppContext';
import ImageUploader from '../components/ImageUploader';
import { Alert, Badge, Button, Confirm, EmptyState, Field, Modal, PageHeader, SearchInput, PageSkeleton, Toggle, cx, usePageTitle } from '../components/ui';

const EMPTY = { name: '', parent_id: '', description: '', image: '', sort_order: 0, is_active: true };

/** Category photo. Product artwork has a text panel on top, so only the lower (photo) part is shown. */
function Photo({ src, className }) {
  return (
    <span className={cx('block shrink-0 overflow-hidden bg-canvas', className)}>
      <img src={img(src)} alt="" loading="lazy" className={cx('aspect-[8/5] size-full object-cover', String(src || '').includes('/uploads/products/') ? 'object-bottom' : 'object-center')} />
    </span>
  );
}

/** Small on/off switch used for "visible in store". */
function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-brand-600' : 'bg-line-strong')}>
      <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')} />
    </button>
  );
}

export default function Categories() {
  usePageTitle('Categories');
  const { toast } = useApp();
  const [categories, setCategories] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const detail = useRef(null);

  const load = useCallback(() => api.get('/categories').then((d) => setCategories(d.categories)).catch((err) => toast.error(err.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  const parents = useMemo(() => (categories || []).filter((c) => !c.parent_id), [categories]);
  const childrenOf = useCallback((id) => (categories || []).filter((c) => c.parent_id === id), [categories]);
  const selected = parents.find((c) => c.id === selectedId) || parents[0] || null;
  const subs = selected ? childrenOf(selected.id) : [];

  const visibleParents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return parents;
    return parents.filter((p) => p.name.toLowerCase().includes(term) || childrenOf(p.id).some((c) => c.name.toLowerCase().includes(term)));
  }, [parents, search, childrenOf]);

  const select = (category) => {
    setSelectedId(category.id);
    // on phones the details sit below the list, so bring them into view
    if (window.innerWidth < 1024) setTimeout(() => detail.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const open = (category, parentId = '') => {
    setEditing(category || {});
    setForm(category ? { ...EMPTY, ...category, parent_id: category.parent_id || '', description: category.description || '', image: category.image || '', is_active: !!category.is_active } : { ...EMPTY, parent_id: parentId });
    setErrors({});
    setMessage('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    const problems = {};
    if (form.name.trim().length < 2) problems.name = 'Enter a category name';
    if (form.sort_order === '' || Number(form.sort_order) < 0) problems.sort_order = 'Enter 0 or more';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      if (editing.id) {
        await api.put(`/categories/${editing.id}`, form);
      } else {
        const created = await api.post('/categories', form);
        if (!form.parent_id) setSelectedId(created.id); // show the new category straight away
      }
      toast.success(editing.id ? 'Category saved' : 'Category added');
      setEditing(null);
      load();
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = async (c) => {
    try {
      await api.put(`/categories/${c.id}`, { name: c.name, parent_id: c.parent_id || '', description: c.description || '', image: c.image || '', sort_order: c.sort_order, is_active: !c.is_active });
      toast.success(c.is_active ? `${c.name} is now hidden from the store` : `${c.name} is now visible in the store`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/categories/${removing.id}`);
      toast.success('Category deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(null);
      setBusy(false);
    }
  };

  if (!categories) return <PageSkeleton />;

  return (
    <>
      <PageHeader title="Categories" description="Choose a category on the left to see and edit it.">
        <Button onClick={() => open(null)}><Plus className="size-4" aria-hidden /> Add category</Button>
      </PageHeader>

      {!parents.length ? (
        <div className="card">
          <EmptyState icon={FolderTree} title="No categories yet" description="Create your first category, then add products to it.">
            <Button size="sm" onClick={() => open(null)}><Plus className="size-4" aria-hidden /> Add category</Button>
          </EmptyState>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
          {/* Left: every category */}
          <section className="card overflow-hidden" aria-label="All categories">
            <div className="border-b border-line p-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Find a category" />
            </div>
            {!visibleParents.length ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">No category matches “{search}”.</p>
            ) : (
              <ul className="divide-y divide-line">
                {visibleParents.map((c) => {
                  const active = selected?.id === c.id;
                  const count = childrenOf(c.id).length;
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => select(c)} aria-current={active ? 'true' : undefined} className={cx('flex w-full items-center gap-3 border-l-[3px] py-3 pr-3 pl-3.5 text-left transition-colors duration-150', active ? 'border-brand-600 bg-brand-50' : 'border-transparent hover:bg-canvas')}>
                        <Photo src={c.image} className="w-14 rounded-md" />
                        <span className="min-w-0 flex-1">
                          <span className={cx('flex items-center gap-2 text-[15px] font-semibold', active && 'text-brand-700')}>
                            <span className="truncate">{c.name}</span>
                            {!c.is_active && <Badge>Hidden</Badge>}
                          </span>
                          <span className="block text-[13px] text-ink-500">
                            {c.product_count} {c.product_count === 1 ? 'product' : 'products'}{count > 0 && ` · ${count} sub-${count === 1 ? 'category' : 'categories'}`}
                          </span>
                        </span>
                        <ChevronRight className={cx('size-4 shrink-0', active ? 'text-brand-600' : 'text-ink-300')} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="border-t border-line px-4 py-2.5 text-[13px] text-ink-500">{parents.length} categories · {categories.length - parents.length} sub-categories</p>
          </section>

          {/* Right: the chosen category */}
          {selected && (
            // stays in view on desktop while the list on the left scrolls with the page
            <div ref={detail} className="scroll-mt-20 space-y-5 lg:sticky lg:top-20">
              <section className="card p-5">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <Photo src={selected.image} className="w-full rounded-xl sm:w-52" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="text-2xl font-medium">{selected.name}</h2>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => open(selected)}><Pencil className="size-4" aria-hidden /> Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => setRemoving(selected)} className="text-clay-600 hover:border-clay-600 hover:bg-clay-50"><Trash2 className="size-4" aria-hidden /> Delete</Button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-500">{selected.description || 'No description yet. Add one with Edit — shoppers see it under the category title.'}</p>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
                  <div className="bg-white p-3.5">
                    <dt className="text-[13px] text-ink-500">Products</dt>
                    <dd className="mt-0.5"><Link to={`/products?category=${selected.id}`} className="text-lg font-semibold text-brand-600 hover:underline">{selected.product_count}</Link></dd>
                  </div>
                  <div className="bg-white p-3.5">
                    <dt className="text-[13px] text-ink-500">Sub-categories</dt>
                    <dd className="mt-0.5 text-lg font-semibold">{subs.length}</dd>
                  </div>
                  <div className="bg-white p-3.5">
                    <dt className="text-[13px] text-ink-500">Position in shop</dt>
                    <dd className="mt-0.5 text-lg font-semibold">{selected.sort_order}</dd>
                  </div>
                  <div className="bg-white p-3.5">
                    <dt className="text-[13px] text-ink-500">Visible in store</dt>
                    <dd className="mt-1 flex items-center gap-2.5">
                      <Switch checked={!!selected.is_active} onChange={() => toggleVisible(selected)} label={`${selected.name} visible in store`} />
                      <span className="text-sm font-medium">{selected.is_active ? 'Yes' : 'No'}</span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 p-5 pb-4">
                  <div>
                    <h2 className="card-title">Sub-categories</h2>
                    <p className="text-[13px] text-ink-500">Types inside {selected.name}, shown as filters in the shop.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => open(null, selected.id)}><Plus className="size-4" aria-hidden /> Add sub-category</Button>
                </div>
                {!subs.length ? (
                  <p className="border-t border-line px-5 py-6 text-sm text-ink-500">No sub-categories. They are optional — add them only if {selected.name} needs to be split into types.</p>
                ) : (
                  <ul className="divide-y divide-line border-t border-line">
                    {subs.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold">{s.name}</span>
                          <Link to={`/products?category=${s.id}`} className="text-[13px] text-ink-500 hover:text-brand-600 hover:underline">{s.product_count} {s.product_count === 1 ? 'product' : 'products'}</Link>
                        </span>
                        <span className="flex items-center gap-2 text-[13px] text-ink-500">
                          <Switch checked={!!s.is_active} onChange={() => toggleVisible(s)} label={`${s.name} visible in store`} />
                          {s.is_active ? 'Visible' : 'Hidden'}
                        </span>
                        <span className="flex">
                          <button type="button" onClick={() => open(s)} className="icon-btn" aria-label={`Edit ${s.name}`} title="Edit"><Pencil className="size-4" aria-hidden /></button>
                          <button type="button" onClick={() => setRemoving(s)} className="icon-btn hover:bg-clay-50 hover:text-clay-600" aria-label={`Delete ${s.name}`} title="Delete"><Trash2 className="size-4" aria-hidden /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit category' : form.parent_id ? 'Add sub-category' : 'Add category'} wide>
        <form onSubmit={submit} noValidate className="space-y-4">
          {message && !Object.keys(errors).length && <Alert>{message}</Alert>}
          {form.parent_id && <p className="text-sm text-ink-500">Sub-category under <strong>{parents.find((p) => String(p.id) === String(form.parent_id))?.name}</strong></p>}
          {errors.parent_id && <Alert>{errors.parent_id}</Alert>}
          <Field label="Name" required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Field label="Description" as="textarea" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} hint="Shown under the category title in the shop." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">Photo</span>
              <ImageUploader max={1} folder="content" square value={form.image ? [form.image] : []} onChange={(urls) => setForm({ ...form, image: urls[0] || '' })} />
            </div>
            <div className="space-y-4">
              <Field label="Position in the shop" type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} error={errors.sort_order} hint="1 appears first, then 2, 3…" />
              <Toggle label="Visible in store" description="Switch off to hide it from shoppers." checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={busy}>{editing?.id ? 'Save changes' : 'Add category'}</Button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} busy={busy} title="Delete this category?">
        <strong className="text-ink-900">{removing?.name}</strong> will be deleted{removing && !removing.parent_id ? ' along with its sub-categories' : ''}. A category that still has products in it cannot be deleted — move those products first.
      </Confirm>
    </>
  );
}
