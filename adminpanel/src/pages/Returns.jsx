import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileVideo,
  Image as ImageIcon,
  PackageCheck,
  RotateCcw,
  Search,
  Sparkles,
  Truck,
  XCircle,
} from 'lucide-react';
import api from '../lib/api';
import { formatDate, img, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Badge, Button, EmptyState, Modal, PageHeader, TableSkeleton, cx, useDebounced, usePageTitle } from '../components/ui';

const RETURN_STATUS = {
  pending: { label: 'Pending review', tone: 'amber', icon: Clock },
  approved: { label: 'Awaiting pickup confirmation', tone: 'blue', icon: CheckCircle2 },
  pickup_scheduled: { label: 'Pickup scheduled', tone: 'purple', icon: Truck },
  received: { label: 'Received (Inspecting)', tone: 'amber', icon: PackageCheck },
  refund_processing: { label: 'Processing refund', tone: 'amber', icon: Clock },
  refund_initiated: { label: 'Refund initiated', tone: 'blue', icon: Clock },
  refunded: { label: 'Refunded', tone: 'green', icon: CheckCircle2 },
  refund_failed: { label: 'Refund failed (Action required)', tone: 'red', icon: XCircle },
  rejected: { label: 'Declined', tone: 'red', icon: XCircle },
  cancelled: { label: 'Cancelled by customer', tone: 'gray', icon: XCircle },
};

export default function Returns() {
  usePageTitle('Returns & Refunds');
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  
  // Modals state
  const [reviewItem, setReviewItem] = useState(null);
  const [scheduleItem, setScheduleItem] = useState(null);
  const [pickupQuote, setPickupQuote] = useState(null);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [courierId, setCourierId] = useState(null);
  useEffect(() => {
    if (!scheduleItem) return;
    let current = true;
    setPickupQuote(null);
    setCourierId(null);
    api.get(`/returns/${scheduleItem.id}/pickup-options`).then(result => {
      if (current) {
        setPickupQuote(result);
        setCourierId(result.couriers[0]?.id ?? null);
      }
    }).catch(err => {
      if (current) setPickupQuote({ error: err.message });
    });
    return () => { current = false; };
  }, [scheduleItem, quoteRevision]);
  const selectedCourier = pickupQuote?.couriers?.find(c => c.id === courierId);
  const [refundItem, setRefundItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  // Form states
  const [adminNote, setAdminNote] = useState('');
  
  // Tomorrow's date as default pickup date
  const tomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };
  const [pickupDate, setPickupDate] = useState(tomorrowStr());
  
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

  const counts = data?.counts || {
    total: 0,
    pending: 0,
    approved: 0,
    pickup_scheduled: 0,
    received: 0,
    refund_processing: 0,
    refund_initiated: 0,
    refunded: 0,
    refund_failed: 0,
    rejected: 0,
    cancelled: 0,
  };

  /** Calculate total eligible product price of returned items (accounting for proportional coupon discount) */
  const calcProductTotal = (item) => {
    if (item?.refund_amount != null && Number(item.refund_amount) > 0) return Number(item.refund_amount);
    if (item?.items?.length) {
      return item.items.reduce((sum, i) => sum + Number(i.line_total || (Number(i.price) * Number(i.quantity))), 0);
    }
    return Math.max(0, Math.round((Number(item?.total || 0) - Number(item?.shipping_fee || 0)) * 100) / 100);
  };

  // Step 1: Approve return request
  const handleApprove = async () => {
    if (!reviewItem) return;
    setActionBusy('approve');
    try {
      const res = await api.post(`/returns/${reviewItem.id}/approve`, { adminNote });
      toast.success(res.message || 'Return request approved. You can now schedule reverse pickup.');
      setReviewItem(null);
      setAdminNote('');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to approve return');
    } finally {
      setActionBusy('');
    }
  };

  // Reject return request
  const handleReject = async () => {
    if (!reviewItem) return;
    if (!adminNote.trim()) {
      return toast.error('Please specify a reason for rejecting the return.');
    }
    setActionBusy('reject');
    try {
      const res = await api.post(`/returns/${reviewItem.id}/reject`, { adminNote });
      toast.success(res.message || 'Return request declined.');
      setReviewItem(null);
      setAdminNote('');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to decline return');
    } finally {
      setActionBusy('');
    }
  };

  // Step 2: Schedule reverse pickup
  const handleSchedulePickup = async () => {
    if (!scheduleItem) return;
    if (!pickupDate) return toast.error('Please select a scheduled pickup date');
    setActionBusy('schedule');
    try {
      const res = await api.post(`/returns/${scheduleItem.id}/schedule-pickup`, {
        pickupDate, courierId: selectedCourier?.id, quotedRate: selectedCourier?.rate,
      });
      toast.success(res.message || 'Reverse pickup scheduled and customer notified!');
      setScheduleItem(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to schedule pickup');
      setPickupQuote(null);
      setQuoteRevision(n => n + 1);
    } finally {
      setActionBusy('');
    }
  };

  // Step 3: Mark package received at warehouse
  const handleMarkReceived = async (item) => {
    setActionBusy(`receive-${item.id}`);
    try {
      const res = await api.post(`/returns/${item.id}/receive`);
      toast.success(res.message || 'Package marked as received. You can now inspect the product.');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to mark package as received');
    } finally {
      setActionBusy('');
    }
  };

  // Step 4: Process refund (Product price only)
  const handleProcessRefund = async () => {
    if (!refundItem) return;
    setActionBusy('refund');
    try {
      const res = await api.post(`/returns/${refundItem.id}/refund`);
      if (res.returnRequest?.status === 'refunded') toast.success('Refund processed by Razorpay.');
      else toast.info('Refund submitted. Awaiting gateway confirmation.');
      setRefundItem(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to process refund');
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
        // description="Follow the return lifecycle: Review Proof ➔ Schedule Reverse Pickup ➔ Inspect Physical Product ➔ Issue Product Refund."
      />

      {/* Status tabs with live counts */}
      <div className="mb-6 flex flex-wrap gap-2.5">
        {[
          { key: '', label: 'All requests', count: counts.total },
          { key: 'pending', label: 'Pending review', count: counts.pending, urgent: counts.pending > 0 },
          { key: 'approved', label: 'Awaiting pickup', count: counts.approved },
          { key: 'pickup_scheduled', label: 'Pickup scheduled', count: counts.pickup_scheduled },
          { key: 'received', label: 'Received (Inspecting)', count: counts.received, urgent: counts.received > 0 },
          { key: 'refund_processing', label: 'Processing', count: counts.refund_processing, hideIfZero: true },
          { key: 'refund_initiated', label: 'Refund initiated', count: counts.refund_initiated, hideIfZero: true },
          { key: 'refunded', label: 'Refunded', count: counts.refunded },
          { key: 'refund_failed', label: 'Refund failed', count: counts.refund_failed, urgent: (counts.refund_failed || 0) > 0 },
          { key: 'rejected', label: 'Declined', count: counts.rejected },
          { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
        ].filter(tab => !tab.hideIfZero || tab.count > 0 || statusFilter === tab.key).map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-150',
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
                : 'Customer return requests will appear here for review, reverse pickup, and inspection.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Returned Product &amp; Reason</th>
                  <th className="px-5 py-3.5 text-right">Product Price</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Schedule / Dates</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((r) => {
                  const statusMeta = RETURN_STATUS[r.status] || { label: r.status, tone: 'gray' };
                  const videoCount = (r.attachments || []).filter((a) => a.type === 'video').length;
                  const imageCount = (r.attachments || []).filter((a) => a.type === 'image').length;
                  const prodTotal = calcProductTotal(r);

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
                      <td className="px-5 py-4 max-w-xs">
                        <div className="font-medium text-ink-900 truncate">{r.reason}</div>
                        {r.items?.length > 0 && (
                          <div className="mt-1 text-xs text-brand-700 font-medium">
                            {r.items.map((i) => `${i.name} (×${i.quantity})`).join(', ')}
                          </div>
                        )}
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
                        <div className="font-bold text-ink-900 text-base">
                          {inr(prodTotal)}
                        </div>
                        <div className="text-[11px] text-ink-400 font-sans">
                          Product price only
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                        {r.status === 'refunded' && r.razorpay_refund_id && (
                          <div className="mt-1 text-[11px] font-mono text-emerald-700">
                            Refund ID: {r.razorpay_refund_id}
                          </div>
                        )}
                        {r.status === 'refund_failed' && r.admin_note && (
                          <div className="mt-1 text-[11px] text-rose-700 max-w-[200px] truncate" title={r.admin_note}>
                            {r.admin_note}
                          </div>
                        )}
                        {r.shiprocket_return_order_id && (
                          <div className="mt-1 text-[11px] font-mono text-pine-700 flex items-center gap-1">
                            <Truck className="size-3" /> SR Return #{r.shiprocket_return_order_id}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-ink-600">
                        {r.pickup_date ? (
                          <div className="flex items-center gap-1 font-semibold text-brand-800">
                            <Calendar className="size-3.5 text-brand-600" /> Pickup: {formatDate(r.pickup_date)}
                          </div>
                        ) : (
                          <span className="text-ink-400">Req: {formatDate(r.created_at)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {/* Progressive Actions according to stage */}
                        {r.status === 'pending' && (
                          <Button size="sm" onClick={() => { setReviewItem(r); setAdminNote(''); }}>
                            Review Proof
                          </Button>
                        )}

                        {r.status === 'approved' && (
                          <>
                          <Button size="sm" onClick={() => { setScheduleItem(r); setPickupDate(tomorrowStr()); }} className="bg-brand-600 hover:bg-brand-700 text-white gap-1.5">
                            <Calendar className="size-3.5" /> Schedule Pickup
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setReviewItem(r); setAdminNote(''); }}>Decline Return</Button>
                          </>
                        )}

                        {r.status === 'pickup_scheduled' && (
                          <Button
                            size="sm"
                            loading={actionBusy === `receive-${r.id}`}
                            onClick={() => handleMarkReceived(r)}
                            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                          >
                            <PackageCheck className="size-3.5" /> Mark Received
                          </Button>
                        )}

                        {r.status === 'received' && (
                          <Button
                            size="sm"
                            onClick={() => setRefundItem(r)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                          >
                            <Sparkles className="size-3.5" /> Inspect &amp; Refund
                          </Button>
                        )}

                        {r.status === 'refund_failed' && (
                          <Button
                            size="sm"
                            onClick={() => setRefundItem(r)}
                            className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-xs"
                          >
                            <RotateCcw className="size-3.5" /> Retry Refund
                          </Button>
                        )}

                        {r.status === 'refund_processing' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRefundItem(r)}
                            className="border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5 text-xs"
                          >
                            <Clock className="size-3.5 animate-spin" /> Check / Retry
                          </Button>
                        )}

                        {r.status === 'refund_initiated' && (
                          <Button size="sm" variant="ghost" onClick={() => setDetailItem(r)} className="text-ink-600">
                            Details <Eye className="size-3.5 ml-1" />
                          </Button>
                        )}

                        {r.status === 'refunded' && (
                          <Button size="sm" variant="ghost" onClick={() => setDetailItem(r)} className="text-ink-600">
                            Details <Eye className="size-3.5 ml-1" />
                          </Button>
                        )}

                        {r.status === 'rejected' && (
                          <Button size="sm" variant="ghost" onClick={() => setDetailItem(r)} className="text-ink-600">
                            Declined <Eye className="size-3.5 ml-1" />
                          </Button>
                        )}

                        {r.status === 'cancelled' && (
                          <Button size="sm" variant="ghost" onClick={() => setDetailItem(r)} className="text-ink-600">
                            Cancelled <Eye className="size-3.5 ml-1" />
                          </Button>
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

      {/* Step 1: Review Proof Modal */}
      {reviewItem && (
        <Modal wide open={Boolean(reviewItem)} onClose={() => setReviewItem(null)} title={`Review Return: Order ${reviewItem.order_number}`}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-canvas p-4 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-ink-500 block">Customer</span>
                <span className="font-semibold text-ink-900">{reviewItem.customer_name}</span>
                <span className="text-xs text-ink-500 block">{reviewItem.customer_email}</span>
              </div>
              <div>
                <span className="text-xs text-ink-500 block">Product Refund Total</span>
                <span className="font-bold text-emerald-700 text-base">
                  {inr(calcProductTotal(reviewItem))}
                </span>
                <span className="text-[11px] text-ink-400 block">(Delivery fee not refunded)</span>
              </div>
              <div>
                <span className="text-xs text-ink-500 block">Payment Method</span>
                <span className="font-semibold text-ink-900 uppercase">{reviewItem.payment_method}</span>
              </div>
              <div>
                <span className="text-xs text-ink-500 block">Requested On</span>
                <span className="font-semibold text-ink-900">{formatDate(reviewItem.created_at, true)}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500">Return Reason</h4>
              <p className="mt-1 text-base font-medium text-ink-900">{reviewItem.reason}</p>
              {(reviewItem.description || reviewItem.customer_note) && (
                <div className="mt-2.5 rounded-xl border border-sand-200 bg-sand-50/70 p-3.5 text-sm text-ink-800">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">Customer Note:</span>
                  <p className="italic leading-relaxed">"{reviewItem.description || reviewItem.customer_note}"</p>
                </div>
              )}
            </div>

            {/* Returned Products breakdown */}
            {reviewItem.items?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                  Product(s) Selected for Return ({reviewItem.items.length})
                </h4>
                <div className="rounded-xl border border-line divide-y divide-line overflow-hidden bg-white text-xs">
                  {reviewItem.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {it.image && (
                          <img src={getMediaUrl(it.image)} alt="" className="size-11 rounded-lg object-cover border border-line shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-ink-900 truncate">{it.name}</p>
                          {it.variant_label && <p className="text-ink-500">{it.variant_label}</p>}
                          <p className="text-ink-600">{inr(it.price)} per unit</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-ink-600 text-xs">Qty: <strong className="text-ink-900 text-sm">{it.quantity}</strong></span>
                        <p className="font-bold text-sm text-ink-900 tabular-nums">
                          {inr(it.line_total || (it.price * it.quantity))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proof Gallery / Video Player */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                Attached Proofs ({(reviewItem.attachments || []).length})
              </h4>
              {!(reviewItem.attachments || []).length ? (
                <p className="text-sm text-ink-400 italic">No attachments provided.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviewItem.attachments.map((att, idx) => (
                    <div key={idx} className="rounded-xl border border-line overflow-hidden bg-black/5">
                      {att.type === 'video' ? (
                        <div>
                          <video src={getMediaUrl(att.url)} controls preload="metadata" className="w-full max-h-60 bg-black rounded-t-xl" />
                          <div className="p-2 text-xs font-medium text-ink-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><FileVideo className="size-3.5 text-amber-600" /> Video Proof</span>
                            <a href={getMediaUrl(att.url)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open file</a>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <img src={getMediaUrl(att.url)} alt={`Proof ${idx + 1}`} className="w-full h-44 object-cover" />
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
              <label className="label">{reviewItem.status === 'approved' ? 'Reason for declining (sent to customer)' : 'Review note (required to decline)'}</label>
              <textarea
                rows={2}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="e.g. Return approved based on photo proof. Reverse pickup will be arranged."
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
                <Button variant="ghost" onClick={() => setReviewItem(null)}>
                  Cancel
                </Button>
                {reviewItem.status === 'pending' && <Button
                  variant="primary"
                  loading={actionBusy === 'approve'}
                  onClick={handleApprove}
                  className="bg-brand-600 hover:bg-brand-700 text-white"
                >
                  Move to pickup scheduling
                </Button>}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Step 2: Schedule Pickup Modal */}
      {scheduleItem && (
        <Modal open={Boolean(scheduleItem)} onClose={() => { if (!actionBusy) setScheduleItem(null); }} title={`Schedule Reverse Pickup: Order ${scheduleItem.order_number}`}>
          <div className="space-y-5">
            <div className="space-y-2 text-sm" aria-live="polite">
              <p className="label font-semibold">Reverse courier</p>
              {!pickupQuote ? <p>Checking Shiprocket rates…</p> : pickupQuote.error ? (
                <div role="alert">{pickupQuote.error} <button type="button" className="underline" onClick={() => setQuoteRevision(n => n + 1)}>Retry</button></div>
              ) : pickupQuote.assigned ? (
                <p>{pickupQuote.assigned.name || 'Assigned courier'} · AWB {pickupQuote.assigned.awb}</p>
              ) : pickupQuote.couriers.map((c, index) => (
                <label key={c.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <input type="radio" name="reverseCourier" checked={courierId === c.id} disabled={Boolean(actionBusy)} onChange={() => setCourierId(c.id)} />
                  <span className="flex-1">{c.name}{index === 0 && <small className="block text-brand-700">Lowest charge</small>}</span>
                  <strong>{inr(c.rate)}</strong>
                </label>
              ))}
            </div>

            <div>
              <label className="label font-semibold">Scheduled Pickup Date (When courier collects parcel)</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="input mt-1"
                required
              />
              <p className="mt-1 text-xs text-ink-500">The customer will receive the pickup date confirmed by Shiprocket.</p>
            </div>

            {scheduleItem.items?.length > 0 && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500 block mb-1.5">Items to Pick Up:</span>
                <div className="rounded-xl border border-line divide-y divide-line bg-canvas p-2 text-xs">
                  {scheduleItem.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1 px-2 font-medium">
                      <span>{it.name} {it.variant_label ? `(${it.variant_label})` : ''}</span>
                      <span>Qty: <strong>{it.quantity}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
              <Button variant="ghost" disabled={Boolean(actionBusy)} onClick={() => setScheduleItem(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={actionBusy === 'schedule'}
                disabled={!pickupDate || (!selectedCourier && !pickupQuote?.assigned)}
                onClick={handleSchedulePickup}
                className="bg-brand-600 hover:bg-brand-700 text-white"
              >
                Confirm &amp; Schedule Pickup
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Step 4: Inspect & Refund Modal */}
      {refundItem && (
        <Modal open={Boolean(refundItem)} onClose={() => setRefundItem(null)} title={`Inspect & Process Refund: Order ${refundItem.order_number}`}>
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-sm text-emerald-950 space-y-2">
              <p className="font-semibold text-emerald-900">🔍 Package Received at Warehouse</p>
              <p className="text-xs text-emerald-800">
                You have received the returned parcel. Once you have physically checked and confirmed the product condition, initiate the refund below.
              </p>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-500 block mb-2">Inspected Returned Product(s):</span>
              <div className="rounded-xl border border-line divide-y divide-line bg-white p-3 text-xs space-y-2">
                {(refundItem.items || []).map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between pt-2 first:pt-0">
                    <div>
                      <p className="font-semibold text-ink-900">{it.name}</p>
                      <p className="text-ink-500">{it.quantity} × {inr(it.price)}</p>
                    </div>
                    <span className="font-bold text-sm text-ink-900">{inr(it.line_total || (it.price * it.quantity))}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Refund Calculation Breakdown */}
            <div className="rounded-xl bg-canvas p-4 text-sm space-y-2">
              <div className="flex justify-between text-ink-700">
                <span>Product Amount (Items to refund):</span>
                <span className="font-semibold text-ink-900">{inr(calcProductTotal(refundItem))}</span>
              </div>
              <div className="flex justify-between text-ink-500 text-xs">
                <span>Delivery Charge:</span>
                <span>₹0.00 (Retained / Not refunded)</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-emerald-700">
                <span>Total Refund to Customer:</span>
                <span>{inr(calcProductTotal(refundItem))}</span>
              </div>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              Confirm to request a refund of <strong>{inr(calcProductTotal(refundItem))}</strong> via Razorpay. The return is marked refunded and stock is restored once Razorpay confirms processing.
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
              <Button variant="ghost" onClick={() => setRefundItem(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={actionBusy === 'refund'}
                onClick={handleProcessRefund}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm Refund ({inr(calcProductTotal(refundItem))})
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Read-Only Details Modal */}
      {detailItem && (
        <Modal open={Boolean(detailItem)} onClose={() => setDetailItem(null)} title={`Return Details: Order ${detailItem.order_number}`}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="text-xs text-ink-500 block">Status</span>
                <Badge tone={RETURN_STATUS[detailItem.status]?.tone}>{RETURN_STATUS[detailItem.status]?.label}</Badge>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-500 block">Product Refund</span>
                <span className="font-bold text-base text-ink-900">{inr(calcProductTotal(detailItem))}</span>
              </div>
            </div>

            {detailItem.razorpay_refund_id && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200">
                <strong>Razorpay Refund ID:</strong> {detailItem.razorpay_refund_id}
              </div>
            )}

            {detailItem.pickup_date && (
              <div className="rounded-lg bg-sand-100 p-3 text-xs text-ink-800">
                <strong>Scheduled Pickup Date:</strong> {formatDate(detailItem.pickup_date)}
              </div>
            )}

            <div>
              <span className="text-xs font-bold text-ink-500 uppercase block mb-1">Reason:</span>
              <p className="text-ink-900 font-medium">{detailItem.reason}</p>
              {detailItem.description && <p className="text-xs text-ink-600 mt-1 italic">"{detailItem.description}"</p>}
            </div>

            {detailItem.admin_note && (
              <div className="rounded-lg bg-sand-100 p-3 text-xs text-ink-800">
                <strong>Concierge Note:</strong> {detailItem.admin_note}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-line">
              <Button variant="ghost" onClick={() => setDetailItem(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
