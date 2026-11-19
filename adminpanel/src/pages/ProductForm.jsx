import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useApp } from '../context/AppContext';
import ImageUploader from '../components/ImageUploader';
import RichEditor from '../components/RichEditor';
import { Alert, Button, Field, PageHeader, PageSkeleton, Toggle, usePageTitle } from '../components/ui';

const EMPTY = {
  name: '', sku: '', category_id: '', subcategory_id: '', short_description: '', description: '', tags: '',
  price: '', compare_price: '', stock: 0, is_active: true, is_featured: false, is_bestseller: false, is_new: false,
  package_length: '', package_breadth: '', package_height: '', package_weight: '',
  images: [], specifications: [], variants: [],
};

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const [form, setForm] = useState(id ? null : EMPTY);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  usePageTitle(id ? 'Edit product' : 'Add product');

  useEffect(() => {
    api.get('/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) {
      setForm(EMPTY);
      return;
    }
    setForm(null);
    api
      .get(`/products/${id}`)
      .then(({ product: p }) =>
        setForm({
          ...EMPTY,
          ...p,
          package_length: p.package_length ?? p.length ?? '',
          package_breadth: p.package_breadth ?? p.breadth ?? '',
          package_height: p.package_height ?? p.height ?? '',
          package_weight: p.package_weight ?? p.weight ?? '',
          sku: p.sku || '', short_description: p.short_description || '', description: p.description || '', tags: p.tags || '',
          category_id: p.category_id || '', subcategory_id: p.subcategory_id || '', compare_price: p.compare_price ?? '',
          is_active: !!p.is_active, is_featured: !!p.is_featured, is_bestseller: !!p.is_bestseller, is_new: !!p.is_new,
          variants: p.variants.map((v) => ({ ...v, compare_price: v.compare_price ?? '' })),
        })
      )
      .catch((err) => { toast.error(err.message); navigate('/products'); });
  }, [id, navigate, toast]);

  if (!form) return <PageSkeleton />;

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
    // a field's error disappears as soon as it is corrected
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };
  const setRow = (list, index, key, value) => setForm((f) => ({ ...f, [list]: f[list].map((row, i) => (i === index ? { ...row, [key]: value } : row)) }));
  const addRow = (list, row) => setForm((f) => ({ ...f, [list]: [...f[list], row] }));
  const removeRow = (list, index) => setForm((f) => ({ ...f, [list]: f[list].filter((_, i) => i !== index) }));

  const parents = categories.filter((c) => !c.parent_id);
  const subs = categories.filter((c) => String(c.parent_id) === String(form.category_id));
  const hasVariants = form.variants.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    // Check the form before anything is sent, so mistakes are shown next to the field straight away.
    const problems = {};
    if (!form.name.trim()) problems.name = 'Enter a product name';
    if (!form.category_id) problems.category_id = 'Choose a category';
    if (hasVariants) {
      if (form.variants.some((v) => !String(v.label).trim() || v.price === '' || Number(v.price) <= 0)) problems.variants = 'Each option needs a name and a price above 0';
      else if (new Set(form.variants.map((v) => String(v.label).trim().toLowerCase())).size !== form.variants.length) problems.variants = 'Two options have the same name';
    } else {
      if (form.price === '' || Number(form.price) <= 0) problems.price = 'Enter the selling price';
      if (form.compare_price !== '' && form.compare_price != null && Number(form.compare_price) < Number(form.price)) problems.compare_price = 'MRP should not be lower than the selling price';
      if (form.stock === '' || Number(form.stock) < 0) problems.stock = 'Enter how many are in stock (0 or more)';
    }

    // Shiprocket Package Dimensions & Weight (Required)
    if (!form.package_length || Number(form.package_length) <= 0) problems.package_length = 'Enter package length (cm)';
    if (!form.package_breadth || Number(form.package_breadth) <= 0) problems.package_breadth = 'Enter package breadth (cm)';
    if (!form.package_height || Number(form.package_height) <= 0) problems.package_height = 'Enter package height (cm)';
    if (!form.package_weight || Number(form.package_weight) <= 0) problems.package_weight = 'Enter packed box weight (kg)';

    setErrors(problems);
    if (Object.keys(problems).length) {
      setMessage('Please fix the highlighted fields below.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    const payload = {
      ...form,
      price: hasVariants ? 0 : form.price,
      subcategory_id: subs.some((s) => String(s.id) === String(form.subcategory_id)) ? form.subcategory_id : '',
      specifications: form.specifications.filter((s) => s.label.trim() && s.value.trim()),
    };
    try {
      if (id) {
        await api.put(`/products/${id}`, payload);
        toast.success('Product saved');
      } else {
        const d = await api.post('/products', payload);
        toast.success('Product added');
        navigate(`/products/${d.id}`, { replace: true });
      }
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={id ? form.name || 'Edit product' : 'Add product'}
        back={<Link to="/products" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" aria-hidden /> Products</Link>}
      >
        <Link to="/products" className="btn btn-outline">Cancel</Link>
        <Button type="submit" loading={busy}>{id ? 'Save changes' : 'Add product'}</Button>
      </PageHeader>

      {message && <Alert className="mb-5">{message}</Alert>}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="card-title">Details</h2>
            <Field label="Product name" required value={form.name} onChange={set('name')} error={errors.name} />
            <Field label="Short description" as="textarea" rows={3} maxLength={700} value={form.short_description} onChange={set('short_description')} error={errors.short_description} hint="One or two sentences shown beside the product photo." />
            <div>
              <span className="label">Full description</span>
              <RichEditor label="Full description" value={form.description} onChange={set('description')} resetKey={id || 'new'} />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="card-title">Images</h2>
            <p className="mb-4 text-[13px] text-ink-500">Up to 8 images. The first is the cover. Portrait (4:5) photos look best. JPG, PNG or WebP, max 5 MB each.</p>
            <ImageUploader value={form.images} onChange={set('images')} />
            {errors.images && <p role="alert" className="mt-2 text-[13px] text-clay-600">{errors.images}</p>}
          </section>

          <section className="card p-5">
            <h2 className="card-title">Pricing &amp; stock</h2>
            {hasVariants ? (
              <Alert tone="info" className="mt-3">This product has options, so price and stock are set per option below. The store shows the lowest option price.</Alert>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Selling price" required type="number" min="0" step="0.01" prefix="₹" value={form.price} onChange={set('price')} error={errors.price} />
                <Field label="MRP (optional)" type="number" min="0" step="0.01" prefix="₹" value={form.compare_price} onChange={set('compare_price')} error={errors.compare_price} hint="Shown struck through." />
                <Field label="Stock" required type="number" min="0" step="1" value={form.stock} onChange={set('stock')} error={errors.stock} />
              </div>
            )}

            <div className="mt-6 border-t border-line pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Options (sizes / weights)</h3>
                  <p className="text-[13px] text-ink-500">e.g. 250g, 500g — each with its own price and stock.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => addRow('variants', { label: '', price: '', compare_price: '', stock: '' })}><Plus className="size-4" aria-hidden /> Add option</Button>
              </div>
              {hasVariants && (
                <div className="mt-4 space-y-2">
                  <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.8fr_36px] gap-2 text-xs font-semibold tracking-wider text-ink-500 uppercase sm:grid">
                    <span>Option</span><span>Price (₹)</span><span>MRP (₹)</span><span>Stock</span><span />
                  </div>
                  {form.variants.map((v, i) => (
                    <div key={v.id || `new-${i}`} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_36px] sm:border-0 sm:p-0">
                      <input className="input col-span-2 sm:col-span-1" aria-label={`Option ${i + 1} name`} placeholder="e.g. 250g" value={v.label} onChange={(e) => setRow('variants', i, 'label', e.target.value)} />
                      <input className="input" type="number" min="0" step="0.01" aria-label={`Option ${i + 1} price`} placeholder="Price" value={v.price} onChange={(e) => setRow('variants', i, 'price', e.target.value)} />
                      <input className="input" type="number" min="0" step="0.01" aria-label={`Option ${i + 1} MRP`} placeholder="MRP" value={v.compare_price} onChange={(e) => setRow('variants', i, 'compare_price', e.target.value)} />
                      <input className="input" type="number" min="0" step="1" aria-label={`Option ${i + 1} stock`} placeholder="Stock" value={v.stock} onChange={(e) => setRow('variants', i, 'stock', e.target.value)} />
                      <button type="button" onClick={() => removeRow('variants', i)} aria-label={`Remove option ${i + 1}`} className="icon-btn justify-self-end hover:bg-clay-50 hover:text-clay-600"><Trash2 className="size-4" aria-hidden /></button>
                    </div>
                  ))}
                  {Object.keys(errors).some((k) => k.startsWith('variants') && errors[k]) && <p role="alert" className="text-[13px] text-clay-600">{errors.variants || 'Each option needs a name and a price.'}</p>}
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="card-title">Specifications</h2>
                <p className="text-[13px] text-ink-500">Facts shown in a table on the product page and when comparing products.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => addRow('specifications', { label: '', value: '' })}><Plus className="size-4" aria-hidden /> Add row</Button>
            </div>
            {form.specifications.length > 0 && (
              <div className="mt-4 space-y-2">
                {form.specifications.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.6fr_36px] gap-2">
                    <input className="input" aria-label={`Specification ${i + 1} name`} placeholder="e.g. Net weight" value={s.label} onChange={(e) => setRow('specifications', i, 'label', e.target.value)} />
                    <input className="input" aria-label={`Specification ${i + 1} value`} placeholder="e.g. 250 g" value={s.value} onChange={(e) => setRow('specifications', i, 'value', e.target.value)} />
                    <button type="button" onClick={() => removeRow('specifications', i)} aria-label={`Remove specification ${i + 1}`} className="icon-btn hover:bg-clay-50 hover:text-clay-600"><Trash2 className="size-4" aria-hidden /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Shipping & Package Dimensions for Shiprocket */}
          <section className="card p-5 space-y-4">
            <div>
              <h2 className="card-title flex items-center gap-2">
                <Package className="size-5 text-brand-700" />
                Shipping Package Dimensions (Shiprocket)
              </h2>
              <p className="text-[13px] text-ink-500">
                Outer box dimensions (L × B × H) and dead weight after packing the parcel. Required by Shiprocket to assign courier partners and calculate live shipping rates.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field
                label="Package Length (cm)"
                type="number"
                min="0.5"
                step="0.1"
                required
                placeholder="e.g. 15"
                value={form.package_length}
                onChange={set('package_length')}
                error={errors.package_length}
                hint="Box outer length in cm"
              />
              <Field
                label="Package Breadth (cm)"
                type="number"
                min="0.5"
                step="0.1"
                required
                placeholder="e.g. 10"
                value={form.package_breadth}
                onChange={set('package_breadth')}
                error={errors.package_breadth}
                hint="Box outer width in cm"
              />
              <Field
                label="Package Height (cm)"
                type="number"
                min="0.5"
                step="0.1"
                required
                placeholder="e.g. 10"
                value={form.package_height}
                onChange={set('package_height')}
                error={errors.package_height}
                hint="Box outer height in cm"
              />
              <Field
                label="Package Weight (kg)"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 0.5"
                value={form.package_weight}
                onChange={set('package_weight')}
                error={errors.package_weight}
                hint="Weight after packing (kg)"
              />
            </div>

            {/* Shiprocket Volumetric Weight Info */}
            {form.package_length && form.package_breadth && form.package_height ? (
              <div className="rounded-lg bg-sand-50 p-3 text-xs text-ink-600 border border-sand-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-ink-800">Shiprocket Volumetric Weight:</span>{' '}
                  <span className="font-mono font-medium">
                    {((Number(form.package_length) * Number(form.package_breadth) * Number(form.package_height)) / 5000).toFixed(2)} kg
                  </span>
                  <span className="text-ink-400 ml-1.5">(Formula: L × B × H / 5000)</span>
                </div>
                {form.package_weight ? (
                  <div className="text-brand-800 font-medium">
                    Billable Courier Weight:{' '}
                    <strong>
                      {Math.max(
                        Number(form.package_weight) || 0,
                        (Number(form.package_length) * Number(form.package_breadth) * Number(form.package_height)) / 5000
                      ).toFixed(2)}{' '}
                      kg
                    </strong>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-5 xl:sticky xl:top-6">
          <section className="card space-y-4 p-5">
            <h2 className="card-title">Visibility</h2>
            <Toggle label="Visible in store" description="Switch off to hide without deleting." checked={form.is_active} onChange={set('is_active')} />
            <Toggle label="Best seller" description="Shown in the home page best sellers." checked={form.is_bestseller} onChange={set('is_bestseller')} />
            <Toggle label="New arrival" description="Shows a “New” tag." checked={form.is_new} onChange={set('is_new')} />
            <Toggle label="Featured" description="Ranks higher in the shop." checked={form.is_featured} onChange={set('is_featured')} />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="card-title">Organisation</h2>
            <Field label="Category" required as="select" value={form.category_id} onChange={(e) => { set('category_id')(e); setForm((f) => ({ ...f, subcategory_id: '' })); }} error={errors.category_id}>
              <option value="">Choose a category</option>
              {parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Field>
            {subs.length > 0 && (
              <Field label="Sub-category" as="select" value={form.subcategory_id} onChange={set('subcategory_id')}>
                <option value="">None</option>
                {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Field>
            )}
            <Field label="SKU (optional)" value={form.sku} onChange={set('sku')} error={errors.sku} />
            <Field label="Search keywords" as="textarea" rows={2} value={form.tags} onChange={set('tags')} error={errors.tags} hint="Extra words shoppers might search for." />
          </section>
        </div>
      </div>
    </form>
  );
}
