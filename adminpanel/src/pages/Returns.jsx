import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileVideo,
  Image as ImageIcon,
  RotateCcw,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import api from '../lib/api';
import { formatDate, img, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Badge, Button, EmptyState, Modal, PageHeader, TableSkeleton, cx, useDebounced, usePageTitle } from '../components/ui';

const RETURN_STATUS = {
  pending: { label: 'Pending review', tone: 'amber', icon: Clock },
  approved: { label: 'Approved & Refunded', tone: 'green', icon: CheckCircle2 },
  rejected: { label: 'Declined', tone: 'red', icon: XCircle },
};

export default function Returns() {
  usePageTitle('Returns & Refunds');
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeItem, setActiveItem] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const debouncedSearch = useDebounced(search, 300);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    api
      .get(`/returns?${params.toString()}`)
      .then(setData)
      .catch((err) => toast.error(err.message));
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const items = (data?.items || []).filter((item) => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      item.order_number?.toLowerCase().includes(q) ||
      item.customer_name?.toLowerCase().includes(q) ||
      item.customer_email?.toLowerCase().includes(q) ||
      item.reason?.toLowerCase().includes(q)
    );
  });

  const counts = data?.counts || { total: 0, pending: 0, approved: 0, rejected: 0 };

  const handleApprove = async () => {
    if (!activeItem) return;
    setActionBusy('approve');
    try {
      const res = await api.post(`/orders/${activeItem.order_id}/return/approve`, { adminNote });
      toast.success(res.message || 'Return approved, Razorpay refund initiated, and Shiprocket reverse pickup scheduled!');
      setActiveItem(null);
      setAdminNote('');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to approve return');
    } finally {
      setActionBusy('');
    }
  };

  const handleReject = async () => {
    if (!activeItem) return;
    if (!adminNote.trim()) {
      return toast.error('Please specify a reason for rejecting the return.');
    }
    setActionBusy('reject');
    try {
      const res = await api.post(`/orders/${activeItem.order_id}/return/reject`, { adminNote });
      toast.success(res.message || 'Return request declined.');
      setActiveItem(null);
      setAdminNote('');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to decline return');
    } finally {
      setActionBusy('');
    }
  };

  const getMediaUrl = (path) => {
    if (!path) return '';
    return img(path);
  };

  return (
    <>
      <PageHeader
        title="Returns & Refunds"
        description="Review customer return requests, inspect proof videos and images, issue automated Razorpay refunds, and schedule Shiprocket reverse pickups."
      />

      {/* Status tabs with live counts */}
      <div className="mb-6 flex flex-wrap gap-2.5">
        {[
          { key: '', label: 'All requests', count: counts.total },
          { key: 'pending', label: 'Pending review', count: counts.pending, urgent: counts.pending > 0 },
          { key: 'approved', label: 'Approved & Refunded', count: counts.approved },
          { key: 'rejected', label: 'Declined', count: counts.rejected },
        ].map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-150',
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-900 shadow-xs ring-1 ring-brand-600'
                  : 'border-line bg-white text-ink-700 hover:border-line-strong hover:bg-canvas'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                  active ? 'bg-brand-600 text-white' : tab.urgent ? 'bg-amber-100 text-amber-900' : 'bg-sand-200 text-ink-700'
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main card */}
      <div className="card overflow-hidden">
        <div className="border-b border-line p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order #, customer, email, or reason..."
              className="input pl-9"
            />
          </div>
        </div>

        {!data ? (
          <TableSkeleton />
        ) : !items.length ? (
          <EmptyState
            icon={RotateCcw}
            title={statusFilter || search ? 'No return requests found' : 'No returns yet'}
            description={
              statusFilter || search
                ? 'Try changing the status filter or search query.'
                : 'Customer return requests will appear here for review and refund processing.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Reason & Proof</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Requested</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((r) => {
                  const statusMeta = RETURN_STATUS[r.status] || { label: r.status, tone: 'gray' };
                  const videoCount = (r.attachments || []).filter((a) => a.type === 'video').length;
                  const imageCount = (r.attachments || []).filter((a) => a.type === 'image').length;

                  return (
                    <tr key={r.id} className="hover:bg-sand-50/50 transition-colors">
                      <td className="px-5 py-4 font-semibold">
                        <Link to={`/orders/${r.order_id}`} className="text-brand-600 hover:underline">
                          {r.order_number}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-ink-900">{r.customer_name}</div>
                        <div className="text-xs text-ink-500">{r.customer_email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-ink-900">{r.reason}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                          {videoCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 font-medium">
                              <FileVideo className="size-3" /> {videoCount} video
                            </span>
                          )}
                          {imageCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-sand-100 px-1.5 py-0.5 text-ink-700 font-medium">
                              <ImageIcon className="size-3" /> {imageCount} photo{imageCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {!videoCount && !imageCount && <span>No media attached</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-display font-medium text-ink-900 tabular-nums">
                        {inr(r.total)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                        {r.razorpay_refund_id && (
                          <div className="mt-1 text-[11px] font-mono text-emerald-700">
                            Refund ID: {r.razorpay_refund_id}
                          </div>
                        )}
                        {r.shiprocket_return_order_id && (
                          <div className="text-[11px] font-mono text-pine-700 flex items-center gap-1">
                            <Truck className="size-3" /> SR Return #{r.shiprocket_return_order_id}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-ink-500">
                        {formatDate(r.created_at, true)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {r.status === 'pending' ? (
                          <Button size="sm" onClick={() => { setActiveItem(r); setAdminNote(''); }}>
                            Review & Action
                          </Button>
                        ) : (
                          <Link to={`/orders/${r.order_id}`} className="btn btn-ghost btn-sm text-brand-600">
                            Details <ArrowRight className="size-3.5 ml-1" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review & Approve / Decline Modal */}
      {activeItem && (
        <Modal wide open={Boolean(activeItem)} onClose={() => setActiveItem(null)} title={`Review Return for ${activeItem.order_number}`}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-canvas p-4 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-ink-500 block">Customer</span>
                <span className="font-semibold text-ink-900">{activeItem.customer_name}</span>
              </div>
              <div>
                <span className="text-xs text-ink-500 block">Order Total</span>
                <span className="font-semibold text-ink-900">{inr(activeItem.total)}</span>
              </div>
              <div>
                <span className="text-xs text-ink-500 block">Payment Method</span>
                <span className="font-semibold text-ink-900 uppercase">{activeItem.payment_method}</span>
              </div>
              <div>
                <span className="text-xs text-ink-500 block">Order Placed</span>
                <span className="font-semibold text-ink-900">{formatDate(activeItem.order_created_at)}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500">Return Reason</h4>
              <p className="mt-1 text-base font-medium text-ink-900">{activeItem.reason}</p>
              {(activeItem.description || activeItem.customer_note) && (
                <div className="mt-2.5 rounded-xl border border-sand-200 bg-sand-50/70 p-3.5 text-sm text-ink-800">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">Customer Note / Message:</span>
                  <p className="italic leading-relaxed">"{activeItem.description || activeItem.customer_note}"</p>
                </div>
              )}
            </div>

            {/* Proof Gallery / Video Player */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                Attached Proofs ({(activeItem.attachments || []).length})
              </h4>
              {!(activeItem.attachments || []).length ? (
                <p className="text-sm text-ink-400 italic">No attachments provided.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeItem.attachments.map((att, idx) => (
                    <div key={idx} className="rounded-xl border border-line overflow-hidden bg-black/5">
                      {att.type === 'video' ? (
                        <div>
                          <video
                            src={getMediaUrl(att.url)}
                            controls
                            preload="metadata"
                            className="w-full max-h-60 bg-black rounded-t-xl"
                          />
                          <div className="p-2 text-xs font-medium text-ink-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><FileVideo className="size-3.5 text-amber-600" /> Video Proof</span>
                            <a href={getMediaUrl(att.url)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open file</a>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <img
                            src={getMediaUrl(att.url)}
                            alt={`Proof ${idx + 1}`}
                            className="w-full h-44 object-cover"
                          />
                          <div className="p-2 text-xs font-medium text-ink-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><ImageIcon className="size-3.5 text-brand-600" /> Photo Proof</span>
                            <a href={getMediaUrl(att.url)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Full size</a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Admin Note Input */}
            <div>
              <label className="label">Note for customer (included in email)</label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="e.g., Return approved after inspecting video proof. Reverse pickup has been scheduled."
                className="input"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line">
              <Button
                variant="outline"
                className="text-clay-600 hover:bg-clay-50 border-clay-300"
                loading={actionBusy === 'reject'}
                onClick={handleReject}
              >
                Decline Return
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setActiveItem(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={actionBusy === 'approve'}
                  onClick={handleApprove}
                >
                  Approve Return &amp; Refund ({inr(Math.max(0, Number(activeItem.total) - Number(activeItem.shipping_fee || 0)))})
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
