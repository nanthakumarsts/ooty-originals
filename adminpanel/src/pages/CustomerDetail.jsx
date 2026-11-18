import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CircleCheck, Mail, Phone } from 'lucide-react';
import api from '../lib/api';
import { ORDER_STATUS, PAYMENT_STATUS, formatDate, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Alert, Badge, Button, Confirm, PageHeader, PageSkeleton, usePageTitle } from '../components/ui';

export default function CustomerDetail() {
  const { id } = useParams();
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  usePageTitle(data?.user.name || 'Customer');

  const load = useCallback(() => api.get(`/users/${id}`).then(setData).catch((err) => setError(err.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const back = <Link to="/customers" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" aria-hidden /> Customers</Link>;
  if (error) return <>{back}<Alert>{error}</Alert></>;
  if (!data) return <PageSkeleton />;

  const { user, addresses, orders } = data;
  const blocked = user.status === 'blocked';
  const spent = orders.filter((o) => o.status !== 'cancelled' && (o.payment_status === 'paid' || o.payment_method === 'cod')).reduce((sum, o) => sum + o.total, 0);

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const d = await api.patch(`/users/${id}/status`, { status });
      toast.success(d.message);
      setConfirming(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={user.name} description={`Customer since ${formatDate(user.created_at)}`} back={back}>
        {blocked ? <Badge tone="red">Blocked</Badge> : <Badge tone="green">Active</Badge>}
        {blocked ? (
          <Button variant="outline" onClick={() => setStatus('active')} loading={busy}><CircleCheck className="size-4" aria-hidden /> Unblock</Button>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)} className="text-clay-600"><Ban className="size-4" aria-hidden /> Block</Button>
        )}
      </PageHeader>

      <div className="grid items-start gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <section className="card p-5 text-sm">
            <h2 className="card-title mb-3">Contact</h2>
            <a href={`mailto:${user.email}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-600"><Mail className="size-4 text-ink-400" aria-hidden />{user.email}</a>
            {user.phone && <a href={`tel:${user.phone}`} className="mt-1.5 flex items-center gap-2 text-ink-700 hover:text-brand-600"><Phone className="size-4 text-ink-400" aria-hidden />{user.phone}</a>}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div><dt className="text-[13px] text-ink-500">Orders</dt><dd className="font-display text-2xl font-medium tabular-nums">{orders.length}</dd></div>
              <div><dt className="text-[13px] text-ink-500">Total spent</dt><dd className="font-display text-2xl font-medium tabular-nums">{inr(spent)}</dd></div>
            </dl>
            <p className="mt-4 text-[13px] text-ink-500">Last sign-in: {formatDate(user.last_login_at, true)}</p>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="card-title mb-3">Saved addresses</h2>
            {!addresses.length ? (
              <p className="text-ink-500">No saved addresses.</p>
            ) : (
              <ul className="space-y-4">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <p className="flex items-center gap-2 font-semibold">{a.full_name} <Badge>{a.label}</Badge>{!!a.is_default && <Badge tone="green">Default</Badge>}</p>
                    <p className="leading-relaxed text-ink-700">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}</p>
                    <p className="text-ink-500">{a.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card overflow-hidden">
          <h2 className="card-title p-5 pb-3">Orders</h2>
          {!orders.length ? (
            <p className="px-5 pb-5 text-sm text-ink-500">This customer has not placed an order yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link to={`/orders/${o.id}`} className="font-semibold text-brand-600 hover:underline">{o.order_number}</Link></td>
                      <td className="whitespace-nowrap text-ink-500">{formatDate(o.created_at)}</td>
                      <td><Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge></td>
                      <td><Badge tone={PAYMENT_STATUS[o.payment_status].tone}>{PAYMENT_STATUS[o.payment_status].label}</Badge></td>
                      <td className="text-right font-semibold tabular-nums">{inr(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Confirm open={confirming} onClose={() => setConfirming(false)} onConfirm={() => setStatus('blocked')} busy={busy} title="Block this customer?" confirmLabel="Block customer">
        <strong className="text-ink-900">{user.name}</strong> will be signed out and will not be able to sign in or place orders until unblocked. Existing orders are not affected.
      </Confirm>
    </>
  );
}
