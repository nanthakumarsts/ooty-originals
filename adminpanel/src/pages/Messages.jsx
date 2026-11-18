import { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, Reply, Trash2, Users } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Button, Confirm, EmptyState, Modal, PageHeader, Pagination, PageSkeleton, TableSkeleton, cx, usePageTitle } from '../components/ui';

// The storefront newsletter sign-up is switched off, so its admin tab is hidden too.
const SHOW_NEWSLETTER = false;

function Subscribers() {
  const { toast } = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get('/subscribers').then((d) => setItems(d.items)).catch((err) => toast.error(err.message));
  }, [toast]);

  const exportCsv = () => {
    const csv = ['email,subscribed_on', ...items.map((s) => `${s.email},${new Date(s.created_at).toISOString().slice(0, 10)}`)].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'newsletter-subscribers.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!items) return <PageSkeleton />;
  if (!items.length) return <EmptyState icon={Users} title="No subscribers yet" description="People who join the newsletter from the store footer appear here." />;
  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm text-ink-500">{items.length} {items.length === 1 ? 'subscriber' : 'subscribers'}</p>
        <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Email</th><th>Subscribed</th></tr></thead>
          <tbody>{items.map((s) => <tr key={s.id}><td className="font-medium">{s.email}</td><td className="text-ink-500">{formatDate(s.created_at)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

export default function Messages() {
  usePageTitle('Messages');
  const { toast } = useApp();
  const [tab, setTab] = useState('inbox');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get(`/messages?page=${page}`).then(setData).catch((err) => toast.error(err.message)), [page, toast]);
  useEffect(() => { load(); }, [load]);

  const open = async (m) => {
    setViewing(m);
    if (!m.is_read) {
      await api.patch(`/messages/${m.id}`, { is_read: true }).catch(() => {});
      load();
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/messages/${removing.id}`);
      toast.success('Message deleted');
      setRemoving(null);
      setViewing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Messages" description="Enquiries sent from the contact form on the store." />
      <div className="card overflow-hidden">
        <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-3 pt-2">
          {[['inbox', 'Contact enquiries', Inbox], ...(SHOW_NEWSLETTER ? [['subscribers', 'Newsletter subscribers', Mail]] : [])].map(([value, label, Icon]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cx('-mb-px flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors', tab === value ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-900')}>
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        {tab === 'subscribers' ? (
          <Subscribers />
        ) : !data ? (
          <TableSkeleton />
        ) : !data.items.length ? (
          <EmptyState icon={Inbox} title="No messages yet" description="Messages sent from the store's contact form will appear here." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {data.items.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => open(m)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-canvas/60">
                    <span className={cx('mt-2 size-2 shrink-0 rounded-full', m.is_read ? 'bg-transparent' : 'bg-brand-600')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cx('truncate', m.is_read ? 'font-medium' : 'font-bold')}>{m.name}{!m.is_read && <span className="sr-only"> (unread)</span>}</span>
                        <span className="shrink-0 text-[13px] text-ink-500">{formatDate(m.created_at)}</span>
                      </span>
                      <span className={cx('block truncate text-sm', m.is_read ? 'text-ink-700' : 'font-semibold text-ink-900')}>{m.subject}</span>
                      <span className="block truncate text-sm text-ink-500">{m.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        )}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.subject || ''} wide>
        {viewing && (
          <>
            <dl className="grid gap-x-6 gap-y-1 rounded-lg bg-canvas p-3 text-sm sm:grid-cols-2">
              <div><dt className="inline text-ink-500">From: </dt><dd className="inline font-semibold">{viewing.name}</dd></div>
              <div><dt className="inline text-ink-500">Received: </dt><dd className="inline">{formatDate(viewing.created_at, true)}</dd></div>
              <div><dt className="inline text-ink-500">Email: </dt><dd className="inline break-all">{viewing.email}</dd></div>
              {viewing.phone && <div><dt className="inline text-ink-500">Phone: </dt><dd className="inline">{viewing.phone}</dd></div>}
            </dl>
            <p className="mt-4 leading-relaxed whitespace-pre-wrap text-ink-700">{viewing.message}</p>
            <div className="mt-6 flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setRemoving(viewing)} className="text-clay-600 hover:bg-clay-50"><Trash2 className="size-4" aria-hidden /> Delete</Button>
              <a href={`mailto:${viewing.email}?subject=${encodeURIComponent(`Re: ${viewing.subject}`)}`} className="btn btn-primary"><Reply className="size-4" aria-hidden /> Reply by email</a>
            </div>
          </>
        )}
      </Modal>

      <Confirm open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} busy={busy} title="Delete this message?">
        The message from <strong className="text-ink-900">{removing?.name}</strong> will be permanently deleted.
      </Confirm>
    </>
  );
}
