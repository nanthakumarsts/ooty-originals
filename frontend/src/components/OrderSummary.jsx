import { inr } from '../lib/format';
import { cx } from './ui';

/** Totals block shared by the cart, checkout and order pages. */
export default function OrderSummary({ subtotal, discount, couponCode, shipping, total, itemCount, className }) {
  const row = 'flex items-center justify-between gap-4 text-[15px]';
  return (
    <dl className={cx('space-y-3', className)}>
      <div className={row}>
        <dt className="text-ink-500">Subtotal{itemCount ? ` (${itemCount} ${itemCount === 1 ? 'item' : 'items'})` : ''}</dt>
        <dd className="font-medium tabular-nums">{inr(subtotal)}</dd>
      </div>
      {Number(discount) > 0 && (
        <div className={row}>
          <dt className="text-ink-500">Discount{couponCode ? ` (${couponCode})` : ''}</dt>
          <dd className="font-medium text-brand-600 tabular-nums">− {inr(discount)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-ink-500">Delivery</dt>
        <dd className={cx('font-medium tabular-nums', Number(shipping) === 0 && 'text-brand-600')}>{Number(shipping) > 0 ? inr(shipping) : 'Free'}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-sand-200 pt-4">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="text-right">
          <span className="font-display text-2xl font-medium tabular-nums">{inr(total)}</span>
          <span className="block text-xs text-ink-400">Including GST</span>
        </dd>
      </div>
    </dl>
  );
}
