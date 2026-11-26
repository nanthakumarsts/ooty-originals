import { inr } from '../lib/format';
import { cx } from './ui';

/** Totals block shared by the cart, checkout and order pages. */
export default function OrderSummary({
  subtotal,
  discount,
  couponCode,
  shipping,
  total,
  itemCount,
  shippingDetails,
  cancelledAmount = 0,
  isCart = false,
  hasAddress = true,
  className,
}) {
  const row = 'flex items-center justify-between gap-4 text-[15px]';
  const cartTotal = Math.max(0, Number(subtotal || 0) - Number(discount || 0));

  return (
    <dl className={cx('space-y-3', className)}>
      <div className={row}>
        <dt className="text-ink-500">
          {Number(cancelledAmount) > 0 ? 'Active Subtotal' : 'Subtotal'}
          {itemCount ? ` (${itemCount} ${itemCount === 1 ? 'item' : 'items'})` : ''}
        </dt>
        <dd className="font-medium tabular-nums">{inr(subtotal)}</dd>
      </div>
      {Number(cancelledAmount) > 0 && (
        <div className={row}>
          <dt className="text-clay-600 font-medium">Refunded (Cancelled)</dt>
          <dd className="font-medium text-clay-600 tabular-nums">− {inr(cancelledAmount)}</dd>
        </div>
      )}
      {Number(discount) > 0 && (
        <div className={row}>
          <dt className="text-ink-500">Discount{couponCode ? ` (${couponCode})` : ''}</dt>
          <dd className="font-medium text-brand-600 tabular-nums">− {inr(discount)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-ink-500">Delivery charge</dt>
        {isCart ? (
          <dd className="text-sm font-normal text-ink-500">Calculated at checkout</dd>
        ) : !hasAddress ? (
          <dd className="text-sm font-normal text-ink-500">Enter delivery address</dd>
        ) : shippingDetails && shippingDetails.available === false ? (
          <dd className="text-sm font-semibold text-rose-600">Not serviceable</dd>
        ) : (
          <dd className={cx('font-medium tabular-nums', Number(shipping) === 0 && 'text-brand-600')}>
            {Number(shipping) > 0 ? inr(shipping) : shippingDetails?.freeShippingApplied ? 'Free' : inr(shipping)}
          </dd>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-sand-200 pt-4">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="text-right">
          <span className="font-display text-2xl font-medium tabular-nums">
            {isCart ? inr(cartTotal) : inr(total)}
          </span>
          <span className="block text-xs text-ink-400">
            {isCart ? 'Excluding shipping' : 'Including GST'}
          </span>
        </dd>
      </div>
    </dl>
  );
}
