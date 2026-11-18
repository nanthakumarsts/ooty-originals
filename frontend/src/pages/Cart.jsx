import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { img, inr } from '../lib/format';
import { useShop } from '../context/ShopContext';
import useQuote from '../hooks/useQuote';
import OrderSummary from '../components/OrderSummary';
import CouponBox from '../components/CouponBox';
import { Alert, Button, EmptyState, QuantityStepper, cx, usePageTitle } from '../components/ui';
import { CartSkeleton } from '../components/Skeletons';

export default function Cart() {
  usePageTitle('Cart');
  const { cart, setQuantity, removeFromCart } = useShop();
  const [pincodeInput, setPincodeInput] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const { quote, loading, error } = useQuote(null, { pincode: deliveryPincode });

  if (!cart.length) {
    return (
      <div className="container-page">
        <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Discover teas, chocolates, oils and more from the Nilgiris.">
          <Link to="/shop" className="btn btn-primary">Start shopping</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container-page pt-8 pb-32 sm:pt-12 lg:pb-12">
      <h1 className="text-4xl font-medium sm:text-5xl">Your cart</h1>

      {error && <Alert className="mt-6">{error}</Alert>}
      {!quote ? (
        !error && <CartSkeleton />
      ) : (
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_400px] lg:gap-14">
          <ul className={cx('divide-y divide-sand-200 border-y border-sand-200 transition-opacity duration-200', loading && 'opacity-60')}>
            {quote.items.map((item) => (
              <li key={item.key} className="flex gap-4 py-5 sm:gap-6">
                <Link to={`/product/${item.slug}`} className="w-20 shrink-0 overflow-hidden rounded-xl bg-sand-100 sm:w-28">
                  <img src={img(item.image)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-sans text-base leading-snug font-semibold tracking-normal">
                        <Link to={`/product/${item.slug}`} className="hover:text-brand-600">{item.name}</Link>
                      </h2>
                      {item.variantLabel && <p className="mt-0.5 text-sm text-ink-500">{item.variantLabel}</p>}
                      <p className="mt-1 text-sm text-ink-500">
                        {inr(item.price)} each
                        {item.comparePrice && <span className="ml-2 text-ink-300 line-through">{inr(item.comparePrice)}</span>}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{inr(item.lineTotal)}</p>
                  </div>
                  {item.issue && <p role="alert" className="mt-2 text-sm font-medium text-clay-600">{item.issue}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <QuantityStepper size="sm" value={item.quantity} max={Math.max(1, Math.min(20, item.stock))} onChange={(q) => setQuantity(item.productId, item.variantId, q)} />
                    <button type="button" onClick={() => removeFromCart(item.productId, item.variantId)} className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-500 hover:bg-clay-50 hover:text-clay-600" aria-label={`Remove ${item.name} from cart`}>
                      <Trash2 className="size-4" aria-hidden />
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="card p-6 lg:sticky lg:top-28" aria-label="Order summary">
            <h2 className="text-2xl font-medium">Summary</h2>
            <div className="mt-5"><CouponBox quote={quote} /></div>

            {/* Pincode estimation widget */}
            <div className="mt-5 rounded-2xl border border-sand-200 bg-sand-50/70 p-3.5">
              <label htmlFor="pincode-calc" className="flex items-center gap-1.5 text-xs font-semibold text-ink-700 mb-2">
                <Truck className="size-3.5 text-brand-600" aria-hidden />
                Estimate Shiprocket delivery
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (/^\d{6}$/.test(pincodeInput)) setDeliveryPincode(pincodeInput);
                }}
                className="flex gap-2"
              >
                <input
                  id="pincode-calc"
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit Pincode"
                  value={pincodeInput}
                  onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ''))}
                  className="input input-sm flex-1 text-xs"
                />
                <button
                  type="submit"
                  disabled={pincodeInput.length !== 6}
                  className="btn btn-outline btn-sm text-xs font-medium shrink-0"
                >
                  Check
                </button>
              </form>
              {quote?.shippingDetails?.rate != null && (
                <div className="mt-2.5 rounded-lg bg-white/80 p-2 text-xs text-brand-900 border border-brand-200/60 font-medium">
                  Delivery charge: <strong>{inr(quote.shipping)}</strong>
                </div>
              )}
            </div>

            <OrderSummary
              className="mt-6"
              subtotal={quote.subtotal}
              discount={quote.discount}
              couponCode={quote.coupon?.code}
              shipping={quote.shipping}
              total={quote.total}
              itemCount={quote.items.length}
              shippingDetails={quote.shippingDetails}
            />
            {quote.hasIssues && <Alert tone="warn" className="mt-5">Some items need your attention before you can check out.</Alert>}
            {quote.hasIssues ? (
              <Button size="lg" className="mt-6 w-full" disabled>Checkout</Button>
            ) : (
              <Link to="/checkout" className="btn btn-primary btn-lg mt-6 w-full">
                Checkout
                <ArrowRight className="size-[18px]" aria-hidden />
              </Link>
            )}
            <Link to="/shop" className="mt-3 flex min-h-11 items-center justify-center text-sm font-medium text-ink-500 hover:text-ink-900">Continue shopping</Link>
          </aside>
        </div>
      )}

      {/* Phones: total and Checkout pinned above the tab bar */}
      {quote && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-4">
            <div className="min-w-0">
              <p className="text-xs text-ink-500">Total · {quote.items.length} {quote.items.length === 1 ? 'item' : 'items'}</p>
              <p className="font-display text-xl leading-tight font-medium tabular-nums">{inr(quote.total)}</p>
            </div>
            {quote.hasIssues ? (
              <Button className="flex-1" disabled>Checkout</Button>
            ) : (
              <Link to="/checkout" className="btn btn-primary flex-1">Checkout <ArrowRight className="size-[18px]" aria-hidden /></Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
