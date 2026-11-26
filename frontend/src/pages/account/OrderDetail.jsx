import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Calendar, Check, Clock, Printer, Truck, RotateCcw, UploadCloud, Video, Image as ImageIcon, X, AlertCircle, CheckCircle2, ShieldAlert, Sparkles, PackageCheck } from 'lucide-react';
import api from '../../lib/api';
import { ORDER_STATUS, PAYMENT_STATUS, RETURN_STATUS, formatDate, img, inr } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { useShop } from '../../context/ShopContext';
import OrderSummary from '../../components/OrderSummary';
import InvoiceModal from '../../components/InvoiceModal';
import { Alert, Badge, Button, Modal, cx, usePageTitle } from '../../components/ui';
import { OrderSkeleton } from '../../components/Skeletons';

const STEPS = [
  { key: 'placed', label: 'Order placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_INDEX = {
  pending: 0,
  placed: 0,
  confirmed: 1,
  processing: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
};

/** Horizontal progress tracker (stacks vertically on small screens). */
function Tracker({ order }) {
  const reached = STATUS_INDEX[order.status] ?? 0;
  const dateFor = (key) => {
    const entry = order.history.find((h) => h.status === key);
    if (entry) return entry.created_at;
    if (key === 'placed') return order.created_at;
    if (key === 'confirmed' && (order.status === 'confirmed' || reached >= 1)) {
      const confEntry = order.history.find((h) => h.status === 'confirmed');
      return confEntry ? confEntry.created_at : (order.status !== 'placed' && order.status !== 'pending' ? order.created_at : null);
    }
    return null;
  };
  return (
    <ol className="grid gap-0 sm:grid-cols-5">
      {STEPS.map((step, i) => {
        const done = i <= reached;
        const current = i === reached;
        const date = dateFor(step.key);
        return (
          <li key={step.key} className="relative flex gap-4 pb-7 last:pb-0 sm:flex-col sm:gap-3 sm:pb-0" aria-current={current ? 'step' : undefined}>
            {i < STEPS.length - 1 && (
              <span aria-hidden className={cx('absolute top-9 left-[17px] h-[calc(100%-36px)] w-0.5 sm:top-[17px] sm:left-9 sm:h-0.5 sm:w-[calc(100%-36px)]', i < reached ? 'bg-brand-600' : 'bg-sand-200')} />
            )}
            <span className={cx('relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold', done ? 'border-brand-600 bg-brand-600 text-white' : 'border-sand-300 bg-white text-ink-300')}>
              {done ? <Check className="size-[18px]" aria-hidden /> : i + 1}
            </span>
            <div>
              <p className={cx('font-semibold', !done && 'text-ink-400')}>{step.label}</p>
              <p className="text-sm text-ink-500">{date ? formatDate(date, true) : done ? '' : 'Pending'}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const RETURN_STEPS = [
  { key: 'pending', label: 'Requested' },
  { key: 'pickup_scheduled', label: 'Pickup Scheduled' },
  { key: 'received', label: 'Inspected' },
  { key: 'refunded', label: 'Refund Completed' },
];

const RETURN_STATUS_INDEX = {
  pending: 0,
  approved: 0,
  pickup_scheduled: 1,
  received: 2,
  refunded: 3,
};

function ReturnTracker({ returnReq }) {
  const reached = RETURN_STATUS_INDEX[returnReq.status] ?? 0;
  const dateFor = (key) => {
    if (key === 'pending') return returnReq.created_at ? formatDate(returnReq.created_at) : null;
    if (key === 'pickup_scheduled') return returnReq.pickup_date ? formatDate(returnReq.pickup_date) : (returnReq.status === 'approved' ? 'Scheduling' : null);
    if (key === 'received') return returnReq.inspected_at ? formatDate(returnReq.inspected_at) : (reached >= 2 ? 'Passed' : null);
    if (key === 'refunded') return returnReq.refunded_at || returnReq.status === 'refunded' ? inr(returnReq.refunded_amount || returnReq.refund_amount) : null;
    return null;
  };

  return (
    <ol className="grid gap-0 sm:grid-cols-4">
      {RETURN_STEPS.map((step, i) => {
        const done = i <= reached;
        const current = i === reached;
        const date = dateFor(step.key);
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0 sm:flex-col sm:gap-3 sm:pb-0" aria-current={current ? 'step' : undefined}>
            {i < RETURN_STEPS.length - 1 && (
              <span
                aria-hidden
                className={cx(
                  'absolute top-8 left-[17px] h-[calc(100%-32px)] w-0.5 sm:top-[17px] sm:left-9 sm:h-0.5 sm:w-[calc(100%-36px)]',
                  i < reached ? 'bg-brand-600' : 'bg-sand-200'
                )}
              />
            )}
            <span
              className={cx(
                'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                done ? 'border-brand-600 bg-brand-600 text-white' : 'border-sand-300 bg-white text-ink-300'
              )}
            >
              {done ? <Check className="size-[18px]" aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cx('font-semibold text-sm leading-snug', !done && 'text-ink-400', current && 'text-brand-900 font-bold')}>
                {step.label}
              </p>
              <p className="text-xs text-ink-500 mt-0.5 tabular-nums">
                {date || (done ? 'Done' : 'Pending')}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const RETURN_REASONS = [
  'Damaged in transit / Broken seal',
  'Defective / Leaking container',
  'Wrong item or variant received',
  'Spoiled / Quality issue',
  'Expired product received',
  'Other issue with order',
];

function ReturnRequestModal({ order, remaining, open, onClose, onSuccess }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const requestKey = useRef(null);
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    if (order?.items && open) {
      requestKey.current = crypto.randomUUID();
      setSelectedItems(
        order.items.filter(i => remaining(i) > 0).map((i) => ({
          order_item_id: i.id,
          selected: true,
          quantity: remaining(i),
          price: Number(i.price),
          name: i.name,
          image: i.image,
          variant_label: i.variant_label,
        }))
      );
    }
  }, [order, open]);

  const toggleItem = (id) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.order_item_id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const activeItemsToReturn = selectedItems.filter((i) => i.selected && i.quantity > 0);
  const refundEstimate = activeItemsToReturn.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    if (files.length + selected.length > 4) {
      toast.error('You can upload a maximum of 4 files (photos or videos)');
      return;
    }
    const newFiles = [...files, ...selected];
    setFiles(newFiles);
    const newPreviews = selected.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
      name: file.name,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeItemsToReturn.length === 0) {
      return toast.error('Please select at least one item to return');
    }
    if (!reason) return toast.error('Please select a reason');
    if (files.length === 0) {
      return toast.error('Please attach at least one photo or video proof of the issue');
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      formData.append('requestKey', requestKey.current);
      formData.append('description', description);
      formData.append(
        'items',
        JSON.stringify(
          activeItemsToReturn.map((i) => ({
            order_item_id: i.order_item_id,
            quantity: i.quantity,
          }))
        )
      );
      files.forEach((file) => formData.append('attachments', file));

      const res = await api.post(`/orders/${order.order_number}/return`, formData);
      toast.success(res.message || 'Return request submitted successfully!');
      onSuccess(res.returnRequest);
    } catch (err) {
      toast.error(err.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Request Return & Refund (7-Day Policy)">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Item Selection for Return */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Select products to return (all available units) *
          </label>
          <div className="rounded-xl border border-sand-300 divide-y divide-sand-200 bg-sand-50/40 p-2 max-h-60 overflow-y-auto">
            {selectedItems.map((item) => (
              <div key={item.order_item_id} className="flex items-center gap-3 py-2 px-1">
                <input
                  type="checkbox"
                  id={`return-item-${item.order_item_id}`}
                  checked={item.selected}
                  onChange={() => toggleItem(item.order_item_id)}
                  className="size-4 rounded text-brand-600 focus:ring-brand-500 border-sand-300 cursor-pointer"
                />
                <img
                  src={img(item.image)}
                  alt=""
                  className="size-11 shrink-0 rounded-lg bg-sand-100 object-cover border border-sand-200"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <label htmlFor={`return-item-${item.order_item_id}`} className="font-medium text-ink-900 block truncate cursor-pointer">
                    {item.name}
                  </label>
                  {item.variant_label && (
                    <span className="text-ink-400 block text-[11px]">{item.variant_label}</span>
                  )}
                  <span className="text-ink-600 font-medium">{inr(item.price)} each</span>
                </div>
                {item.selected && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-ink-600">Qty {item.quantity}</span>
                    <span className="font-semibold text-xs tabular-nums text-ink-900 min-w-14 text-right">
                      {inr(item.price * item.quantity)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs border border-emerald-200">
            <span className="font-medium text-emerald-900">Estimated Refund for Selected Items:</span>
            <span className="font-bold text-sm text-emerald-950 tabular-nums">{inr(refundEstimate)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Reason for Return *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-sm font-medium text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          >
            {RETURN_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Describe the Problem (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us what went wrong with the product or package..."
            className="w-full rounded-xl border border-sand-300 bg-white p-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Attach Photo or Video Proof * (Max 4 files)
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFiles}
            multiple
            accept="image/*,video/*"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sand-300 p-4 text-center transition hover:border-brand-600 hover:bg-brand-50/30"
          >
            <UploadCloud className="size-7 text-brand-600 mb-1" />
            <p className="text-sm font-medium text-ink-800">Click to upload photos or unboxing video</p>
            <p className="text-xs text-ink-400 mt-0.5">Supports JPG, PNG, WEBP, MP4, WEBM (Up to 50MB)</p>
          </button>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              {previews.map((p, idx) => (
                <div key={idx} className="relative size-16 rounded-xl overflow-hidden border border-sand-300 bg-sand-100">
                  {p.isVideo ? (
                    <div className="size-full flex flex-col items-center justify-center bg-black/80 text-white">
                      <Video className="size-5 text-brand-400" />
                      <span className="text-[9px] truncate max-w-[55px] mt-0.5">{p.name}</span>
                    </div>
                  ) : (
                    <img src={p.url} alt="Proof" className="size-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-clay-600"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} className="bg-brand-700 hover:bg-brand-800 text-white">
            Submit Return ({inr(refundEstimate)})
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const toast = useToast();
  const { settings } = useShop();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [requests, setRequests] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const returnReq = requests?.find(r => r.id === selectedReturn) || requests?.[0];
  function remaining(item) {
    if (!requests) return 0;
    let count = item.quantity;
    for (const r of requests) {
      if (['cancelled','rejected'].includes(r.status)) continue;
      if (!r.items?.length) return 0;
      for (const line of r.items) if (line.order_item_id === item.id) count -= line.quantity;
    }
    return Math.max(0,count);
  }
  const [showReturnModal, setShowReturnModal] = useState(false);
  usePageTitle(`Order ${orderNumber}`);

  useEffect(() => {
    let current = true;
    setData(null);
    setError('');
    setRequests(null);
    setSelectedReturn(null);
    api.get(`/orders/${orderNumber}`).then(result => { if (current) setData(result); }).catch(err => { if (current) setError(err.message); });
    api.get(`/orders/${orderNumber}/return`).then(r => { if (current) setRequests(r.returnRequests || []); }).catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [orderNumber]);

  const [cancelReason, setCancelReason] = useState('');
  const [selectedCancelItems, setSelectedCancelItems] = useState([]);

  useEffect(() => {
    if (data?.order?.items && confirming) {
      setSelectedCancelItems(
        data.order.items.map((i) => ({
          order_item_id: i.id,
          product_id: i.product_id,
          variant_id: i.variant_id,
          name: i.name,
          variant_label: i.variant_label,
          image: i.image,
          price: Number(i.price),
          quantity: i.quantity,
          selected: true,
        }))
      );
    }
  }, [data?.order, confirming]);

  const toggleCancelItem = (id) => {
    setSelectedCancelItems((prev) =>
      prev.map((item) =>
        item.order_item_id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const activeCancelItems = selectedCancelItems.filter((i) => i.selected && i.quantity > 0);
  const totalCancelSelectedQty = activeCancelItems.reduce((s, i) => s + i.quantity, 0);
  const totalOrderQty = (data?.order?.items || []).reduce((s, i) => s + Number(i.quantity), 0);
  const isCancelPartial = totalCancelSelectedQty < totalOrderQty;
  const cancelRefundEstimate = isCancelPartial
    ? activeCancelItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    : Number(data?.order?.total || 0);

  const cancel = async () => {
    if (activeCancelItems.length === 0) {
      return toast.error('Please select at least one item to cancel');
    }
    setBusy(true);
    try {
      const res = await api.post(`/orders/${orderNumber}/cancel`, {
        reason: cancelReason,
        items: activeCancelItems.map((i) => ({
          orderItemId: i.order_item_id,
          productId: i.product_id,
          variantId: i.variant_id,
          quantity: i.quantity,
        })),
      });
      setData(res);
      toast.success(res.message || 'Cancellation request submitted');
      setConfirming(false);
      setCancelReason('');
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409) {
        const latest = await api.get(`/orders/${orderNumber}`).catch(() => null);
        if (latest) {
          setData(latest);
          if (!latest.canCancel) setConfirming(false);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Link to="/account/orders" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-900">
      <ArrowLeft className="size-4" aria-hidden /> All orders
    </Link>
  );

  if (error) return <>{back}<Alert>{error}</Alert></>;
  if (!data) return <>{back}<OrderSkeleton /></>;

  const { order, canCancel, canPay } = data;
  const allowCancellation = data?.allowCancellation !== false && settings?.allow_cancellation !== '0';
  const allowReturns = data?.allowReturns !== false && settings?.allow_returns !== '0';
  const status = ORDER_STATUS[order.status];
  const payment = PAYMENT_STATUS[order.payment_status];
  const paidAttempt = order.payments.find((p) => p.status === 'paid');
  const cancelled = order.status === 'cancelled';
  const displayHistory = cancelled
    ? (order.history.filter((h) => h.status === 'cancelled' || h.note?.toLowerCase().includes('cancel')).length > 0
        ? order.history.filter((h) => h.status === 'cancelled' || h.note?.toLowerCase().includes('cancel'))
        : [{ status: 'cancelled', note: 'Cancelled by customer', created_at: order.updated_at || order.created_at }])
    : order.history.map(h => h.note?.startsWith('Return request approved for:') && h.note.endsWith('Ready to schedule reverse pickup.') ? { ...h, note: 'Return reviewed. Awaiting pickup confirmation.' } : h);

  return (
    <section>
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium sm:text-3xl">Order {order.order_number}</h2>
          <p className="mt-1 text-ink-500">Placed on {formatDate(order.created_at, true)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status?.tone || 'gray'}>{status?.label || order.status}</Badge>
          <Badge tone={payment?.tone || 'gray'}>{order.payment_method === 'cod' && order.payment_status === 'pending' ? 'Pay on delivery' : (payment?.label || order.payment_status)}</Badge>
          <Button variant="outline" size="sm" onClick={() => setShowInvoice(true)} className="gap-1.5 ml-1">
            <Printer className="size-3.5" /> View &amp; Print Invoice
          </Button>
        </div>
      </div>

      {canPay && (
        <Alert tone="warn" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{order.payment_status === 'failed' ? 'Your last payment attempt did not go through.' : 'This order is waiting for payment.'} Your items are reserved.</span>
          <Link to={`/order/${order.order_number}`} className="btn btn-primary btn-sm shrink-0">Pay {inr(order.total)}</Link>
        </Alert>
      )}
      {cancelled && order.payment_status === 'paid' && (
        <Alert tone="info" className="mt-6">Your payment of {inr(order.total)} will be refunded within 7 business days.</Alert>
      )}
      {order.status === 'cancellation_requested' && (
        <Alert tone="warn" className="mt-6">
          <div className="space-y-2">
            <p className="font-semibold text-ink-900">{{processing:'Cancellation refund is being reconciled',pending:'Cancellation refund is pending',failed:'Cancellation refund needs store review'}[order.cancellation_items?.[0]?.refundAttempt?.status] || 'Cancellation requested (pending store approval)'}</p>
            <p className="text-sm">
              The order will update when the store completes the cancellation and any applicable payment refund.
            </p>
            {order.cancellation_items && order.cancellation_items.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-amber-950 mb-1">Item(s) to cancel:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {order.cancellation_items.map((ci, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/80 px-2.5 py-1 text-amber-950 font-medium">
                      {ci.name} × {ci.quantity} ({inr(ci.lineTotal ?? ((ci.price || 0) * ci.quantity))})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Alert>
      )}

      {!cancelled && order.status !== 'pending' && order.status !== 'cancellation_requested' && (
        <div className="card mt-6 p-5 sm:p-7">
          <Tracker order={order} />
          {order.tracking_number && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sand-100 px-4 py-3 text-[15px]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Truck className="size-[18px] text-brand-600" aria-hidden />
                <span className="text-ink-500">{order.courier || 'Courier'} tracking number:</span>
                <span className="font-semibold text-ink-900">{order.tracking_number}</span>
              </div>
              <a
                href={`https://shiprocket.co/tracking/${order.tracking_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline inline-flex items-center gap-1"
              >
                Track with courier →
              </a>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        {/* Main Column: Items + History & Returns Side-by-Side below */}
        <div className="space-y-6">
          <div className="card p-5 sm:p-7">
            <h3 className="font-sans text-lg font-semibold tracking-normal">Items</h3>
            <ul className="mt-3 divide-y divide-sand-200">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-4">
                  <img src={img(item.image)} alt="" className="aspect-[4/5] w-16 shrink-0 rounded-lg bg-sand-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    {item.slug ? (
                      <Link to={`/product/${item.slug}`} className="leading-snug font-medium hover:text-brand-600">{item.name}</Link>
                    ) : (
                      <p className="leading-snug font-medium">{item.name}</p>
                    )}
                    <p className="text-sm text-ink-500">{item.variant_label ? `${item.variant_label} · ` : ''}{inr(item.price)} × {item.quantity}</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{inr(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>

            {/* Cancelled & Refunded Items */}
            {(() => {
              const cancelledList = Array.isArray(order.cancelled_items)
                ? order.cancelled_items
                : (typeof order.cancelled_items === 'string' ? JSON.parse(order.cancelled_items || '[]') : []);
              if (!cancelledList.length && !(Number(order.cancelled_amount) > 0)) return null;

              return (
                <div className="mt-4 pt-4 border-t border-sand-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-500 flex items-center gap-1.5">
                      <Ban className="size-3.5 text-clay-500" /> Cancelled Item(s)
                    </span>
                    <span className="text-[11px] font-semibold text-clay-700 bg-clay-50 border border-clay-200 rounded-full px-2 py-0.5">
                      Refunded to payment method
                    </span>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-sand-50/40 divide-y divide-sand-200 overflow-hidden text-xs">
                    {cancelledList.map((ci, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {ci.image && <img src={img(ci.image)} alt="" className="size-11 rounded-lg object-cover border border-sand-200 shrink-0 opacity-70" />}
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-700 line-through truncate">{ci.name}</p>
                            {ci.variantLabel && <p className="text-[11px] text-ink-400">{ci.variantLabel}</p>}
                            <span className="text-[11px] text-emerald-700 font-medium">✓ Refund of {inr(ci.lineTotal ?? ((ci.price || 0) * ci.quantity))} completed</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs text-ink-400">Qty: {ci.quantity}</span>
                          <p className="font-bold text-clay-600 text-sm tabular-nums">− {inr(ci.lineTotal ?? ((ci.price || 0) * ci.quantity))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <OrderSummary
              className="mt-2 border-t border-sand-200 pt-5"
              subtotal={order.subtotal}
              discount={order.discount}
              couponCode={order.coupon_code}
              shipping={order.shipping_fee}
              total={order.total}
              cancelledAmount={order.cancelled_amount}
            />
          </div>

          {/* Return & Refund Status Card (Full width for clean, spacious presentation) */}
          {requests?.length > 1 && (
            <label>Return request <select value={returnReq.id} onChange={e => setSelectedReturn(Number(e.target.value))}>
              {requests.map(r => <option key={r.id} value={r.id}>#{r.id} ? {r.status}</option>)}
            </select></label>
          )}
          {returnReq && (
            <div className="card p-6 sm:p-7 border-brand-200/90 shadow-soft">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-sand-200 pb-4">
                <div>
                  <h3 className="font-sans text-lg font-semibold tracking-normal text-ink-900 flex items-center gap-2">
                    <RotateCcw className="size-5 text-brand-600" /> Return &amp; Refund Status
                  </h3>
                  <p className="text-xs text-ink-500 mt-1">
                    Return Request #{returnReq.id} · Order {order.order_number}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={RETURN_STATUS[returnReq.status]?.tone || 'gray'} className="px-3 py-1 text-xs font-semibold">
                    {RETURN_STATUS[returnReq.status]?.label || returnReq.status}
                  </Badge>
                </div>
              </div>

              {/* Return Stepper Tracker (if not rejected) */}
              {returnReq.status !== 'rejected' && (
                <div className="mb-6 rounded-2xl bg-sand-50/80 p-5 sm:p-6 border border-sand-200/80">
                  <ReturnTracker returnReq={returnReq} />
                </div>
              )}

              {/* Stage-Specific Informative Hero Banner */}
              <div className="mb-6">
                {['pending', 'approved'].includes(returnReq.status) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
                        <Clock className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-base text-amber-950">Return Proof Under Review</h4>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          Our hill concierge team is reviewing your return reason and attached media proof. Once verified, reverse pickup will be scheduled.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {returnReq.status === 'pickup_scheduled' && (
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/80 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                          <Truck className="size-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-base text-purple-950">Return approved and pickup scheduled</h4>
                          <p className="text-xs text-purple-900 leading-relaxed">
                            Our courier partner will visit your delivery address to collect the returned package.
                          </p>
                          <p className="text-xs text-purple-800 pt-1">
                            💡 <strong>Packaging:</strong> Please keep the returned product securely packed in its original box ready for handover.
                          </p>
                        </div>
                      </div>
                      {returnReq.pickup_date && (
                        <div className="rounded-xl border border-purple-200 bg-white/90 px-3.5 py-2 text-right shrink-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-purple-600">Scheduled Date</span>
                          <span className="font-semibold text-sm text-purple-950">{formatDate(returnReq.pickup_date)}</span>
                        </div>
                      )}
                    </div>
                    {returnReq.shiprocket_return_order_id && (
                      <div className="mt-3 pt-3 border-t border-purple-200/80 text-xs text-purple-800 font-mono">
                        Shiprocket Reverse Return ID: #{returnReq.shiprocket_return_order_id}
                      </div>
                    )}
                  </div>
                )}

                {returnReq.status === 'received' && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
                        <PackageCheck className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-base text-amber-950">Package Arrived at Warehouse</h4>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          Your returned package has reached our Nilgiri warehouse. Our team is physically inspecting the items. As soon as inspection is complete, your refund will be credited.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {returnReq.status === 'refunded' && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                          <Sparkles className="size-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-base text-emerald-950">Refund Completed</h4>
                          <p className="text-xs text-emerald-800">
                            The product amount has been credited back to your original payment method.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700">Refund Amount</span>
                        <span className="font-display text-2xl font-bold text-emerald-900 tabular-nums">
                          {inr(returnReq.refunded_amount || returnReq.refund_amount)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-emerald-800">
                        Funds typically reflect in your bank account within 3–5 business days.
                      </span>
                      {returnReq.razorpay_refund_id && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white/90 px-2.5 py-1 font-mono text-[11px] text-emerald-900 font-medium">
                          Razorpay Ref: {returnReq.razorpay_refund_id}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {returnReq.status === 'refund_initiated' && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                          <Clock className="size-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-base text-blue-950">Refund Initiated via Razorpay</h4>
                          <p className="text-xs text-blue-800">
                            Our team approved your refund. Razorpay is processing the credit back to your original payment method.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-blue-700">Refund Amount</span>
                        <span className="font-display text-2xl font-bold text-blue-900 tabular-nums">
                          {inr(returnReq.refund_amount)}
                        </span>
                      </div>
                    </div>
                    {returnReq.razorpay_refund_id && (
                      <div className="mt-4 pt-3.5 border-t border-blue-200/80 text-xs text-blue-800">
                        Razorpay Refund ID: <span className="font-mono">{returnReq.razorpay_refund_id}</span> · Takes 3–5 business days to reflect in bank.
                      </div>
                    )}
                  </div>
                )}

                {returnReq.status === 'refund_failed' && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs">
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
                        <Clock className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-base text-amber-950">Refund Processing Update</h4>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          Your returned items were inspected and approved for a refund of <strong>{inr(returnReq.refund_amount)}</strong>. Our team is finalizing the bank transfer. You do not need to take any action.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {returnReq.status === 'cancelled' && (
                  <div className="rounded-2xl border border-sand-300 bg-sand-50/80 p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sand-400 text-white shadow-xs">
                        <X className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-base text-ink-900">Return Request Cancelled</h4>
                        <p className="text-xs text-ink-600">
                          You cancelled this return request. Your order remains completed and no further action will be taken.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {returnReq.status === 'rejected' && (
                  <div className="rounded-2xl border border-clay-200 bg-clay-50/80 p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-clay-600 text-white shadow-xs">
                        <AlertCircle className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-base text-clay-950">Return Request Declined</h4>
                        <p className="text-xs text-clay-900">
                          {returnReq.admin_note || 'The submitted proof did not meet our return policy criteria.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2-Column Grid: Returned Products & Proof Details */}
              <div className="grid gap-6 border-t border-sand-200 pt-5 sm:grid-cols-2">
                {/* Column 1: Returned Products */}
                {(() => {
                  const reqItems = (returnReq.items && returnReq.items.length) ? returnReq.items : (order.items || []);
                  return (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2.5">
                        Returned Product{reqItems.length > 1 ? 's' : ''} ({reqItems.length})
                      </h4>
                      {reqItems.length > 0 ? (
                        <div className="rounded-xl border border-sand-200 divide-y divide-sand-100 bg-sand-50/50 p-2 text-xs">
                          {reqItems.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 px-1 first:pt-1 last:pb-1">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {it.image && (
                                  <img src={img(it.image)} alt="" className="size-9 rounded-lg bg-sand-100 object-cover shrink-0 border border-sand-200" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-ink-900 truncate">{it.name}</p>
                                  {it.variant_label && <p className="text-[11px] text-ink-400">{it.variant_label}</p>}
                                </div>
                              </div>
                              <span className="font-bold text-ink-800 shrink-0 ml-2 tabular-nums">
                                {inr(it.price || it.line_total)} × {it.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-400 italic">Product details not specified.</p>
                      )}
                    </div>
                  );
                })()}

                {/* Column 2: Reason, Note & Media Proofs */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-1">Return Reason</h4>
                    <p className="text-sm font-medium text-ink-900">{returnReq.reason}</p>
                    {returnReq.description && (
                      <div className="mt-1.5 rounded-lg border border-sand-200 bg-sand-50 p-2.5 text-xs text-ink-700 italic">
                        "{returnReq.description}"
                      </div>
                    )}
                  </div>

                  {returnReq.attachments?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                        Attached Proof ({returnReq.attachments.length} file{returnReq.attachments.length > 1 ? 's' : ''})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {returnReq.attachments.map((att, idx) => (
                          att.type === 'video' || att.url?.endsWith('.mp4') || att.url?.endsWith('.webm') ? (
                            <div key={idx} className="relative rounded-lg overflow-hidden border border-sand-300 bg-black">
                              <video src={img(att.url)} controls className="h-20 w-32 object-cover" />
                            </div>
                          ) : (
                            <a key={idx} href={img(att.url)} target="_blank" rel="noreferrer" className="group relative block size-16 overflow-hidden rounded-lg border border-sand-300 hover:border-brand-600 transition-colors">
                              <img src={img(att.url)} alt="Proof" className="size-full object-cover group-hover:scale-105 transition-transform" />
                            </a>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Delivery, Payment & Order Actions */}
        <div className="space-y-6">
          <div className="card p-5 text-[15px]">
            <h3 className="mb-2 font-sans text-sm font-semibold tracking-wider text-ink-400 uppercase">Billing address</h3>
            <p className="font-medium">{order.bill_name || order.customer_name}</p>
            <p className="leading-relaxed text-ink-500">
              {order.bill_line1 ? (
                <>
                  {order.bill_line1}{order.bill_line2 ? `, ${order.bill_line2}` : ''}<br />
                  {order.bill_city}, {order.bill_state} – {order.bill_pincode}{order.bill_country ? `, ${order.bill_country}` : ''}
                </>
              ) : (
                <>
                  {order.ship_line1}{order.ship_line2 ? `, ${order.ship_line2}` : ''}<br />
                  {order.ship_city}, {order.ship_state} – {order.ship_pincode}{order.ship_country ? `, ${order.ship_country}` : ''}
                </>
              )}
              <br />Phone: {order.bill_phone || order.ship_phone}
            </p>
          </div>

          <div className="card p-5 text-[15px]">
            <h3 className="mb-2 font-sans text-sm font-semibold tracking-wider text-ink-400 uppercase">Delivery address</h3>
            <p className="font-medium">{order.ship_name}</p>
            <p className="leading-relaxed text-ink-500">{order.ship_line1}{order.ship_line2 ? `, ${order.ship_line2}` : ''}<br />{order.ship_city}, {order.ship_state} – {order.ship_pincode}{order.ship_country ? `, ${order.ship_country}` : ''}<br />Phone: {order.ship_phone}</p>
            {order.notes && <p className="mt-3 border-t border-sand-200 pt-3 text-ink-500"><span className="font-medium text-ink-900">Your note:</span> {order.notes}</p>}
          </div>

          <div className="card p-5 text-[15px]">
            <h3 className="mb-2 font-sans text-sm font-semibold tracking-wider text-ink-400 uppercase">Payment</h3>
            <p className="font-medium">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online payment'}</p>
            <p className="text-ink-500">Status: {payment?.label || order.payment_status}</p>
            {paidAttempt && (
              <>
                <p className="break-all text-ink-500">Transaction ID: {paidAttempt.gateway_payment_id}</p>
                <p className="text-ink-500">Paid on {formatDate(paidAttempt.updated_at, true)}</p>
              </>
            )}
          </div>

          {/* Request Return Button (7-Day Policy) */}
          {allowReturns && (() => {
            const deliveredEntry = order.history?.find((h) => h.status === 'delivered');
            const deliveredTime = deliveredEntry?.created_at ? new Date(deliveredEntry.created_at).getTime() : null;
            const isReturnWindowValid = deliveredTime && (Date.now() - deliveredTime <= 7 * 24 * 60 * 60 * 1000);

            if (!order.items.some(i => remaining(i) > 0) || order.status !== 'delivered') {
              return null;
            }

            return (
              <div className="space-y-1.5 pt-1">
                {isReturnWindowValid ? (
                  <>
                    <Button
                      variant="outline"
                      className="w-full text-brand-700 border-brand-300 hover:border-brand-600 hover:bg-brand-50"
                      onClick={() => setShowReturnModal(true)}
                    >
                      <RotateCcw className="size-4 mr-1.5" /> Request Return / Refund
                    </Button>
                    <p className="text-center text-xs text-ink-400">Within 7 days of delivery</p>
                  </>
                ) : (
                  <div className="rounded-xl bg-sand-100/60 p-3 text-center text-xs text-ink-500">
                    The 7-day return period has ended for this order.
                  </div>
                )}
              </div>
            );
          })()}

          {allowCancellation && canCancel && (
            <div className="space-y-1.5 pt-1">
              <Button variant="outline" className="w-full text-clay-600 hover:border-clay-600" onClick={() => setConfirming(true)}>
                Cancel order
              </Button>
              <p className="text-center text-xs text-ink-400">Available before confirmation and within 24 hours of placement</p>
            </div>
          )}
          {allowCancellation && data?.isExpiredCancel && !cancelled && order.status !== 'cancellation_requested' && (
            <div className="rounded-xl bg-sand-100/60 p-3 text-center text-xs text-ink-500">
              Cancellation is only available within 24 hours of placing the order.
            </div>
          )}
        </div>
      </div>

      <InvoiceModal order={order} open={showInvoice} onClose={() => setShowInvoice(false)} />

      {/* Return Request Modal */}
      <ReturnRequestModal
        remaining={remaining}
        order={order}
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onSuccess={(created) => {
          setRequests(previous => [created,...(previous || [])]);
          setSelectedReturn(created.id);
          setShowReturnModal(false);
        }}
      />

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Cancel this order?">
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            You can request cancellation of order <strong className="text-ink-900">{order.order_number}</strong> before confirmation and within 24 hours of placement.
            Select the item(s) you wish to cancel. Upon approval by our store admin, your refund of {inr(cancelRefundEstimate)} will be credited back to your account.
          </p>

          {/* Item selection for cancellation */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              {canPay ? 'Cancel all items in this unpaid order' : 'Select products to cancel (all units)'}
            </label>
            <div className="rounded-xl border border-sand-300 divide-y divide-sand-200 bg-sand-50/40 p-2 max-h-52 overflow-y-auto">
              {selectedCancelItems.map((item) => (
                <div key={item.order_item_id} className="flex items-center gap-3 py-2 px-1">
                  <input
                    type="checkbox"
                    id={`cancel-item-${item.order_item_id}`}
                    checked={item.selected}
                    disabled={canPay}
                    onChange={() => toggleCancelItem(item.order_item_id)}
                    className="size-4 rounded text-clay-600 focus:ring-clay-500 border-sand-300 cursor-pointer"
                  />
                  <img
                    src={img(item.image)}
                    alt=""
                    className="size-10 shrink-0 rounded-lg bg-sand-100 object-cover border border-sand-200"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <label htmlFor={`cancel-item-${item.order_item_id}`} className="font-medium text-ink-900 block truncate cursor-pointer">
                      {item.name}
                    </label>
                    {item.variant_label && (
                      <span className="text-ink-400 block text-[11px]">{item.variant_label}</span>
                    )}
                    <span className="text-ink-600 font-medium">{inr(item.price)} each</span>
                  </div>
                  {item.selected && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-ink-600">Qty {item.quantity}</span>
                      <span className="font-semibold text-xs tabular-nums text-ink-900 min-w-14 text-right">
                        {inr(item.price * item.quantity)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs border border-amber-200">
              <span className="font-medium text-amber-900">Total Refund Amount:</span>
              <span className="font-bold text-sm text-amber-950 tabular-nums">{inr(cancelRefundEstimate)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Reason for Cancellation (Optional)
            </label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Changed my mind / placed duplicate order"
              maxLength={250}
              className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setConfirming(false)}>Keep order</Button>
          <Button onClick={cancel} loading={busy} className="bg-clay-600 hover:bg-[#9c3525]">
            Submit cancellation ({inr(cancelRefundEstimate)})
          </Button>
        </div>
      </Modal>
    </section>
  );
}
