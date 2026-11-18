import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Search, X } from 'lucide-react';

export const cx = (...classes) => classes.filter(Boolean).join(' ');

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Sannara Admin` : 'Sannara Admin';
  }, [title]);
}

/** Debounces a fast-changing value (search boxes). */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function Button({ variant = 'primary', size, loading, className, children, ...props }) {
  return (
    <button {...props} type={props.type || 'button'} disabled={props.disabled || loading} className={cx('btn', `btn-${variant}`, size && `btn-${size}`, className)}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, as: Tag = 'input', className, children, type, prefix, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {props.required && <span className="text-clay-600" aria-hidden> *</span>}
        </label>
      )}
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400">{prefix}</span>}
        <Tag
          id={id}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          className={cx('input', prefix && 'pl-7', isPassword && 'pr-10', Tag === 'select' && 'appearance-none pr-9')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        >
          {children}
        </Tag>
        {isPassword && (
          <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 hover:text-ink-900">
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
        {Tag === 'select' && <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[13px] text-clay-600">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[13px] text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-[13px] text-ink-500">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-brand-600' : 'bg-line-strong')}
      >
        <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}

const TONES = {
  green: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-[#fdf6e7] text-[#7a5510] ring-[#e8cf9c]',
  blue: 'bg-[#edf4fb] text-[#1f4f82] ring-[#c5daee]',
  violet: 'bg-[#f3effa] text-[#54398f] ring-[#d6caee]',
  red: 'bg-clay-50 text-clay-600 ring-[#f0c9c1]',
  gray: 'bg-canvas text-ink-700 ring-line-strong',
};

export function Badge({ tone = 'gray', children }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', TONES[tone])}>{children}</span>;
}

export function Alert({ tone = 'error', children, className }) {
  const tones = {
    error: 'border-[#f0c9c1] bg-clay-50 text-clay-600',
    success: 'border-brand-200 bg-brand-50 text-brand-700',
    info: 'border-line-strong bg-canvas text-ink-700',
    warn: 'border-[#e8cf9c] bg-[#fdf6e7] text-[#7a5510]',
  };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-3.5 py-2.5 text-sm', tones[tone], className)}>{children}</div>;
}

export function Spinner({ className }) {
  return (
    <div className={cx('flex items-center justify-center py-16 text-brand-600', className)} role="status">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Ghost rows shown in place of a table or list while it loads. */
export function TableSkeleton({ rows = 6 }) {
  return (
    <div role="status" aria-busy="true" className="divide-y divide-line">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="skeleton size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className={cx('skeleton h-3.5', i % 2 ? 'w-2/5' : 'w-1/2')} />
            <div className="skeleton mt-2 h-3 w-1/4" />
          </div>
          <div className="skeleton hidden h-3.5 w-20 sm:block" />
          <div className="skeleton hidden h-6 w-24 rounded-full md:block" />
          <div className="skeleton h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Ghost version of a whole admin page: title, then a few cards. */
export function PageSkeleton({ cards = 2 }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="skeleton h-8 w-56" />
          <div className="skeleton mt-3 h-4 w-80 max-w-full" />
        </div>
        <div className="skeleton h-10 w-32 rounded-lg" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-5 w-44" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="skeleton h-11" />
              <div className="skeleton h-11" />
              <div className="skeleton h-24 sm:col-span-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, children, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="text-[1.7rem] leading-tight font-medium">{title}</h1>
        {description && <p className="mt-1 text-ink-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input pl-9" />
    </div>
  );
}

export function Select({ value, onChange, options, label, className }) {
  return (
    <div className={cx('relative', className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="input appearance-none pr-9">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
    </div>
  );
}

/**
 * Table footer: "Showing 21–40 of 95", numbered pages with Previous / Next,
 * and a "Go to page" box once there are many pages.
 */
export function Pagination({ page, pages, total, perPage = 20, onChange }) {
  const [jump, setJump] = useState('');
  if (!total) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const numbers = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) numbers.push(i);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }

  const go = (target) => {
    const next = Math.min(pages, Math.max(1, Number(target) || 1));
    if (next !== page) onChange(next);
  };
  const button = 'flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150';

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-4 py-3">
      <p className="text-sm text-ink-500">
        Showing <span className="font-semibold text-ink-900 tabular-nums">{from}–{to}</span> of <span className="font-semibold text-ink-900 tabular-nums">{total}</span>
      </p>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className={cx(button, 'border border-line-strong bg-white hover:bg-canvas disabled:opacity-40')} disabled={page <= 1} onClick={() => go(page - 1)}>
            <ChevronLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Previous</span><span className="sr-only sm:hidden">Previous page</span>
          </button>
          {numbers.map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-ink-400" aria-hidden>…</span>
            ) : (
              <button key={n} type="button" onClick={() => go(n)} aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} className={cx(button, 'tabular-nums', n === page ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-canvas')}>
                {n}
              </button>
            )
          )}
          <button type="button" className={cx(button, 'border border-line-strong bg-white hover:bg-canvas disabled:opacity-40')} disabled={page >= pages} onClick={() => go(page + 1)}>
            <span className="hidden sm:inline">Next</span><span className="sr-only sm:hidden">Next page</span> <ChevronRight className="size-4" aria-hidden />
          </button>
          {pages > 7 && (
            <form className="ml-2 flex items-center gap-2 text-sm text-ink-500" onSubmit={(e) => { e.preventDefault(); go(jump); setJump(''); }}>
              <label htmlFor="jump-to-page">Go to</label>
              <input id="jump-to-page" type="number" min="1" max={pages} value={jump} onChange={(e) => setJump(e.target.value)} placeholder={String(page)} className="input h-9 min-h-0 w-16 px-2 text-center" />
            </form>
          )}
        </div>
      )}
    </nav>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink-900/45" onClick={onClose} aria-hidden />
      <div className={cx('relative max-h-[92dvh] w-full animate-pop overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl sm:p-6', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-medium">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn -mt-1 -mr-1.5"><X className="size-5" aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Are you sure?" dialog for destructive actions. */
export function Confirm({ open, onClose, onConfirm, title, children, confirmLabel = 'Delete', busy }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm leading-relaxed text-ink-500">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
