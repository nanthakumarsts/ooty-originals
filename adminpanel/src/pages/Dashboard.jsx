import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Inbox, PackageX, Plus, ShoppingCart } from 'lucide-react';
import api from '../lib/api';
import { img, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import RevenueChart from '../components/RevenueChart';
import { Alert, Badge, PageHeader, Select, PageSkeleton, cx, usePageTitle } from '../components/ui';

/** Headline number with the change against the previous period. */
function Stat({ label, value, previous, current, note }) {
  let change = null;
  if (previous !== undefined && previous > 0) change = ((current - previous) / previous) * 100;
  // nothing to compare against when the previous period had no sales
  if (previous === 0) note = 'No sales in the previous period';
  const up = change !== null && change >= 0;
  return (
    <div className="card p-5">
      <p className="text-[13px] font-semibold text-ink-500">{label}</p>
      <p className="mt-2 font-display text-[2rem] leading-none font-medium tabular-nums">{value}</p>
      <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-ink-500">
        {change !== null && (
          <span className={cx('inline-flex items-center gap-0.5 font-semibold', up ? 'text-brand-600' : 'text-clay-600')}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {Math.abs(change).toFixed(0)}%
            <span className="sr-only">{up ? 'increase' : 'decrease'}</span>
          </span>
        )}
        {note}
      </p>
    </div>
  );
}

export default function Dashboard() {
  usePageTitle('Dashboard');
  const { admin } = useApp();
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/dashboard?days=${days}`).then(setData).catch((err) => setError(err.message));
  }, [days]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageSkeleton />;

  const versus = `vs previous ${data.days} days`;

  return (
    <>
      <PageHeader title={`Hello, ${admin.name.split(' ')[0]}`} description="Here is how the store is doing.">
        <Select label="Period" value={days} onChange={setDays} options={[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']]} className="w-40" />
      </PageHeader>

      {/* Quick actions — the things an admin does most, one click away */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { to: '/orders?status=confirmed', icon: ShoppingCart, title: 'Orders to fulfil', text: data.to_fulfil > 0 ? `${data.to_fulfil} waiting to be packed` : 'All caught up', alert: data.to_fulfil > 0 },
          { to: '/products/new', icon: Plus, title: 'Add a product', text: 'List something new' },
          { to: '/products?status=out', icon: PackageX, title: 'Out of stock', text: data.out_of_stock > 0 ? `${data.out_of_stock} need restocking` : 'Everything is in stock', alert: data.out_of_stock > 0 },
          { to: '/messages', icon: Inbox, title: 'Messages', text: data.unread_messages > 0 ? `${data.unread_messages} unread` : 'No new messages', alert: data.unread_messages > 0 },
        ].map(({ to, icon: Icon, title, text, alert }) => (
          <Link key={title} to={to} className="card group flex items-center gap-3 p-4 transition-shadow duration-200 hover:shadow-lift">
            <span className={cx('flex size-11 shrink-0 items-center justify-center rounded-full', alert ? 'bg-[#fdf6e7] text-[#7a5510]' : 'bg-brand-50 text-brand-600')}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold group-hover:text-brand-600">{title}</span>
              <span className="block truncate text-[13px] text-ink-500">{text}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={inr(Math.round(data.revenue))} current={data.revenue} previous={data.previousRevenue} note={versus} />
        <Stat label="Orders" value={data.orders} current={data.orders} previous={data.previousOrders} note={versus} />
        <Stat label="Average order value" value={inr(Math.round(data.averageOrder))} note={`Across ${data.orders} ${data.orders === 1 ? 'order' : 'orders'}`} />
        <Stat label="Customers" value={data.customers} note={`${data.new_customers} new in this period`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="card p-5">
          <h2 className="card-title">Revenue per day</h2>
          <p className="text-[13px] text-ink-500">Paid and Cash-on-Delivery orders, excluding cancellations</p>
          <RevenueChart series={data.series} />
        </section>
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="card-title">Top products</h2>
            <p className="text-[13px] text-ink-500">By units sold in this period</p>
            {!data.topProducts.length ? (
              <p className="mt-4 text-sm text-ink-500">No sales in this period yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {data.topProducts.map((p) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <img src={img(p.image)} alt="" className="size-10 shrink-0 rounded-md bg-canvas object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-[13px] text-ink-500">{p.units} sold · {inr(p.revenue)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card p-5">
            <h2 className="card-title">Low stock</h2>
            <p className="text-[13px] text-ink-500">5 or fewer left</p>
            {!data.lowStock.length ? (
              <p className="mt-4 text-sm text-ink-500">Everything is well stocked.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link to={`/products/${p.id}`} className="group flex items-center gap-3">
                      <img src={img(p.image)} alt="" className="size-10 shrink-0 rounded-md bg-canvas object-cover" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-brand-600">{p.name}</span>
                      <Badge tone={p.stock <= 0 ? 'red' : 'amber'}>{p.stock <= 0 ? 'Out' : `${p.stock} left`}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
