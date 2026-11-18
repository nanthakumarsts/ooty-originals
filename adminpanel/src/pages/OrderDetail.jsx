import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, CircleCheck, Clock, CreditCard, Mail, PackageCheck, PackageOpen, Phone, Printer, Truck, XCircle, RotateCcw } from 'lucide-react';
import api from '../lib/api';
import { ORDER_STATUS, PAYMENT_STATUS, formatDate, img, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import InvoiceModal from '../components/InvoiceModal';
import { Alert, Badge, Button, Confirm, Field, PageHeader, Select, PageSkeleton, Toggle, cx, usePageTitle } from '../components/ui';

const STEPS = [
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Packing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];
const REACHED = { pending: 0, confirmed: 1, processing: 2, shipped: 3, delivered: 4 };

/** Where the order is on its way from "placed" to "delivered". */
function Progress({ order }) {
  const reached = REACHED[order.status] ?? 0;
  const when = (key) => (key === 'placed' ? order.created_at : order.history.find((h) => h.status === key)?.created_at);
  return (
    <ol className="grid grid-cols-5">
      {STEPS.map((step, i) => {
        const done = i <= reached;
        const date = when(step.key);
        return (
          <li key={step.key} className="relative flex flex-col items-center text-center" aria-current={i === reached ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className={cx('absolute top-[15px] right-1/2 h-0.5 w-full', i <= reached ? 'bg-brand-600' : 'bg-line-strong')} />}
            <span className={cx('relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold', done ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink-300')}>
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cx('mt-2 text-[13px] font-semibold sm:text-sm', !done && 'text-ink-400')}>{step.label}</span>
            <span className="hidden text-[12px] text-ink-500 sm:block">{date ? formatDate(date, true) : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** How one history entry is shown in the timeline. */
function describe(entry) {
  const note = entry.note || '';
  if (/^Payment received/i.test(note)) return { icon: CreditCard, tone: 'green', title: 'Payment received', text: note.replace(/^Payment received\s*/i, '').replace(/^\(|\)$/g, '') };
  if (/^Payment not completed/i.test(note)) return { icon: XCircle, tone: 'red', title: 'Payment attempt failed', text: note.replace(/^Payment not completed:\s*/i, '') };
  if (/^Payment marked as/i.test(note)) return { icon: CreditCard, tone: 'gray', title: note };
  if (/^Tracking updated/i.test(note)) return { icon: Truck, tone: 'gray', title: 'Tracking details updated', text: note.replace(/^Tracking updated:\s*/i, '') };
  const byStatus = {
    pending: { icon: Clock, tone: 'amber', title: 'Order placed' },
    confirmed: { icon: CircleCheck, tone: 'green', title: 'Order confirmed' },
    processing: { icon: PackageOpen, tone: 'blue', title: 'Packing started' },
    shipped: { icon: Truck, tone: 'violet', title: 'Shipped' },
    delivered: { icon: PackageCheck, tone: 'green', title: 'Delivered' },
    cancelled: { icon: Ban, tone: 'red', title: 'Order cancelled' },
  };
  return { ...(byStatus[entry.status] || { icon: Clock, tone: 'gray', title: entry.status }), text: note };
}

const TONE = {
  green: 'bg-brand-50 text-brand-600',
  amber: 'bg-[#fdf6e7] text-[#7a5510]',
  blue: 'bg-[#edf4fb] text-[#1f4f82]',
  violet: 'bg-[#f3effa] text-[#54398f]',
  red: 'bg-clay-50 text-clay-600',
  gray: 'bg-canvas text-ink-500',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { toast } = useApp();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [ship, setShip] = useState({ courier: '', tracking_number: '' });
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [syncingSr, setSyncingSr] = useState(false);
  const [returnReq, setReturnReq] = useState(null);
  const [returnAdminNote, setReturnAdminNote] = useState('');
  const [returnActionBusy, setReturnActionBusy] = useState('');
  const [confirmApproveModal, setConfirmApproveModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  usePageTitle(order ? `Order ${order.order_number}` : 'Order');

  const apply = (o) => {
    setOrder(o);
    setShip({ courier: o.courier || '', tracking_number: o.tracking_number || '' });
    setManual(o.status);
    setNote('');
  };

  const handleSyncShiprocket = async () => {
    setSyncingSr(true);
    try {
      const res = await api.post(`/orders/${id}/shiprocket-sync`);
      apply(res.order);
      toast.success(`Pushed to Shiprocket! (Shipment ID: ${res.shiprocket?.shipment_id || res.order?.shiprocket_shipment_id || res.shiprocket?.order_id})`);
    } catch (err) {
      toast.error(err.message || 'Failed to push order to Shiprocket');
    } finally {
      setSyncingSr(false);
    }
  };

  const handleApproveReturn = async () => {
    setReturnActionBusy('approve');
    try {
      const res = await api.post(`/orders/${id}/return/approve`, { adminNote: returnAdminNote });
      apply(res.order);
      setReturnReq(res.returnRequest);
      setConfirmApproveModal(false);
      setReturnAdminNote('');
      toast.success(res.message || 'Return approved, refund processed, and reverse pickup booked!');
    } catch (err) {
      toast.error(err.message || 'Failed to approve return');
    } finally {
      setReturnActionBusy('');
    }
  };

  const handleRejectReturn = async () => {
    if (!returnAdminNote.trim()) {
      return toast.error('Please enter a reason for rejecting the return');
    }
    setReturnActionBusy('reject');
    try {
      const res = await api.post(`/orders/${id}/return/reject`, { adminNote: returnAdminNote });
      apply(res.order);
      setReturnReq(res.returnRequest);
      setRejectModal(false);
      setReturnAdminNote('');
      toast.success(res.message || 'Return request declined');
    } catch (err) {
      toast.error(err.message || 'Failed to decline return');
    } finally {
      setReturnActionBusy('');
    }
  };

  useEffect(() => {
    setOrder(null);
    setReturnReq(null);
    setError('');
    api.get(`/orders/${id}`).then((d) => apply(d.order)).catch((err) => setError(err.message));
    api.get(`/orders/${id}/return`).then((d) => setReturnReq(d.returnRequest)).catch(() => {});
  }, [id]);

  const back = <Link to="/orders" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 print:hidden"><ArrowLeft className="size-4" aria-hidden /> Orders</Link>;
  if (error) return <>{back}<Alert>{error}</Alert></>;
  if (!order) return <PageSkeleton />;

  const cancelled = order.status === 'cancelled';
  const unpaidOnline = order.status === 'pending' && order.payment_method === 'online';

  /** Move the order to a status (optionally with courier details / a note). */
  const move = async (status, extra = {}) => {
    setBusy(status);
    try {
      const updated = (await api.patch(`/orders/${id}/status`, { status, note, notify, ...extra })).order;
      const changed = updated.status !== order.status;
      apply(updated);
      toast.success(changed ? `Order is now “${ORDER_STATUS[updated.status].label}”${notify ? ' — customer emailed' : ''}` : 'Order updated');
      setCancelling(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const setPayment = async (payment_status) => {
    try {
      apply((await api.patch(`/orders/${id}/payment`, { payment_status })).order);
      toast.success('Payment status updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  /** Customer paid some other way (bank transfer, cash): record it and confirm the order. */
  const confirmPaid = async () => {
    setBusy('confirmed');
    try {
      await api.patch(`/orders/${id}/payment`, { payment_status: 'paid' });
      const updated = (await api.patch(`/orders/${id}/status`, { status: 'confirmed', note: note || 'Payment confirmed by the store', notify })).order;
      apply(updated);
      toast.success('Marked as paid and confirmed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const shipNow = (e) => {
    e.preventDefault();
    return move('shipped', { courier: ship.courier.trim(), tracking_number: ship.tracking_number.trim() });
  };

  const timeline = [...order.history].reverse();

  return (
    <>
      <PageHeader title={`Order ${order.order_number}`} description={`Placed ${formatDate(order.created_at, true)} · ${order.items.length} ${order.items.length === 1 ? 'product' : 'products'} · ${inr(order.total)}`} back={back}>
        <Badge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Badge>
        <Badge tone={PAYMENT_STATUS[order.payment_status].tone}>{order.payment_method === 'cod' && order.payment_status === 'pending' ? 'Cash on delivery' : `Payment: ${PAYMENT_STATUS[order.payment_status].label}`}</Badge>
        <Button variant="outline" size="sm" onClick={() => setShowInvoice(true)} className="print:hidden"><Printer className="size-4" aria-hidden /> Tax Invoice</Button>
      </PageHeader>

      <InvoiceModal order={order} open={showInvoice} onClose={() => setShowInvoice(false)} />

      {/* Where the order is */}
      <section className="card mb-5 p-5">
        {cancelled ? (
          <div className="flex items-start gap-3 text-clay-600">
            <Ban className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">This order was cancelled</p>
              <p className="text-sm text-ink-500">Its items are back in stock. A cancelled order cannot be reopened.{order.payment_status === 'paid' && ' The customer has paid — remember to refund them, then set the payment status to “Refunded”.'}</p>
            </div>
          </div>
        ) : (
          <Progress order={order} />
        )}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* The one thing to do next */}
          {!cancelled && (
            <section className="card border-brand-200 p-5 print:hidden" id="next">
              <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">Next step</p>

              {unpaidOnline && (
                <>
                  <h2 className="mt-1 text-xl font-medium">Waiting for the customer to pay</h2>
                  <p className="mt-1 text-sm text-ink-500">Nothing to pack yet. The order confirms itself when the online payment succeeds, and is cancelled automatically if it stays unpaid for 30 minutes. If the customer paid you another way, confirm it here.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={confirmPaid} loading={busy === 'confirmed'}><CircleCheck className="size-4" aria-hidden /> Mark as paid &amp; confirm</Button>
                  </div>
                </>
              )}
              {order.status === 'pending' && !unpaidOnline && (
                <>
                  <h2 className="mt-1 text-xl font-medium">Confirm this order</h2>
                  <div className="mt-4"><Button onClick={() => move('confirmed')} loading={busy === 'confirmed'}><CircleCheck className="size-4" aria-hidden /> Confirm order</Button></div>
                </>
              )}
              {order.status === 'confirmed' && (
                <>
                  <h2 className="mt-1 text-xl font-medium">Pack this order</h2>
                  <p className="mt-1 text-sm text-ink-500">{order.payment_method === 'cod' ? `Cash on delivery — collect ${inr(order.total)} at the door.` : 'Paid online — ready to pack.'}</p>
                  <div className="mt-4"><Button onClick={() => move('processing')} loading={busy === 'processing'}><PackageOpen className="size-4" aria-hidden /> Start packing</Button></div>
                </>
              )}
              {order.status === 'processing' && (
                <form onSubmit={shipNow} noValidate>
                  <h2 className="mt-1 text-xl font-medium">Hand over to the courier</h2>
                  <p className="mt-1 text-sm text-ink-500">Add the courier details — they are emailed to the customer and shown in their order page.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Courier (optional)" value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} placeholder="e.g. DTDC, Delhivery" maxLength={80} />
                    <Field label="Tracking number (optional)" value={ship.tracking_number} onChange={(e) => setShip({ ...ship, tracking_number: e.target.value })} placeholder="e.g. AWB12345678" maxLength={80} />
                  </div>
                  <div className="mt-4"><Button type="submit" loading={busy === 'shipped'}><Truck className="size-4" aria-hidden /> Mark as shipped</Button></div>
                </form>
              )}
              {order.status === 'shipped' && (
                <>
                  <h2 className="mt-1 text-xl font-medium">Out for delivery</h2>
                  <p className="mt-1 text-sm text-ink-500">{order.courier ? `${order.courier} · ` : ''}Tracking {order.tracking_number || 'not added'}.{order.payment_method === 'cod' && order.payment_status !== 'paid' ? ' Marking it delivered also records the cash as received.' : ''}</p>
                  <div className="mt-4"><Button onClick={() => move('delivered')} loading={busy === 'delivered'}><PackageCheck className="size-4" aria-hidden /> Mark as delivered</Button></div>
                </>
              )}
              {order.status === 'delivered' && (
                <>
                  <h2 className="mt-1 flex items-center gap-2 text-xl font-medium"><CircleCheck className="size-5 text-brand-600" aria-hidden /> Completed</h2>
                  <p className="mt-1 text-sm text-ink-500">This order has been delivered. Nothing more to do.</p>
                </>
              )}

              {order.status !== 'delivered' && (
                <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={250} placeholder="Included in the email and the order history" />
                  <div className="sm:w-56 sm:pb-2"><Toggle label="Email the customer" checked={notify} onChange={setNotify} /></div>
                </div>
              )}

              <details className="mt-4 border-t border-line pt-3 text-sm">
                <summary className="inline-flex min-h-9 items-center font-medium text-ink-500 hover:text-ink-900">More actions</summary>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <span className="label">Set the stage by hand</span>
                    <div className="flex gap-2">
                      <Select label="Stage" value={manual} onChange={setManual} options={Object.entries(ORDER_STATUS).filter(([value]) => value !== 'cancelled').map(([value, s]) => [value, s.label])} className="w-48" />
                      <Button variant="outline" disabled={manual === order.status} loading={!!busy && busy === manual} onClick={() => move(manual, manual === 'shipped' ? { courier: ship.courier, tracking_number: ship.tracking_number } : {})}>Apply</Button>
                    </div>
                  </div>
                  {order.status !== 'delivered' && (
                    <Button variant="outline" onClick={() => setCancelling(true)} className="text-clay-600 hover:border-clay-600 hover:bg-clay-50"><Ban className="size-4" aria-hidden /> Cancel order</Button>
                  )}
                </div>
              </details>
            </section>
          )}

          {/* Return & Refund Request Card */}
          {returnReq && (
            <section className="card border-clay-300 p-5 shadow-sm bg-clay-50/10">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <RotateCcw className="size-5 text-clay-600" />
                  <h2 className="text-lg font-semibold text-ink-900">Return &amp; Refund Request</h2>
                </div>
                <Badge tone={returnReq.status === 'approved' ? 'green' : returnReq.status === 'rejected' ? 'red' : 'amber'}>
                  {returnReq.status === 'approved' ? 'Approved & Refunded' : returnReq.status === 'rejected' ? 'Declined' : 'Pending Review'}
                </Badge>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400">Customer Reason</span>
                  <p className="mt-1 text-sm font-semibold text-ink-900">{returnReq.reason}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400">Requested Date</span>
                  <p className="mt-1 text-sm text-ink-700">{formatDate(returnReq.created_at, true)}</p>
                </div>
              </div>

              {returnReq.description && (
                <div className="mt-3 rounded-lg bg-canvas p-3 border border-line">
                  <span className="text-xs font-semibold text-ink-400">Customer Description:</span>
                  <p className="mt-1 text-sm text-ink-700 leading-relaxed">"{returnReq.description}"</p>
                </div>
              )}

              {/* Attachments (Photos & Videos) */}
              {returnReq.attachments?.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-semibold uppercase text-ink-400">Attached Proof ({returnReq.attachments.length} files)</span>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {returnReq.attachments.map((att, idx) => {
                      const isVideo = att.type === 'video' || att.url?.endsWith('.mp4') || att.url?.endsWith('.webm');
                      return isVideo ? (
                        <div key={idx} className="relative rounded-xl overflow-hidden border border-line bg-black shadow-sm">
                          <video src={img(att.url)} controls className="h-32 w-52 object-cover" />
                          <span className="absolute top-1.5 left-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">Video Proof</span>
                        </div>
                      ) : (
                        <a key={idx} href={img(att.url)} target="_blank" rel="noreferrer" className="group relative block size-24 overflow-hidden rounded-xl border border-line bg-canvas hover:border-brand-600 shadow-sm transition">
                          <img src={img(att.url)} alt="Proof attachment" className="size-full object-cover group-hover:scale-105 transition-transform" />
                          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 font-medium">View Full</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons for Pending Return */}
              {returnReq.status === 'pending' && (
                <div className="mt-5 pt-4 border-t border-line">
                  <Field
                    label="Admin Note / Instructions (Included in customer email)"
                    value={returnAdminNote}
                    onChange={(e) => setReturnAdminNote(e.target.value)}
                    placeholder="e.g. Return approved. Please pack goods safely for reverse pickup."
                    maxLength={300}
                  />

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={() => setConfirmApproveModal(true)}
                      className="bg-brand-600 hover:bg-brand-700 text-white"
                    >
                      <CircleCheck className="size-4" /> Approve Return &amp; Refund ({inr(order.total)})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejectModal(true)}
                      className="text-clay-600 hover:border-clay-600 hover:bg-clay-50"
                    >
                      <Ban className="size-4" /> Decline Return Request
                    </Button>
                  </div>
                </div>
              )}

              {/* Approved Details */}
              {returnReq.status === 'approved' && (
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-1.5">
                  <p className="font-semibold text-sm text-emerald-950 flex items-center gap-1.5">
                    <CircleCheck className="size-4 text-emerald-700" /> Return Approved &amp; Refunded
                  </p>
                  <p><strong>Refund Amount:</strong> {inr(returnReq.refund_amount || order.total)}</p>
                  {returnReq.razorpay_refund_id && (
                    <p><strong>Razorpay Refund ID:</strong> <span className="font-mono">{returnReq.razorpay_refund_id}</span></p>
                  )}
                  {returnReq.shiprocket_return_order_id && (
                    <p><strong>Shiprocket Reverse Pickup Order:</strong> <span className="font-mono">#{returnReq.shiprocket_return_order_id}</span></p>
                  )}
                  {returnReq.admin_note && (
                    <p className="pt-1 text-emerald-800">Note: {returnReq.admin_note}</p>
                  )}
                </div>
              )}

              {/* Rejected Details */}
              {returnReq.status === 'rejected' && (
                <div className="mt-4 rounded-xl bg-clay-50 border border-clay-200 p-3.5 text-xs text-clay-800">
                  <p className="font-semibold text-sm text-clay-900">Return Request Declined</p>
                  <p className="mt-1">Reason: {returnReq.admin_note || 'Declined'}</p>
                </div>
              )}
            </section>
          )}

          <section className="card overflow-hidden">
            <h2 className="card-title p-5 pb-3">Items to pack</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Product</th><th className="text-right">Price</th><th className="text-right">Qty</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex min-w-52 items-center gap-3">
                          <img src={img(item.image)} alt="" className="h-12 w-10 shrink-0 rounded-md bg-canvas object-cover" />
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.variant_label && <p className="text-[13px] text-ink-500">{item.variant_label}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{inr(item.price)}</td>
                      <td className="text-right text-base font-semibold tabular-nums">{item.quantity}</td>
                      <td className="text-right font-semibold tabular-nums">{inr(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto max-w-xs space-y-2 border-t border-line p-5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="tabular-nums">{inr(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt className="text-ink-500">Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</dt><dd className="text-brand-600 tabular-nums">− {inr(order.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-500">Delivery</dt><dd className="tabular-nums">{order.shipping_fee > 0 ? inr(order.shipping_fee) : 'Free'}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{inr(order.total)}</dd></div>
            </dl>
          </section>

          {/* Everything that has happened to this order, newest first */}
          <section className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="card-title">Full history</h2>
              <p className="text-[13px] text-ink-500">{timeline.length + 1} events · newest first</p>
            </div>
            <ol className="mt-5">
              {[...timeline.map((entry) => ({ ...describe(entry), time: entry.created_at })), { icon: Clock, tone: 'gray', title: 'Order created', text: `${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online payment'} · ${inr(order.total)}`, time: order.created_at }].map((event, i, all) => {
                const Icon = event.icon;
                return (
                  <li key={i} className="relative flex gap-3.5 pb-6 last:pb-0">
                    {i < all.length - 1 && <span aria-hidden className="absolute top-9 left-[17px] h-[calc(100%-36px)] w-px bg-line-strong" />}
                    <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-full', TONE[event.tone])}><Icon className="size-[18px]" aria-hidden /></span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold">{event.title}{i === 0 && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Latest</span>}</p>
                      {event.text && <p className="text-sm break-words text-ink-700">{event.text}</p>}
                      <p className="text-[13px] text-ink-500">{formatDate(event.time, true)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5 text-sm">
            <h2 className="card-title mb-3">Customer</h2>
            <p className="font-semibold">{order.user_id ? <Link to={`/customers/${order.user_id}`} className="text-brand-600 hover:underline">{order.customer_name}</Link> : order.customer_name}</p>
            <a href={`mailto:${order.customer_email}`} className="mt-1.5 flex items-center gap-2 break-all text-ink-700 hover:text-brand-600"><Mail className="size-4 shrink-0 text-ink-400" aria-hidden />{order.customer_email}</a>
            <a href={`tel:${order.ship_phone}`} className="mt-1 flex items-center gap-2 text-ink-700 hover:text-brand-600"><Phone className="size-4 text-ink-400" aria-hidden />{order.ship_phone}</a>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="card-title mb-3">Deliver to</h2>
            <p className="font-semibold">{order.ship_name}</p>
            <p className="leading-relaxed text-ink-700">{order.ship_line1}{order.ship_line2 ? `, ${order.ship_line2}` : ''}<br />{order.ship_city}, {order.ship_state} – {order.ship_pincode}<br />Phone: {order.ship_phone}</p>
            {order.tracking_number && <p className="mt-3 flex items-center gap-2 rounded-lg bg-canvas px-3 py-2"><Truck className="size-4 shrink-0 text-brand-600" aria-hidden /><span>{order.courier ? `${order.courier} · ` : ''}<strong>{order.tracking_number}</strong></span></p>}
            {order.notes && <p className="mt-3 rounded-lg bg-[#fdf6e7] p-3 text-[#7a5510]"><span className="font-semibold">Customer note:</span> {order.notes}</p>}
          </section>

          <section className="card p-5 text-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="card-title flex items-center gap-2">
                <Truck className="size-4 text-brand-600" aria-hidden /> Shiprocket
              </h2>
              {order.shiprocket_order_id ? (
                <Badge tone="green">Synced</Badge>
              ) : (
                <Badge tone="amber">Not Synced</Badge>
              )}
            </div>
            {order.shiprocket_order_id ? (
              <div className="space-y-2 mb-4 bg-canvas p-3 rounded-xl border border-line">
                <div className="flex justify-between">
                  <span className="text-ink-500">Dashboard Order #</span>
                  <span className="font-semibold text-brand-700">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Shiprocket System ID</span>
                  <span className="font-mono text-xs text-ink-700">#{order.shiprocket_order_id}</span>
                </div>
                {order.shiprocket_shipment_id && (
                  <div className="flex justify-between">
                    <span className="text-ink-500">Shipment ID</span>
                    <span className="font-mono text-xs text-ink-700">#{order.shiprocket_shipment_id}</span>
                  </div>
                )}
                {order.tracking_number && (
                  <div className="flex justify-between">
                    <span className="text-ink-500">AWB Tracking</span>
                    <span className="font-semibold text-brand-600">{order.tracking_number}</span>
                  </div>
                )}
                <p className="pt-1 text-[11px] text-ink-400 border-t border-line/60">
                  Tip: In Shiprocket dashboard, this order is listed as <strong>{order.order_number}</strong>.
                </p>
              </div>
            ) : (
              <p className="text-ink-500 mb-4 text-xs leading-relaxed">
                Sync this order directly into Shiprocket to print shipping labels, select couriers, and generate tracking AWB.
              </p>
            )}
            <Button
              type="button"
              variant={order.shiprocket_order_id ? 'outline' : 'primary'}
              size="sm"
              className="w-full"
              loading={syncingSr}
              onClick={handleSyncShiprocket}
            >
              {order.shiprocket_order_id ? 'Re-sync with Shiprocket' : 'Send to Shiprocket'}
            </Button>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="card-title mb-3">Payment</h2>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4"><dt className="text-ink-500">Method</dt><dd className="font-medium">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)'}</dd></div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-500">Status</dt>
                <dd>
                  <Select label="Payment status" value={order.payment_status} onChange={setPayment} options={Object.entries(PAYMENT_STATUS).map(([value, s]) => [value, s.label])} className="w-36 print:hidden" />
                  <span className="hidden print:inline">{PAYMENT_STATUS[order.payment_status].label}</span>
                </dd>
              </div>
            </dl>
            {order.payments.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-xs font-semibold tracking-wider text-ink-500 uppercase">Payment attempts · {order.payments.length}</p>
                <ul className="space-y-3">
                  {order.payments.map((p) => (
                    <li key={p.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium tabular-nums">{inr(p.amount)}</span>
                        <Badge tone={p.status === 'paid' ? 'green' : p.status === 'failed' ? 'red' : 'amber'}>{p.status === 'created' ? 'Started, not finished' : p.status === 'paid' ? 'Paid' : 'Failed'}</Badge>
                      </div>
                      <p className="mt-0.5 text-[13px] break-all text-ink-500">{p.gateway === 'mock' ? 'Test gateway' : 'Razorpay'} · {p.gateway_payment_id || p.gateway_order_id}</p>
                      {p.failure_reason && <p className="text-[13px] text-clay-600">{p.failure_reason}</p>}
                      <p className="text-[13px] text-ink-400">{formatDate(p.updated_at, true)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      <Confirm open={cancelling} onClose={() => setCancelling(false)} onConfirm={() => move('cancelled')} busy={busy === 'cancelled'} title="Cancel this order?" confirmLabel="Cancel order">
        Order <strong className="text-ink-900">{order.order_number}</strong> will be cancelled and its items returned to stock. This cannot be undone.
        {order.payment_status === 'paid' && <> The customer has already paid {inr(order.total)} — you will need to refund them.</>}
        {notify ? ' The customer will be emailed.' : ' The customer will not be emailed.'}
      </Confirm>

      {/* Approve Return & Refund Modal */}
      <Confirm
        open={confirmApproveModal}
        onClose={() => setConfirmApproveModal(false)}
        onConfirm={handleApproveReturn}
        busy={returnActionBusy === 'approve'}
        title="Approve Return & Process Refund?"
        confirmLabel={`Approve & Refund ${inr(order.total)}`}
      >
        <div className="space-y-2 text-sm text-ink-600">
          <p>This action will automatically execute the following:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            {order.payment_method === 'online' && order.payment_status === 'paid' ? (
              <li className="font-medium text-emerald-800">
                <strong>Razorpay Refund:</strong> Instantly initiate full refund of {inr(order.total)} back to the customer's original payment method.
              </li>
            ) : (
              <li><strong>COD Refund:</strong> Mark order payment as Refunded (arrange cash/UPI refund with customer).</li>
            )}
            <li><strong>Shiprocket Reverse Pickup:</strong> Automatically create a Return Shipment for courier to pick up goods from customer.</li>
            <li><strong>Inventory:</strong> Return {order.items.length} items back to product inventory stock.</li>
            <li><strong>Customer Email:</strong> Send luxury concierge confirmation email to {order.customer_email}.</li>
          </ul>
        </div>
      </Confirm>

      {/* Decline Return Modal */}
      <Confirm
        open={rejectModal}
        onClose={() => setRejectModal(false)}
        onConfirm={handleRejectReturn}
        busy={returnActionBusy === 'reject'}
        title="Decline Return Request?"
        confirmLabel="Decline Return"
      >
        <p className="text-sm text-ink-600 mb-3">
          The customer will receive an email explaining that their return request could not be approved.
        </p>
        <Field
          label="Reason for Declining *"
          value={returnAdminNote}
          onChange={(e) => setReturnAdminNote(e.target.value)}
          placeholder="e.g. Products were unsealed or return period expired..."
          required
        />
      </Confirm>
    </>
  );
}
