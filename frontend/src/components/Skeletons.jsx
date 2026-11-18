import { RotateCw, WifiOff } from 'lucide-react';
import { ProductGridSkeleton } from './product/ProductCard';
import { cx } from './ui';

/**
 * Grey "ghost" versions of pages, shown while the real content is on its way.
 * Each one has roughly the shape of what replaces it, so the page does not jump when it arrives.
 */

const Lines = ({ widths = ['w-full', 'w-11/12', 'w-4/5'], className }) => (
  <div className={cx('space-y-3', className)}>
    {widths.map((w, i) => <div key={i} className={cx('skeleton h-4', w)} />)}
  </div>
);

const Loading = ({ children, className, label = 'Loading' }) => (
  <div role="status" aria-busy="true" className={className}>
    <span className="sr-only">{label}…</span>
    {children}
  </div>
);

/** A whole page: heading, a line of text, then cards (or paragraphs with `text`). */
export function PageSkeleton({ text = false }) {
  return (
    <Loading className="container-page min-h-[60vh] py-10 sm:py-14">
      <div className="skeleton h-4 w-28" />
      <div className="skeleton mt-4 h-10 w-3/5 max-w-md" />
      <div className="skeleton mt-4 h-4 w-4/5 max-w-xl" />
      {text ? <TextSkeleton className="mt-10" /> : <div className="mt-10"><ProductGridSkeleton count={4} /></div>}
    </Loading>
  );
}

/** Paragraphs of an article (About, policy pages). */
export function TextSkeleton({ className }) {
  return (
    <div className={cx('max-w-2xl space-y-8', className)} aria-hidden>
      <Lines widths={['w-full', 'w-full', 'w-11/12', 'w-3/4']} />
      <Lines widths={['w-full', 'w-10/12', 'w-full', 'w-2/3']} />
      <Lines widths={['w-11/12', 'w-full', 'w-1/2']} />
    </div>
  );
}

/** A list of boxed rows: orders, saved addresses. */
export function RowsSkeleton({ count = 3, thumb = true }) {
  return (
    <Loading className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-5">
          {thumb && <div className="skeleton size-16 shrink-0 rounded-xl" />}
          <div className="min-w-0 flex-1">
            <div className="skeleton h-4 w-2/5" />
            <div className="skeleton mt-3 h-3.5 w-3/5" />
            <div className="skeleton mt-2 h-3.5 w-1/4" />
          </div>
          <div className="skeleton hidden h-9 w-24 rounded-full sm:block" />
        </div>
      ))}
    </Loading>
  );
}

const SummarySkeleton = () => (
  <div className="rounded-3xl border border-sand-200 bg-white p-6">
    <div className="skeleton h-6 w-1/2" />
    <div className="mt-6 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex justify-between gap-6"><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-16" /></div>
      ))}
    </div>
    <div className="mt-6 flex justify-between gap-6 border-t border-sand-200 pt-5"><div className="skeleton h-5 w-16" /><div className="skeleton h-6 w-24" /></div>
    <div className="skeleton mt-6 h-13 w-full rounded-full" />
  </div>
);

const LineItemSkeleton = () => (
  <div className="flex gap-4 py-5">
    <div className="skeleton h-28 w-24 shrink-0 rounded-xl" />
    <div className="min-w-0 flex-1">
      <div className="skeleton h-4 w-3/5" />
      <div className="skeleton mt-3 h-3.5 w-1/4" />
      <div className="skeleton mt-5 h-10 w-28 rounded-full" />
    </div>
    <div className="skeleton h-5 w-16" />
  </div>
);

/** Cart: products on the left, totals on the right. */
export function CartSkeleton() {
  return (
    <Loading className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_400px] lg:gap-14">
      <div className="divide-y divide-sand-200 border-y border-sand-200">
        <LineItemSkeleton />
        <LineItemSkeleton />
      </div>
      <SummarySkeleton />
    </Loading>
  );
}

/** Checkout: address and payment boxes on the left, the order on the right. */
export function CheckoutSkeleton() {
  return (
    <Loading className="container-page min-h-[60vh] py-8 sm:py-12">
      <div className="skeleton h-9 w-48" />
      <div className="skeleton mt-4 h-4 w-72 max-w-full" />
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-14">
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-3xl border border-sand-200 bg-white p-6">
              <div className="skeleton h-6 w-44" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="skeleton h-24 rounded-2xl" />
                <div className="skeleton h-24 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
        <SummarySkeleton />
      </div>
    </Loading>
  );
}

/** One order: status, progress, the items and the address / payment boxes. */
export function OrderSkeleton({ page = false }) {
  return (
    <Loading className={cx(page && 'container-page min-h-[60vh] py-10 sm:py-14')}>
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-4 h-9 w-64 max-w-full" />
      <div className="skeleton mt-3 h-4 w-48" />
      <div className="skeleton mt-8 h-20 w-full rounded-2xl" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="divide-y divide-sand-200 rounded-2xl border border-sand-200 bg-white px-5">
          <LineItemSkeleton />
          <LineItemSkeleton />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
      </div>
    </Loading>
  );
}

/** The big home page banner, before its text and photo are known. */
export function HeroSkeleton() {
  return (
    <Loading className="bg-brand-900" label="Loading banner">
      {/* same box as the real banner (HeroSlider), so nothing moves when it arrives */}
      <div className="container-page flex min-h-[560px] items-center py-20 sm:min-h-[640px] lg:max-h-[820px] lg:min-h-[78vh]">
        <div className="w-full">
          <div className="skeleton h-4 w-44 bg-white/15" />
          <div className="skeleton mt-6 h-12 w-11/12 max-w-2xl bg-white/15 sm:h-16" />
          <div className="skeleton mt-4 h-12 w-3/5 max-w-md bg-white/15 sm:h-16" />
          <div className="skeleton mt-7 h-4 w-full max-w-lg bg-white/10" />
          <div className="skeleton mt-3 h-4 w-4/5 max-w-md bg-white/10" />
          <div className="skeleton mt-9 h-13 w-52 rounded-full bg-white/20" />
        </div>
      </div>
    </Loading>
  );
}

/** Round category pills on the shop page. */
export function PillsSkeleton({ count = 7 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden className={cx('skeleton h-12 shrink-0 rounded-full', i % 3 === 0 ? 'w-28' : i % 3 === 1 ? 'w-36' : 'w-44')} />
      ))}
    </>
  );
}

/** Shown in place of content that could not be loaded. The page keeps trying by itself as well. */
export function LoadError({ message, onRetry, busy, className }) {
  return (
    <div role="alert" className={cx('flex flex-col items-center rounded-2xl border border-sand-200 bg-white px-6 py-10 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-sand-100 text-ink-500"><WifiOff className="size-5" aria-hidden /></span>
      <p className="mt-4 font-semibold">We couldn't load this just now</p>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{message || 'Please check your connection.'} We'll keep trying — or you can try again now.</p>
      <button type="button" onClick={onRetry} disabled={busy} className="btn btn-outline btn-sm mt-5">
        <RotateCw className={cx('size-4', busy && 'animate-spin')} aria-hidden /> Try again
      </button>
    </div>
  );
}
