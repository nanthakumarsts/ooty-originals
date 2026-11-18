import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { formatDate, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Alert, Badge, Button, Confirm, EmptyState, Field, Modal, PageHeader, PageSkeleton, Toggle, usePageTitle } from '../components/ui';

const EMPTY = { code: '', description: '', type: 'percent', value: '', min_order: 0, max_discount: '', usage_limit: '', per_user_limit: '', starts_at: '', expires_at: '', is_active: true };
/** Stored date-time → the yyyy-mm-dd a date input expects, in the admin's own time zone. */
const day = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function state(c) {
  const now = new Date();
  if (!c.is_active) return ['gray', 'Off'];
  if (c.expires_at && new Date(c.expires_at) < now) return ['red', 'Expired'];
  if (c.starts_at && new Date(c.starts_at) > now) return ['amber', 'Scheduled'];
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return ['red', 'Used up'];
  return ['green', 'Active'];
}

export default function Coupons() {
  usePageTitle('Offers & coupons');
  const { toast } = useApp();
  const [coupons, setCoupons] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/coupons').then((d) => setCoupons(d.coupons)).catch((err) => toast.error(err.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  const open = (c) => {
    setEditing(c || {});
    setForm(c ? { ...EMPTY, ...c, description: c.description || '', max_discount: c.max_discount ?? '', usage_limit: c.usage_limit ?? '', per_user_limit: c.per_user_limit ?? '', starts_at: day(c.starts_at), expires_at: day(c.expires_at), is_active: !!c.is_active } : EMPTY);
    setErrors({});
    setMessage('');
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    const problems = {};
    if (!/^[A-Z0-9_-]{3,40}$/.test(form.code.trim())) problems.code = 'Use 3–40 letters or numbers, no spaces (e.g. EASY10)';
    if (form.value === '' || Number(form.value) <= 0) problems.value = 'Enter the discount';
    else if (form.type === 'percent' && Number(form.value) > 100) problems.value = 'A percentage cannot be more than 100';
    if (form.min_order !== '' && Number(form.min_order) < 0) problems.min_order = 'Enter 0 or more';
    if (form.starts_at && form.expires_at && form.expires_at < form.starts_at) problems.expires_at = 'The end date is before the start date';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      if (editing.id) await api.put(`/coupons/${editing.id}`, form);
      else await api.post('/coupons', form);
      toast.success(editing.id ? 'Coupon saved' : 'Coupon created');
      setEditing(null);
      load();
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/coupons/${removing.id}`);
      toast.success('Coupon deleted');
      setRemoving(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!coupons) return <PageSkeleton />;

  return (
    <>
      <PageHeader title="Offers & coupons" description="Active coupons are offered to shoppers in the cart.">
        <Button onClick={() => open(null)}><Plus className="size-4" aria-hidden /> Create coupon</Button>
      </PageHeader>

      <div className="card overflow-hidden">
        {!coupons.length ? (
          <EmptyState icon={Tag} title="No coupons yet" description="Create a coupon to run an offer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Code</th><th>Discount</th><th>Minimum order</th><th>Uses / Customer</th><th>Total used</th><th>Valid</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {coupons.map((c) => {
                  const [tone, label] = state(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <p className="font-semibold tracking-wide">{c.code}</p>
                        {c.description && <p className="line-clamp-1 max-w-xs text-[13px] text-ink-500">{c.description}</p>}
                      </td>
                      <td className="whitespace-nowrap">
                        {c.type === 'percent' ? `${c.value}% off` : `${inr(c.value)} off`}
                        {c.max_discount != null && <span className="block text-[13px] text-ink-500">up to {inr(c.max_discount)}</span>}
                      </td>
                      <td className="tabular-nums">{c.min_order > 0 ? inr(c.min_order) : '—'}</td>
                      <td className="tabular-nums">
                        {c.per_user_limit != null ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sand-100 px-2 py-0.5 text-xs font-semibold text-ink-800">
                            {c.per_user_limit} / customer
                          </span>
                        ) : (
                          <span className="text-xs text-ink-400">Unlimited</span>
                        )}
                      </td>
                      <td className="tabular-nums text-xs text-ink-600">
                        {c.used_count}{c.usage_limit != null ? ` / ${c.usage_limit}` : ''}
                      </td>
                      <td className="text-[13px] whitespace-nowrap text-ink-500">
                        {c.starts_at || c.expires_at ? <>{c.starts_at ? formatDate(c.starts_at) : 'Now'} → {c.expires_at ? formatDate(c.expires_at) : 'No end'}</> : 'Always'}
                      </td>
                      <td><Badge tone={tone}>{label}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-0.5">
                          <button type="button" onClick={() => open(c)} className="icon-btn" aria-label={`Edit ${c.code}`} title="Edit"><Pencil className="size-4" aria-hidden /></button>
                          <button type="button" onClick={() => setRemoving(c)} className="icon-btn hover:bg-clay-50 hover:text-clay-600" aria-label={`Delete ${c.code}`} title="Delete"><Trash2 className="size-4" aria-hidden /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit coupon' : 'Create coupon'} wide>
        <form onSubmit={submit} noValidate className="space-y-4">
          {message && !Object.keys(errors).length && <Alert>{message}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" required autoFocus value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} error={errors.code} placeholder="e.g. EASY10" />
            <Field label="Description" value={form.description} onChange={set('description')} error={errors.description} placeholder="Shown to shoppers in the cart" />
            <Field label="Discount type" as="select" value={form.type} onChange={set('type')}>
              <option value="percent">Percentage (%)</option>
              <option value="flat">Fixed amount (₹)</option>
            </Field>
            <Field label={form.type === 'percent' ? 'Discount (%)' : 'Discount (₹)'} required type="number" min="0" step="0.01" value={form.value} onChange={set('value')} error={errors.value} />
            <Field label="Minimum order (₹)" type="number" min="0" value={form.min_order} onChange={set('min_order')} error={errors.min_order} />
            {form.type === 'percent' && <Field label="Maximum discount (₹)" type="number" min="0" value={form.max_discount} onChange={set('max_discount')} error={errors.max_discount} hint="Leave empty for no cap." />}
            <Field label="Starts on" type="date" value={form.starts_at} onChange={set('starts_at')} error={errors.starts_at} />
            <Field label="Ends on" type="date" value={form.expires_at} onChange={set('expires_at')} error={errors.expires_at} />
            <Field label="Uses per customer" type="number" min="1" value={form.per_user_limit} onChange={set('per_user_limit')} error={errors.per_user_limit} placeholder="e.g. 2" hint="How many times each customer can use this offer (e.g. 2). Leave empty for unlimited." />
            <Field label="Total store-wide uses" type="number" min="1" value={form.usage_limit} onChange={set('usage_limit')} error={errors.usage_limit} placeholder="Leave empty for unlimited" hint="Total across all customers store-wide. Leave empty for unlimited." />
          </div>
          <Toggle label="Active" description="Inactive coupons cannot be applied." checked={form.is_active} onChange={set('is_active')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={busy}>{editing?.id ? 'Save changes' : 'Create coupon'}</Button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} busy={busy} title="Delete this coupon?">
        <strong className="text-ink-900">{removing?.code}</strong> will stop working immediately. Orders that already used it keep their discount.
      </Confirm>
    </>
  );
}
