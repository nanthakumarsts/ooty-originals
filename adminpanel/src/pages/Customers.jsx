import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../lib/api';
import { formatDate, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Badge, EmptyState, PageHeader, Pagination, SearchInput, Select, TableSkeleton, useDebounced, usePageTitle } from '../components/ui';

export default function Customers() {
  usePageTitle('Customers');
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
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
  useEffect(() => {
    api.get(`/users?${query}`).then(setData).catch((err) => toast.error(err.message));
  }, [query, toast]);

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has registered on the store." />
      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_180px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or phone" />
          <Select label="Status" value={params.get('status') || ''} onChange={(v) => setParam({ status: v })} options={[['', 'All customers'], ['active', 'Active'], ['blocked', 'Blocked']]} />
        </div>
        {!data ? (
          <TableSkeleton />
        ) : !data.items.length ? (
          <EmptyState icon={Users} title="No customers found" description="Customers appear here when they register." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th className="text-right">Orders</th><th className="text-right">Spent</th><th>Status</th></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link to={`/customers/${u.id}`} className="group flex min-w-48 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 uppercase">{u.name.charAt(0)}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold group-hover:text-brand-600">{u.name}</span>
                          <span className="block truncate text-[13px] text-ink-500">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-ink-700">{u.phone || '—'}</td>
                    <td className="whitespace-nowrap text-ink-500">{formatDate(u.created_at)}</td>
                    <td className="text-right tabular-nums">{u.order_count}</td>
                    <td className="text-right font-semibold tabular-nums">{inr(u.total_spent)}</td>
                    <td>{u.status === 'active' ? <Badge tone="green">Active</Badge> : <Badge tone="red">Blocked</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => setParam({ page: p > 1 ? String(p) : '' })} />}
      </div>
    </>
  );
}
