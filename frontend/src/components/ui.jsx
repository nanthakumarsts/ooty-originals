import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff, Loader2, Minus, Plus, X } from 'lucide-react';
import { discountPercent, inr } from '../lib/format';
import TextReveal from './TextReveal';

export const cx = (...classes) => classes.filter(Boolean).join(' ');

/** Sets the browser tab title for the current page. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Sannara` : 'Sannara — Authentic Nilgiri Products';
  }, [title]);
}

export function Button({ variant = 'primary', size, loading, className, children, as: Tag = 'button', ...props }) {
  return (
    <Tag
      {...props}
      className={cx('btn', `btn-${variant}`, size && `btn-${size}`, className)}
      {...(Tag === 'button' ? { type: props.type || 'button', disabled: props.disabled || loading } : {})}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Tag>
  );
}

/** Labelled input with inline error text. Pass `as="textarea"` or `as="select"` for other controls. */
export function Field({ label, error, hint, as: Tag = 'input', className, children, type, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {props.required && <span className="text-clay-600" aria-hidden> *</span>}
      </label>
      <div className="relative">
        <Tag
          id={id}
          className={cx('input', isPassword && 'pr-12', Tag === 'select' && 'appearance-none pr-10')}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        >
          {children}
        </Tag>
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 hover:text-ink-900"
          >
            {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        )}
        {Tag === 'select' && <ChevronRight className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 rotate-90 text-ink-400" aria-hidden />}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-clay-600">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Alert({ tone = 'error', children, className }) {
  const tones = {
    error: 'border-clay-600/25 bg-clay-50 text-clay-600',
    success: 'border-brand-200 bg-brand-50 text-brand-700',
    info: 'border-sand-300 bg-sand-100 text-ink-700',
    warn: 'border-[#e8cf9c] bg-[#fdf6e7] text-[#7a5510]',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm leading-relaxed', tones[tone], className)}>
      {children}
    </div>
  );
}

const TONES = {
  green: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-[#fdf6e7] text-[#7a5510] ring-[#e8cf9c]',
  blue: 'bg-[#edf4fb] text-[#1f4f82] ring-[#c5daee]',
  violet: 'bg-[#f3effa] text-[#54398f] ring-[#d6caee]',
  red: 'bg-clay-50 text-clay-600 ring-[#f0c9c1]',
  gray: 'bg-sand-100 text-ink-700 ring-sand-300',
};

export function Badge({ tone = 'gray', children, className }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', TONES[tone], className)}>{children}</span>;
}

export function Price({ price, compare, from, size = 'md', className }) {
  const off = discountPercent(price, compare);
  const sizes = { sm: 'text-[15px]', md: 'text-base', lg: 'text-3xl font-display' };
  return (
    <div className={cx('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cx('font-semibold text-ink-900', sizes[size])}>
        {from && <span className="mr-1 text-sm font-normal text-ink-500">From</span>}
        {inr(price)}
      </span>
      {off > 0 && (
        <>
          <span className="text-sm text-ink-400 line-through">{inr(compare)}</span>
          <span className="text-sm font-semibold text-clay-600">{off}% off</span>
        </>
      )}
    </div>
  );
}

/** − / + buttons with a number in the middle that can also be typed straight in. */
export function QuantityStepper({ value, onChange, max = 20, size = 'md', disabled }) {
  const box = size === 'sm' ? 'size-9' : 'size-11';
  // what is in the box while typing; it may be empty or out of range for a moment
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const clamp = (n) => Math.max(1, Math.min(max, n));
  /** Use the typed number (kept between 1 and the most that can be bought); an empty box goes back to the old number. */
  const commit = (raw = text) => {
    const n = parseInt(raw, 10);
    const next = Number.isFinite(n) ? clamp(n) : value;
    setText(String(next));
    if (next !== value) onChange(next);
  };
  // a moment after the last key press the typed number is used, so there is nothing extra to press
  useEffect(() => {
    if (text === '' || text === String(value)) return undefined;
    const timer = setTimeout(() => commit(text), 700);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cx('inline-flex items-center rounded-full border border-sand-300 bg-white focus-within:border-brand-600', disabled && 'opacity-50')}>
      <button type="button" className={cx(box, 'flex items-center justify-center rounded-full text-ink-700 hover:bg-sand-100 disabled:opacity-35')} onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="Decrease quantity">
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onFocus={(e) => e.target.select()}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + 1)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 1)); }
        }}
        aria-label={`Quantity, 1 to ${max}`}
        title={`Type a quantity (1 to ${max})`}
        className={cx(size === 'sm' ? 'h-9' : 'h-11', 'w-10 rounded-md bg-transparent text-center text-[15px] font-semibold tabular-nums text-ink-900 outline-none focus-visible:outline-none')}
      />
      <button type="button" className={cx(box, 'flex items-center justify-center rounded-full text-ink-700 hover:bg-sand-100 disabled:opacity-35')} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li><Link to="/" className="inline-flex min-h-8 items-center hover:text-ink-900">Home</Link></li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-ink-300" aria-hidden />
            {item.to ? <Link to={item.to} className="inline-flex min-h-8 items-center hover:text-ink-900">{item.label}</Link> : <span className="text-ink-900" aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <header className="border-b border-sand-200 bg-sand-100/60">
      <div className="container-page py-10 sm:py-14">
        {eyebrow && <p className="eyebrow mb-3 animate-rise">{eyebrow}</p>}
        <TextReveal as="h1" immediate delay={80} text={title} className="text-4xl font-medium sm:text-5xl" />
        {description && <p className="mt-3 max-w-2xl animate-rise text-lg text-ink-500" style={{ animationDelay: '160ms' }}>{description}</p>}
        {children}
      </div>
    </header>
  );
}

export function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      {Icon && (
        <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon className="size-7" strokeWidth={1.6} aria-hidden />
        </span>
      )}
      <h2 className="text-2xl font-medium">{title}</h2>
      {description && <p className="mt-2 text-ink-500">{description}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading', className }) {
  return (
    <div className={cx('flex items-center justify-center py-20 text-brand-600', className)} role="status">
      <Loader2 className="size-7 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** A panel that slides in from the right edge (filters, quick views). */
export function Drawer({ open, onClose, title, children, footer }) {
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
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink-900/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col bg-white shadow-lift">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sand-200 px-5">
          <h2 className="text-xl font-medium">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn -mr-2"><X className="size-5" aria-hidden /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-sand-200 p-4">{footer}</div>}
      </div>
    </div>
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
      <div className="absolute inset-0 animate-fade-in bg-ink-900/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className={cx('relative max-h-[92dvh] w-full animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-6 shadow-lift sm:rounded-3xl sm:p-8', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-medium">{title}</h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="icon-btn -mt-1.5 -mr-2 shrink-0">
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
