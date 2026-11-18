import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, CreditCard, FlaskConical, Printer, XCircle } from 'lucide-react';
import api from '../lib/api';
import { completeTestPayment, failTestPayment, payWithRazorpay } from '../lib/payment';
import { formatDate, img, inr } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import OrderSummary from '../components/OrderSummary';
import InvoiceModal from '../components/InvoiceModal';
import { Alert, Button, EmptyState, Modal, usePageTitle } from '../components/ui';
import { OrderSkeleton } from '../components/Skeletons';

/**
 * The page a shopper lands on after placing an order.
 * For online orders it also runs the payment step and reports success or failure.
 */
export default function OrderResult() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testPayment, setTestPayment] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const autoStarted = useRef(false);
  usePageTitle(`Order ${orderNumber}`);

  useEffect(() => {
    api.get(`/orders/${orderNumber}`).then((d) => setOrder(d.order)).catch(() => setMissing(true));
  }, [orderNumber]);

  const needsPayment = order && order.payment_method === 'online' && order.payment_status !== 'paid' && order.status === 'pending';

  const startPayment = useCallback(
    async (existing) => {
      setBusy(true);
      setError('');
      try {
        const payment = existing || (await api.post(`/orders/${orderNumber}/pay`)).payment;
        if (payment.gateway === 'razorpay') {
          setOrder(await payWithRazorpay({ order, payment, user }));
        } else {
          setTestPayment(payment); // handled by the test dialog below
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [order, orderNumber, user]
  );

  // Coming straight from checkout: open the payment window automatically, once.
  useEffect(() => {
    if (needsPayment && location.state?.fresh && !autoStarted.current) {
      autoStarted.current = true;
      startPayment(location.state.payment || undefined);
    }
  }, [needsPayment, location.state, startPayment]);

  const finishTest = async (succeed) => {
    setBusy(true);
    try {
      setOrder(await (succeed ? completeTestPayment : failTestPayment)(order, testPayment));
      setTestPayment(null);
    } catch (err) {
      setError(err.message);
      setTestPayment(null);
    } finally {
      setBusy(false);
    }
  };

  if (missing) {
    return (
      <div className="container-page">
        <EmptyState icon={CircleAlert} title="Order not found" description="We could not find this order in your account.">
          <Link to="/account/orders" className="btn btn-primary">My orders</Link>
        </EmptyState>
      </div>
    );
  }
  if (!order) return <OrderSkeleton page />;

  const cancelled = order.status === 'cancelled';
  const failed = needsPayment && order.payment_status === 'failed';
  const paidAttempt = order.payments.find((p) => p.status === 'paid');

  let hero;
  if (cancelled) {
    hero = { icon: XCircle, tone: 'bg-clay-50 text-clay-600', title: 'This order was cancelled', text: 'No further action is needed.' };
  } else if (failed) {
    hero = { icon: XCircle, tone: 'bg-clay-50 text-clay-600', title: 'Payment was not completed', text: 'Your order is saved and your items are reserved. You can try the payment again.' };
  } else if (needsPayment) {
    hero = { icon: CreditCard, tone: 'bg-[#fdf6e7] text-[#7a5510]', title: 'Complete your payment', text: 'Your order is saved. Pay now to confirm it.' };
  } else {
    hero = {
      icon: CheckCircle2,
      tone: 'bg-brand-50 text-brand-600',
      title: 'Thank you — your order is confirmed',
      text: order.payment_method === 'cod' ? `Please keep ${inr(order.total)} ready to pay on delivery.` : 'Your payment was received successfully.',
    };
  }
  const HeroIcon = hero.icon;

  return (
    <div className="container-page max-w-3xl py-10 sm:py-16">
      <div className="text-center" aria-live="polite">
        <span className={`mx-auto flex size-20 items-center justify-center rounded-full ${hero.tone}`}>
          <HeroIcon className="size-10" strokeWidth={1.5} aria-hidden />
        </span>
        <h1 className="mt-6 text-3xl font-medium sm:text-4xl">{hero.title}</h1>
        <p className="mt-3 text-lg text-ink-500">{hero.text}</p>
        <p className="mt-2 text-ink-500">
          Order <span className="font-semibold text-ink-900">{order.order_number}</span> · {formatDate(order.created_at, true)}
        </p>
        {!needsPayment && !cancelled && <p className="mt-1 text-sm text-ink-400">A confirmation has been sent to {order.customer_email}</p>}
      </div>

      {error && <Alert className="mt-8">{error}</Alert>}

      {needsPayment && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button size="lg" className="w-full sm:w-auto sm:min-w-64" onClick={() => startPayment()} loading={busy}>
            {failed ? 'Try payment again' : 'Pay now'} · {inr(order.total)}
          </Button>
          <Link to={`/account/orders/${order.order_number}`} className="text-sm font-medium text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline">View order or cancel</Link>
        </div>
      )}

      <div className="card mt-10 p-6 sm:p-8">
        <h2 className="text-xl font-medium">Order summary</h2>
        <ul className="mt-5 divide-y divide-sand-200 border-y border-sand-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <img src={img(item.image)} alt="" className="aspect-square w-14 shrink-0 rounded-lg bg-sand-100 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="leading-snug font-medium">{item.name}</p>
                <p className="text-sm text-ink-500">{item.variant_label ? `${item.variant_label} · ` : ''}Qty {item.quantity}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{inr(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <OrderSummary className="mt-5" subtotal={order.subtotal} discount={order.discount} couponCode={order.coupon_code} shipping={order.shipping_fee} total={order.total} />

        <div className="mt-6 grid gap-6 border-t border-sand-200 pt-6 text-[15px] sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-semibold tracking-wider text-ink-400 uppercase">Delivering to</p>
            <p className="font-medium">{order.ship_name}</p>
            <p className="text-ink-500">{order.ship_line1}{order.ship_line2 ? `, ${order.ship_line2}` : ''}<br />{order.ship_city}, {order.ship_state} – {order.ship_pincode}<br />{order.ship_phone}</p>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold tracking-wider text-ink-400 uppercase">Payment</p>
            <p className="font-medium">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online payment'}</p>
            {paidAttempt && <p className="break-all text-ink-500">Transaction ID: {paidAttempt.gateway_payment_id}</p>}
          </div>
        </div>
      </div>

      {!needsPayment && (
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => setShowInvoice(true)} className="gap-2">
            <Printer className="size-4" /> View &amp; Print Tax Invoice
          </Button>
          <Link to={`/account/orders/${order.order_number}`} className="btn btn-primary">Track this order</Link>
          <Link to="/shop" className="btn btn-outline">Continue shopping</Link>
        </div>
      )}

      <InvoiceModal order={order} open={showInvoice} onClose={() => setShowInvoice(false)} />

      {/* Test gateway — shown only while the server has no Razorpay keys */}
      <Modal open={!!testPayment} title="Test payment">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e8cf9c] bg-[#fdf6e7] p-4 text-sm leading-relaxed text-[#7a5510]">
          <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>This store is in <strong>test mode</strong>. No real money will be charged. Add Razorpay keys on the server to accept live payments.</p>
        </div>
        <p className="text-ink-500">Amount payable</p>
        <p className="font-display text-4xl font-medium">{inr(order.total)}</p>
        <div className="mt-7 grid gap-3">
          <Button size="lg" onClick={() => finishTest(true)} loading={busy}>Simulate successful payment</Button>
          <Button variant="outline" onClick={() => finishTest(false)} disabled={busy}>Simulate failed payment</Button>
        </div>
      </Modal>
    </div>
  );
}
