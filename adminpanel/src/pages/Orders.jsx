import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Ban, CircleCheck, Clock, PackageCheck, PackageOpen, RotateCcw, ShoppingCart, Truck } from 'lucide-react';
import api from '../lib/api';
import { ORDER_STATUS, PAYMENT_STATUS, formatDate, img, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Badge, Button, EmptyState, PageHeader, Pagination, SearchInput, Select, TableSkeleton, cx, useDebounced, usePageTitle } from '../components/ui';

// The stages an order moves through, in the order the team works on them.
const STAGES = [
  { status: '', label: 'All orders', icon: ShoppingCart },
  { status: 'confirmed', label: 'To pack', icon: PackageOpen, hint: 'New orders, ready to pack' },
  { status: 'processing', label: 'Packing', icon: PackageCheck, hint: 'Being packed — ship next' },
  { status: 'shipped', label: 'Shipped', icon: Truck, hint: 'On the way to the customer' },
  { status: 'delivered', label: 'Delivered', icon: CircleCheck },
  { status: 'returned', label: 'Returned', icon: RotateCcw, hint: 'Returned & refunded' },
  { status: 'pending', label: 'Awaiting payment', icon: Clock, hint: 'Customer has not paid yet' },
  { status: 'cancelled', label: 'Cancelled', icon: Ban },
];

/** What the team does next with an order in each status. */
const NEXT = {
  confirmed: { label: 'Start packing', to: 'processing' },
  processing: { label: 'Add tracking & ship', open: true },
  shipped: { label: 'Mark delivered', to: 'delivered' },
};

function PaymentBadge({ order }) {
  const cod = order.payment_method === 'cod';
  if (cod && order.payment_status === 'pending') return <Badge tone="amber">Cash on delivery</Badge>;
  return <Badge tone={PAYMENT_STATUS[order.payment_status].tone}>{PAYMENT_STATUS[order.payment_status].label}{cod ? ' · COD' : ''}</Badge>;
}

function ItemsPreview({ order }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img src={img(order.image)} alt="" loading="lazy" className="h-11 w-9 shrink-0 rounded-md bg-canvas object-cover" />
      <span className="min-w-0">
        <span className="block truncate text-sm">{order.first_item || '—'}</span>
        <span className="block text-[13px] text-ink-500">
          {order.line_count > 1 ? `+ ${order.line_count - 1} more · ` : ''}{order.item_count} {Number(order.item_count) === 1 ? 'unit' : 'units'}
        </span>
      </span>
    </span>
  );
}

export default function Orders() {
  usePageTitle('Orders');
  const { toast } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [working, setWorking] = useState(null);
  const q = useDebounced(search);

  const setParam = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) (value ? next.set(key, value) : next.delete(key));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') || '') !== q) setParam({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = params.toString();
  const load = useCallback(() => api.get(`/orders?${query}`).then(setData).catch((err) => toast.error(err.message)), [query, toast]);
  useEffect(() => { load(); }, [load]);

  const status = params.get('status') || '';
  const filtered = ['q', 'payment', 'from', 'to'].some((key) => params.get(key));
  const counts = data?.counts || {};

  /** One-click move to the next stage, straight from the list. */
  const advance = async (order, to) => {
    setWorking(order.id);
    try {
      await api.patch(`/orders/${order.id}/status`, { status: to, notify: true });
      toast.success(`${order.order_number} → ${ORDER_STATUS[to].label}. The customer has been emailed.`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWorking(null);
    }
  };

  const action = (order) => {
    const next = NEXT[order.status];
    if (!next) return <Link to={`/orders/${order.id}`} className="btn btn-ghost btn-sm text-brand-600" onClick={(e) => e.stopPropagation()}>View <ArrowRight className="size-4" aria-hidden /></Link>;
    if (next.open) return <Link to={`/orders/${order.id}`} className="btn btn-outline btn-sm" onClick={(e) => e.stopPropagation()}>{next.label}</Link>;
    return <Button size="sm" loading={working === order.id} onClick={(e) => { e.stopPropagation(); advance(order, next.to); }}>{next.label}</Button>;
  };

  return (
    <>
      <PageHeader title="Orders" description="Pick a stage to see its orders. The button on each row moves the order to the next stage." />

      {/* Stages with live counts — click one to filter */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-7" role="tablist" aria-label="Order stage">
        {STAGES.map(({ status: value, label, icon: Icon, hint }) => {
          const active = status === value;
          const count = value ? counts[value] || 0 : counts.all || 0;
          const urgent = (value === 'confirmed' || value === 'processing') && count > 0;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              title={hint}
              onClick={() => setParam({ status: value })}
              className={cx('card flex min-w-36 shrink-0 flex-col gap-1 p-3.5 text-left transition-all duration-150 xl:min-w-0', active ? 'border-brand-600 ring-1 ring-brand-600' : 'hover:border-line-strong hover:shadow-lift')}
            >
              <span className="flex items-center justify-between gap-2">
                <Icon className={cx('size-[18px]', active ? 'text-brand-600' : 'text-ink-400')} aria-hidden />
                {urgent && <span className="size-2 rounded-full bg-[#f2b84b]" aria-label="needs attention" />}
              </span>
              <span className="font-display text-2xl leading-none font-medium tabular-nums">{data ? count : '–'}</span>
              <span className={cx('text-[13px] font-semibold', active ? 'text-brand-700' : 'text-ink-700')}>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_170px_150px_150px_auto]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search order no., customer, email or phone" />
          <Select label="Payment" value={params.get('payment') || ''} onChange={(v) => setParam({ payment: v })} options={[['', 'Any payment'], ['paid', 'Paid'], ['pending', 'Pending'], ['failed', 'Failed'], ['refunded', 'Refunded']]} />
          <input type="date" aria-label="Placed from" title="Placed from" value={params.get('from') || ''} max={params.get('to') || undefined} onChange={(e) => setParam({ from: e.target.value })} className="input" />
          <input type="date" aria-label="Placed up to" title="Placed up to" value={params.get('to') || ''} min={params.get('from') || undefined} onChange={(e) => setParam({ to: e.target.value })} className="input" />
          {filtered && (
            <Button variant="ghost" onClick={() => { setSearch(''); setParams(status ? { status } : {}, { replace: true }); }}>
              <RotateCcw className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </div>

        {!data ? (
          <TableSkeleton />
        ) : !data.items.length ? (
          <EmptyState icon={ShoppingCart} title={filtered || status ? 'No orders match' : 'No orders yet'} description={filtered || status ? 'Try another stage or clear the filters.' : 'Orders placed on the store will appear here.'} />
        ) : (
          <>
            {/* Phones: one card per order */}
            <ul className="divide-y divide-line md:hidden">
              {data.items.map((o) => (
                <li key={o.id} className="p-4">
                  <Link to={`/orders/${o.id}`} className="block">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-brand-600">{o.order_number}</span>
                      <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-500">{formatDate(o.created_at, true)}</span>
                    <span className="mt-2 block text-sm font-medium">{o.customer_name} <span className="font-normal text-ink-500">· {o.ship_city}</span></span>
                    <span className="mt-2 block"><ItemsPreview order={o} /></span>
                  </Link>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="font-semibold tabular-nums">{inr(o.total)}</span><PaymentBadge order={o} /></span>
                    {action(o)}
                  </div>
                </li>
              ))}
            </ul>

            {/* Larger screens: table, whole row opens the order */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th className="text-right">Total</th><th>Payment</th><th>Stage</th><th className="text-right">Next step</th></tr></thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)} className="cursor-pointer">
                      <td className="whitespace-nowrap">
                        <Link to={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-600 hover:underline">{o.order_number}</Link>
                        <span className="block text-[13px] text-ink-500">{formatDate(o.created_at, true)}</span>
                      </td>
                      <td>
                        <span className="block font-medium">{o.customer_name}</span>
                        <span className="block text-[13px] whitespace-nowrap text-ink-500">{o.ship_city} · {o.ship_phone}</span>
                      </td>
                      <td className="max-w-64"><ItemsPreview order={o} /></td>
                      <td className="text-right font-semibold tabular-nums">{inr(o.total)}</td>
                      <td><PaymentBadge order={o} /></td>
                      <td>
                        <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                        {o.status === 'shipped' && o.tracking_number && <span className="mt-1 block text-[12px] text-ink-500">{o.courier ? `${o.courier} · ` : ''}{o.tracking_number}</span>}
                      </td>
                      <td><div className="flex justify-end">{action(o)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => setParam({ page: p > 1 ? String(p) : '' })} />}
      </div>
    </>
  );
}
