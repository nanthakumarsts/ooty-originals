import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import api from '../../lib/api';
import { ORDER_STATUS, PAYMENT_STATUS, formatDate, img, inr } from '../../lib/format';
import { Alert, Badge, Button, EmptyState, usePageTitle } from '../../components/ui';
import { RowsSkeleton } from '../../components/Skeletons';

export default function Orders() {
  usePageTitle('My orders');
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api.get(`/orders?page=${page}`).then(setData).catch((err) => setError(err.message));
  }, [page]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <RowsSkeleton count={3} />;

  return (
    <section>
      <h2 className="mb-6 text-2xl font-medium">My orders</h2>
      {!data.orders.length ? (
        <div className="card">
          <EmptyState icon={Package} title="No orders yet" description="When you place an order, you can track it here.">
            <Link to="/shop" className="btn btn-primary">Start shopping</Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {data.orders.map((o) => {
              const status = ORDER_STATUS[o.status];
              const unpaid = o.payment_method === 'online' && o.payment_status !== 'paid' && o.status === 'pending';
              return (
                <li key={o.id}>
                  <Link to={`/account/orders/${o.order_number}`} className="card group flex items-center gap-4 p-4 transition-shadow duration-200 hover:shadow-soft sm:gap-5 sm:p-5">
                    <img src={img(o.image)} alt="" loading="lazy" className="aspect-[4/5] w-16 shrink-0 rounded-xl bg-sand-100 object-cover sm:w-20" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{o.order_number}</p>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {unpaid && o.payment_status === 'failed' && <Badge tone="red">{PAYMENT_STATUS.failed.label}</Badge>}
                      </div>
                      <p className="mt-1 truncate text-[15px] text-ink-700">
                        {o.first_item}{o.item_count > 1 ? ` + ${o.item_count - 1} more` : ''}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-500">{formatDate(o.created_at)} · {inr(o.total)}</p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-ink-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink-900" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {data.pages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParams({ page: page - 1 })}>Newer</Button>
              <p className="text-sm text-ink-500">Page {data.page} of {data.pages}</p>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setParams({ page: page + 1 })}>Older</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
