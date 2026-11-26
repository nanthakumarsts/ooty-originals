import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Banknote, Check, CreditCard, Loader2, Lock, MapPin, Pencil, Plus, ShieldCheck } from 'lucide-react';
import api from '../lib/api';
import { clearBuyNow, getBuyNow } from '../lib/buyNow';
import { img, inr } from '../lib/format';
import { payWithRazorpay } from '../lib/payment';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import useQuote from '../hooks/useQuote';
import AddressForm from '../components/AddressForm';
import OrderSummary from '../components/OrderSummary';
import CouponBox from '../components/CouponBox';
import TestPaymentDialog from '../components/TestPaymentDialog';
import { Alert, Badge, Button, Modal, cx, usePageTitle } from '../components/ui';
import { CheckoutSkeleton } from '../components/Skeletons';

/** Cart › Checkout › Done — shows the shopper where they are. */
function Progress({ buyNow }) {
  const steps = [
    buyNow ? { label: 'Buy now', state: 'done' } : { label: 'Cart', state: 'done', to: '/cart' },
    { label: 'Address & payment', state: 'current' },
    { label: 'Confirmation', state: 'next' },
  ];
  return (
    <ol className="flex items-center gap-2 text-sm sm:gap-3" aria-label="Checkout progress">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-2 sm:gap-3" aria-current={step.state === 'current' ? 'step' : undefined}>
          {i > 0 && <span className={cx('h-px w-5 sm:w-10', step.state === 'next' ? 'bg-sand-300' : 'bg-brand-600')} aria-hidden />}
          <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', step.state === 'done' && 'bg-brand-600 text-white', step.state === 'current' && 'bg-ink-900 text-white', step.state === 'next' && 'border border-sand-300 bg-white text-ink-400')}>
            {step.state === 'done' ? <Check className="size-4" aria-hidden /> : i + 1}
          </span>
          {step.to ? (
            <Link to={step.to} className="inline-flex min-h-8 min-w-8 items-center justify-center font-medium text-brand-600 hover:underline">{step.label}</Link>
          ) : (
            <span className={cx('font-medium', step.state === 'next' ? 'hidden text-ink-400 sm:inline' : step.state === 'done' ? 'text-brand-600' : 'text-ink-900')}>{step.label}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Section({ number, title, children, action, error }) {
  return (
    <section className={cx('card p-5 sm:p-7', error && 'border-clay-600 ring-1 ring-clay-600')}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-xl font-medium sm:text-2xl">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 font-sans text-sm font-bold text-white">{number}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
      {error && <p role="alert" className="mt-3 text-sm font-medium text-clay-600">{error}</p>}
    </section>
  );
}

function Choice({ checked, onChange, name, title, description, icon: Icon, badge, footer }) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        checked ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-sand-300 hover:border-ink-300'
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1 size-[18px] shrink-0 accent-brand-600" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {Icon && <Icon className="size-[18px] text-brand-600" aria-hidden />}
          {title}
          {badge}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-ink-500">{description}</span>
        {footer}
      </span>
    </label>
  );
}

export default function Checkout() {
  usePageTitle('Checkout');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, coupon, setCoupon, clearCart, settings } = useShop();

  // "Buy it now" checks out a single item and leaves the cart alone.
  const [params] = useSearchParams();
  const buyMode = params.get('buy') === '1';
  const [buyItem] = useState(() => (buyMode ? getBuyNow() : null));
  const buyItems = useMemo(() => (buyItem ? [buyItem] : null), [buyItem]);
  const orderItems = buyItems || cart;

  const [addresses, setAddresses] = useState(null);
  const [billingAddressId, setBillingAddressId] = useState(null);
  const [deliveryAddressId, setDeliveryAddressId] = useState(null);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [addressForm, setAddressForm] = useState(null); // null | { address, target: 'billing' | 'delivery' }
  const [billingError, setBillingError] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [method, setMethod] = useState('online');

  const effectiveDeliveryId = sameAsBilling ? billingAddressId : deliveryAddressId;
  const selectedBilling = useMemo(() => addresses?.find((a) => a.id === billingAddressId), [addresses, billingAddressId]);
  const selectedDelivery = useMemo(() => addresses?.find((a) => a.id === effectiveDeliveryId), [addresses, effectiveDeliveryId]);

  const { quote, loading } = useQuote(buyItems, {
    pincode: selectedDelivery?.pincode,
    country: selectedDelivery?.country || 'India',
    addressId: effectiveDeliveryId,
    paymentMethod: method,
  });

  const isUnserviceable = Boolean(selectedDelivery && quote?.shippingDetails && quote.shippingDetails.available === false);
  const [gateway, setGateway] = useState('');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState(''); // '' | 'placing' | 'paying'
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState('');
  const [testRequest, setTestRequest] = useState(null);

  // An order that was created but not paid yet. If the shopper retries without changing
  // anything, the same order is paid for instead of a duplicate being created.
  const pending = useRef(null);
  const placedRef = useRef(false);
  const billingSection = useRef(null);
  const deliverySection = useRef(null);
  const errorBox = useRef(null);

  // Controlled dynamically by Admin Panel -> Site settings -> Delivery & payment -> Cash on Delivery
  const codEnabled = settings.cod_enabled === '1' || settings.cod_enabled === true;

  useEffect(() => {
    if (!codEnabled && method === 'cod') setMethod('online');
  }, [codEnabled, method]);

  useEffect(() => {
    api.get('/addresses').then((d) => {
      setAddresses(d.addresses);
      const def = (d.addresses.find((a) => a.is_default) || d.addresses[0])?.id ?? null;
      setBillingAddressId(def);
      setDeliveryAddressId(def);
    }).catch((err) => setError(err.message));
    api.get('/payments/config').then((d) => setGateway(d.gateway)).catch(() => {});
  }, []);

  // Leaving checkout with an unpaid order: release it so its items are not held back.
  useEffect(() => () => {
    if (pending.current && !placedRef.current) api.post(`/orders/${pending.current.order.order_number}/cancel`).catch(() => {});
  }, []);

  useEffect(() => {
    if (error) errorBox.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [error]);

  if (!orderItems.length && !placed) return <Navigate to="/cart" replace />;

  const onAddressSaved = (list) => {
    const previous = new Set((addresses || []).map((a) => a.id));
    const added = list.find((a) => !previous.has(a.id));
    setAddresses(list);
    const targetId = added ? added.id : list[0]?.id;
    if (addressForm?.target === 'delivery') {
      setDeliveryAddressId(targetId);
      setDeliveryError('');
    } else {
      setBillingAddressId(targetId);
      setBillingError('');
      if (sameAsBilling) setDeliveryAddressId(targetId);
    }
    setAddressForm(null);
  };

  const finish = (order) => {
    placedRef.current = true;
    pending.current = null;
    setPlaced(true);
    setCoupon('');
    if (buyItem) clearBuyNow(); // bought on its own — the cart stays untouched
    else clearCart();
    navigate(`/order/${order.order_number}`, { replace: true });
  };

  const dropPending = async () => {
    if (!pending.current) return;
    await api.post(`/orders/${pending.current.order.order_number}/cancel`).catch(() => {});
    pending.current = null;
  };

  const openPayment = (order, payment) =>
    payment.gateway === 'razorpay'
      ? payWithRazorpay({ order, payment, user })
      : new Promise((resolve) => setTestRequest({ order, payment, resolve })).finally(() => setTestRequest(null));

  const placeOrder = async () => {
    setError('');
    if (!billingAddressId) {
      setBillingError('Select a billing address to continue.');
      billingSection.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!effectiveDeliveryId) {
      setDeliveryError('Select a delivery address to continue.');
      deliverySection.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (isUnserviceable) {
      setError(`Delivery is not available to PIN code ${selectedDelivery?.pincode || ''}. ${quote?.shippingDetails?.message || 'Please select a serviceable delivery address.'}`);
      deliverySection.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const details = {
      items: orderItems,
      addressId: effectiveDeliveryId,
      billingAddressId: billingAddressId,
      paymentMethod: method,
      couponCode: quote?.coupon ? (quote.coupon.code || coupon) : null,
      notes,
    };
    const key = JSON.stringify(details);
    setStage('placing');
    try {
      if (method === 'cod') {
        await dropPending();
        finish((await api.post('/orders', details)).order);
        return;
      }

      let order;
      let payment;
      if (pending.current && pending.current.key === key) {
        // same order as the last attempt — just open a new payment for it
        ({ order, payment } = await api.post(`/orders/${pending.current.order.order_number}/pay`));
        if (!payment && order.payment_status === 'paid') return finish(order); // the earlier attempt had gone through
      } else {
        await dropPending();
        const created = await api.post('/orders', details);
        order = created.order;
        payment = created.payment;
        pending.current = { order, key };
        if (!payment) throw new Error(created.paymentError || 'The payment window could not be opened. Please try again.');
      }

      setStage('paying');
      const result = await openPayment(order, payment);
      if (result?.payment_status === 'paid') return finish(result);

      // Double-check order status before treating as cancelled
      if (order?.order_number) {
        try {
          const check = await api.get(`/orders/${order.order_number}`);
          if (check?.order?.payment_status === 'paid') return finish(check.order);
        } catch {}
      }

      pending.current = null;
      setError('Payment was cancelled or was not completed. Nothing has been charged. You can press Pay to try again.');
    } catch (err) {
      // If payment verification had a network hiccup or timeout, verify if the order was paid
      const orderToCheck = pending.current?.order || order;
      if (orderToCheck?.order_number) {
        try {
          const check = await api.get(`/orders/${orderToCheck.order_number}`);
          if (check?.order?.payment_status === 'paid') return finish(check.order);
        } catch {}
      }
      pending.current = null; // start fresh on next attempt
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setStage('');
    }
    return undefined;
  };

  if (!quote || addresses === null) return <CheckoutSkeleton />;

  const busy = stage !== '';

  return (
    <div className="container-page pt-8 pb-32 sm:pt-12 lg:pb-12">
      <Progress buyNow={!!buyItem} />
      <h1 className="mt-5 text-4xl font-medium sm:text-5xl">Checkout</h1>

      <div ref={errorBox}>
        {error && <Alert className="mt-6">{error}</Alert>}
      </div>
      {buyItem && cart.length > 0 && (
        <Alert tone="info" className="mt-6">
          You are buying just this item. The {cart.length} {cart.length === 1 ? 'item' : 'items'} in your cart will stay there for later.
        </Alert>
      )}
      {quote.hasIssues && (
        <Alert tone="warn" className="mt-6">
          {buyItem ? <>This item is no longer available in the quantity you chose ({quote.items.find((i) => i.issue)?.issue}). <button type="button" onClick={() => navigate(-1)} className="font-semibold underline">Go back</button></> : <>Some items in your cart are no longer available in the quantity you chose. <Link to="/cart" className="font-semibold underline">Review your cart</Link></>}
        </Alert>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_400px] lg:gap-12">
        <div className="space-y-5">
          {/* Section 1: Billing Address */}
          <div ref={billingSection}>
            <Section
              number="1"
              title="Billing address"
              error={billingError}
              action={addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAddressForm({ address: {}, target: 'billing' })}
                  className="btn btn-ghost btn-sm text-brand-600"
                >
                  <Plus className="size-4" aria-hidden /> Add new
                </button>
              )}
            >
              {addresses.length === 0 ? (
                <div>
                  <p className="mb-5 flex items-center gap-2 text-ink-500">
                    <MapPin className="size-[18px]" aria-hidden /> Where should your invoice be billed to?
                  </p>
                  <AddressForm defaultName={user.name} defaultPhone={user.phone} onSaved={onAddressSaved} />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Billing address">
                  {addresses.map((a) => (
                    <Choice
                      key={a.id}
                      name="billingAddress"
                      checked={billingAddressId === a.id}
                      onChange={() => {
                        setBillingAddressId(a.id);
                        setBillingError('');
                        if (sameAsBilling) {
                          setDeliveryAddressId(a.id);
                          setDeliveryError('');
                        }
                      }}
                      title={a.full_name}
                      badge={<Badge>{a.label}</Badge>}
                      description={<>{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} – {a.pincode}{a.country ? `, ${a.country}` : ''}<br />Phone: {a.phone}</>}
                      footer={
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setAddressForm({ address: a, target: 'billing' }); }}
                          className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                        >
                          <Pencil className="size-3.5" aria-hidden /> Edit
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Section 2: Delivery Address */}
          <div ref={deliverySection}>
            <Section
              number="2"
              title="Delivery address"
              error={deliveryError}
              action={!sameAsBilling && addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAddressForm({ address: {}, target: 'delivery' })}
                  className="btn btn-ghost btn-sm text-brand-600"
                >
                  <Plus className="size-4" aria-hidden /> Add new
                </button>
              )}
            >
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center gap-3 select-none rounded-xl border border-sand-300 bg-sand-50/60 p-3.5 hover:bg-sand-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSameAsBilling(checked);
                      if (checked) {
                        setDeliveryAddressId(billingAddressId);
                        setDeliveryError('');
                      }
                    }}
                    className="size-4.5 rounded accent-brand-600 cursor-pointer"
                  />
                  <div>
                    <span className="block font-medium text-ink-900 text-sm">Deliver to the same address as billing</span>
                    <span className="block text-xs text-ink-500">Uncheck if your package should be delivered to another location</span>
                  </div>
                </label>

                {sameAsBilling ? (
                  selectedBilling ? (
                    <div className="rounded-xl border border-sand-200 bg-white p-3.5 text-xs text-ink-700">
                      <p className="font-semibold text-ink-900 text-sm">{selectedBilling.full_name}</p>
                      <p className="mt-0.5 text-ink-600 leading-relaxed">
                        {selectedBilling.line1}{selectedBilling.line2 ? `, ${selectedBilling.line2}` : ''}<br />
                        {selectedBilling.city}, {selectedBilling.state} – {selectedBilling.pincode}{selectedBilling.country ? `, ${selectedBilling.country}` : ''}
                      </p>
                      <p className="mt-1 text-ink-500">Phone: {selectedBilling.phone}</p>
                    </div>
                  ) : null
                ) : (
                  addresses.length === 0 ? (
                    <div>
                      <p className="mb-5 flex items-center gap-2 text-ink-500">
                        <MapPin className="size-[18px]" aria-hidden /> Where should we deliver your order?
                      </p>
                      <AddressForm defaultName={user.name} defaultPhone={user.phone} onSaved={onAddressSaved} />
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery address">
                      {addresses.map((a) => (
                        <Choice
                          key={a.id}
                          name="deliveryAddress"
                          checked={deliveryAddressId === a.id}
                          onChange={() => { setDeliveryAddressId(a.id); setDeliveryError(''); }}
                          title={a.full_name}
                          badge={<Badge>{a.label}</Badge>}
                          description={<>{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} – {a.pincode}{a.country ? `, ${a.country}` : ''}<br />Phone: {a.phone}</>}
                          footer={
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setAddressForm({ address: a, target: 'delivery' }); }}
                              className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                            >
                              <Pencil className="size-3.5" aria-hidden /> Edit
                            </button>
                          }
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            </Section>
          </div>

          <Section number="3" title="Payment method">
            <div className="grid gap-3" role="radiogroup" aria-label="Payment method">
              <Choice
                name="payment"
                icon={CreditCard}
                checked={method === 'online'}
                onChange={() => setMethod('online')}
                title="Pay online"
                badge={gateway === 'mock' ? <Badge tone="amber">Test mode</Badge> : <Badge tone="green">Recommended</Badge>}
                description="UPI, credit / debit card, net banking or wallet. A secure Razorpay window opens when you press Pay."
              />
              {codEnabled && (
                <Choice
                  name="payment"
                  icon={Banknote}
                  checked={method === 'cod'}
                  onChange={() => setMethod('cod')}
                  title="Cash on Delivery"
                  description={`Pay ${inr(quote.total)} in cash when your order arrives.`}
                />
              )}
            </div>
          </Section>

          <Section number="4" title="Order notes">
            <label htmlFor="notes" className="sr-only">Order notes</label>
            <textarea id="notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know? e.g. gift note, delivery instructions (optional)" className="input" />
            <p className="mt-1.5 text-right text-xs text-ink-400">{notes.length}/500</p>
          </Section>
        </div>

        <aside className="card p-6 lg:sticky lg:top-28" aria-label="Order summary">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-medium">Your order</h2>
            {buyItem ? (
              <button type="button" onClick={() => navigate(-1)} className="inline-flex min-h-8 items-center text-sm font-medium text-brand-600 hover:underline">Change</button>
            ) : (
              <Link to="/cart" className="inline-flex min-h-8 items-center text-sm font-medium text-brand-600 hover:underline">Edit cart</Link>
            )}
          </div>
          <ul className={cx('mt-3 max-h-72 space-y-4 overflow-y-auto pt-2 pr-2 transition-opacity', loading && 'opacity-60')}>
            {quote.items.map((item) => (
              <li key={item.key} className="flex items-center gap-3.5">
                <span className="relative w-14 shrink-0">
                  <img src={img(item.image)} alt="" className="aspect-square w-full rounded-lg bg-sand-100 object-cover" />
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">{item.quantity}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm leading-snug font-medium">{item.name}</span>
                  {item.variantLabel && <span className="block text-[13px] text-ink-500">{item.variantLabel}</span>}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{inr(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-sand-200 pt-5">
            <CouponBox quote={quote} compact />
          </div>
          <OrderSummary
            className="mt-5 border-t border-sand-200 pt-5"
            subtotal={quote.subtotal}
            discount={quote.discount}
            couponCode={quote.coupon?.code}
            shipping={quote.shipping}
            total={quote.total}
            shippingDetails={quote.shippingDetails}
            hasAddress={Boolean(selectedDelivery?.pincode)}
          />

          {selectedDelivery && (
            <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-sand-100 px-3.5 py-3 text-sm leading-snug text-ink-700">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              <span>Delivering to <strong className="font-semibold">{selectedDelivery.full_name}</strong>, {selectedDelivery.city} – {selectedDelivery.pincode}{selectedDelivery.country ? `, ${selectedDelivery.country}` : ''}</span>
            </p>
          )}

          {isUnserviceable && (
            <div className="mt-3.5 rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-sm text-rose-950 flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold text-rose-900">Delivery not available to PIN {selectedDelivery.pincode}</p>
                <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                  {quote?.shippingDetails?.message || 'Our courier partners do not deliver to this location.'} Please choose or edit your delivery address.
                </p>
              </div>
            </div>
          )}

          <Button size="lg" className="mt-5 w-full" onClick={placeOrder} loading={stage === 'placing'} disabled={busy || quote.hasIssues || isUnserviceable}>
            {stage === 'paying' ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for payment…</> : isUnserviceable ? 'Delivery unavailable for this PIN code' : method === 'cod' ? 'Place order' : `Pay ${inr(quote.total)}`}
          </Button>
          {stage === 'paying' && <p className="mt-2 text-center text-sm text-ink-500" role="status">Complete the payment in the Razorpay window. Do not close this page.</p>}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-ink-400">
            {method === 'online' ? <><Lock className="size-3.5" aria-hidden /> Secure payment by Razorpay</> : <><ShieldCheck className="size-3.5" aria-hidden /> You pay only when the order arrives</>}
          </p>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-ink-400">
            By placing this order you agree to our <Link to="/terms-and-conditions" className="underline underline-offset-2">Terms</Link> and <Link to="/refund-policy" className="underline underline-offset-2">Refund policy</Link>.
          </p>
        </aside>
      </div>

      {/* Phones: total and Pay button pinned above the tab bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs text-ink-500">Total</p>
            <p className="font-display text-xl leading-tight font-medium tabular-nums">{inr(quote.total)}</p>
          </div>
          <Button className="flex-1" onClick={placeOrder} loading={stage === 'placing'} disabled={busy || quote.hasIssues || isUnserviceable}>
            {stage === 'paying' ? 'Waiting for payment…' : isUnserviceable ? 'PIN unavailable' : method === 'cod' ? 'Place order' : `Pay ${inr(quote.total)}`}
          </Button>
        </div>
      </div>

      <Modal
        open={!!addressForm}
        onClose={() => setAddressForm(null)}
        title={
          addressForm?.address?.id
            ? 'Edit address'
            : addressForm?.target === 'delivery'
            ? 'Add delivery address'
            : 'Add billing address'
        }
        wide
      >
        {addressForm && (
          <AddressForm
            key={addressForm.address?.id || 'new'}
            address={addressForm.address?.id ? addressForm.address : null}
            defaultName={user.name}
            defaultPhone={user.phone}
            onSaved={onAddressSaved}
            onCancel={() => setAddressForm(null)}
          />
        )}
      </Modal>

      <TestPaymentDialog request={testRequest} />
    </div>
  );
}
