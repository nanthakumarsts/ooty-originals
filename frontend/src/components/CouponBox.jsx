import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Sparkles, Tag, X } from 'lucide-react';
import api from '../lib/api';
import { inr } from '../lib/format';
import { useShop } from '../context/ShopContext';
import { Button, cx } from './ui';

export default function CouponBox({ quote, className }) {
  const { coupon, setCoupon } = useShop();
  const [code, setCode] = useState('');
  const [offers, setOffers] = useState([]);
  const [offersOpen, setOffersOpen] = useState(false);

  useEffect(() => {
    api
      .get('/offers')
      .then((d) => setOffers(d.offers || []))
      .catch(() => {});
  }, []);

  const apply = (e) => {
    e?.preventDefault?.();
    if (code.trim()) {
      setCoupon(code.trim().toUpperCase());
      setCode('');
      setOffersOpen(false);
    }
  };

  const applyDirect = (couponCode) => {
    setCoupon(couponCode.trim().toUpperCase());
    setOffersOpen(false);
  };

  if (!quote) return null;

  if (quote.coupon) {
    return (
      <div className={cx('overflow-hidden rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 sm:p-4', className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Tag className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-sans font-bold tracking-wider text-brand-800 text-sm">{quote.coupon.code}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-200/80 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                  <Check className="size-3" aria-hidden /> Applied
                </span>
              </div>
              <p className="text-xs font-medium text-brand-700 mt-0.5">
                You save <strong className="font-semibold">{inr(quote.discount)}</strong> on this order!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCoupon('')}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-clay-700 hover:bg-clay-100/70 transition-colors"
            title="Remove coupon"
          >
            <X className="size-3.5" aria-hidden />
            Remove
          </button>
        </div>
      </div>
    );
  }

  const subtotal = quote.subtotal || 0;

  return (
    <div className={cx('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="coupon-input" className="text-sm font-medium text-ink-800 flex items-center gap-1.5">
          <Tag className="size-3.5 text-brand-600" aria-hidden />
          Apply Coupon / Offer
        </label>
        {offers.length > 0 && (
          <button
            type="button"
            onClick={() => setOffersOpen(!offersOpen)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-md border border-brand-200/60 transition-colors cursor-pointer"
            aria-expanded={offersOpen}
          >
            <span>{offers.length} {offers.length === 1 ? 'coupon' : 'coupons'} available</span>
            {offersOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        )}
      </div>

      <form onSubmit={apply} className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="coupon-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
            autoComplete="off"
            className="input min-h-10 w-full uppercase placeholder:normal-case font-medium text-sm tracking-wide pr-8"
          />
          {code && (
            <button
              type="button"
              onClick={() => setCode('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              aria-label="Clear input"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="min-h-10 px-4 font-semibold shrink-0"
          disabled={!code.trim()}
        >
          Apply
        </Button>
      </form>

      {coupon && quote.couponError && (
        <div role="alert" className="flex items-start justify-between gap-2 rounded-lg bg-clay-50 border border-clay-200 p-2.5 text-xs text-clay-700">
          <span>{quote.couponError}</span>
          <button
            type="button"
            onClick={() => setCoupon('')}
            className="shrink-0 font-semibold underline underline-offset-2 hover:text-clay-900"
          >
            Clear
          </button>
        </div>
      )}

      {/* Dropdown Toggle Banner when closed */}
      {!offersOpen && offers.length > 0 && (
        <button
          type="button"
          onClick={() => setOffersOpen(true)}
          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-sand-300 bg-sand-50/50 hover:bg-sand-50 text-xs text-ink-700 font-medium transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-brand-600 shrink-0" />
            <span>View available offers &amp; coupons ({offers.length})</span>
          </span>
          <span className="flex items-center gap-1 font-semibold text-brand-600 shrink-0">
            Show <ChevronDown className="size-3.5" />
          </span>
        </button>
      )}

      {/* Dropdown Content when open */}
      {offersOpen && offers.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-sand-200/80 mt-2">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-semibold text-ink-700 flex items-center gap-1.5">
              <Sparkles className="size-3 text-brand-600" />
              Available Coupons ({offers.length}):
            </span>
            <button
              type="button"
              onClick={() => setOffersOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800 cursor-pointer"
            >
              Hide <ChevronUp className="size-3.5" />
            </button>
          </div>
          {offers.map((o) => {
            const minMet = !o.min_order || subtotal >= Number(o.min_order);
            const needed = Number(o.min_order) - subtotal;
            return (
              <div
                key={o.code}
                className={cx(
                  'flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors',
                  minMet ? 'border-dashed border-sand-300 bg-sand-50/50 hover:bg-sand-50' : 'border-dashed border-sand-200 bg-sand-50/20 opacity-80'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold tracking-wider text-xs text-ink-900 bg-white border border-sand-200 px-2 py-0.5 rounded shadow-2xs">
                      {o.code}
                    </span>
                    <span className="text-xs font-semibold text-brand-700">
                      {o.type === 'percent' ? `${o.value}% OFF` : `₹${o.value} OFF`}
                    </span>
                  </div>
                  {o.description && (
                    <p className="mt-1 truncate text-xs text-ink-600">{o.description}</p>
                  )}
                  {Number(o.min_order) > 0 && (
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {minMet ? (
                        `Valid on orders above ${inr(o.min_order)}`
                      ) : (
                        <span className="text-clay-600 font-medium">Add {inr(needed)} more to use this</span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => applyDirect(o.code)}
                  className="shrink-0 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-600 hover:text-white transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
