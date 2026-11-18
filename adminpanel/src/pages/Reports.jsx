import { useEffect, useRef, useState } from 'react';
import { BarChart3, Boxes, ChevronDown, Download, FileSpreadsheet, FileText, ReceiptText, ShoppingBasket, Users } from 'lucide-react';
import api from '../lib/api';
import { formatDate, inr } from '../lib/format';
import { useApp } from '../context/AppContext';
import { Alert, Button, EmptyState, PageHeader, TableSkeleton, cx, usePageTitle } from '../components/ui';

const ICONS = { sales: ReceiptText, products: ShoppingBasket, stock: Boxes, customers: Users };

const pad = (n) => String(n).padStart(2, '0');
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Ready-made periods so most reports are two clicks. */
function presets() {
  const today = new Date();
  const back = (n) => { const d = new Date(); d.setDate(today.getDate() - n); return d; };
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  return [
    { id: 'today', label: 'Today', from: day(today), to: day(today) },
    { id: '7', label: 'Last 7 days', from: day(back(6)), to: day(today) },
    { id: '30', label: 'Last 30 days', from: day(back(29)), to: day(today) },
    { id: 'month', label: 'This month', from: day(monthStart), to: day(today) },
    { id: 'last-month', label: 'Last month', from: day(lastMonthStart), to: day(lastMonthEnd) },
    { id: 'year', label: 'This year', from: `${today.getFullYear()}-01-01`, to: day(today) },
  ];
}

/** One "Download" button that opens a small menu to choose the file type. */
function DownloadMenu({ onPick, busy, disabled }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (format) => {
    setOpen(false);
    onPick(format);
  };

  const formats = [
    { id: 'pdf', icon: FileText, title: 'PDF', text: 'Ready to print or share' },
    { id: 'xlsx', icon: FileSpreadsheet, title: 'Excel', text: 'All columns, for further work' },
  ];

  return (
    <div className="relative" ref={box}>
      <Button onClick={() => setOpen((v) => !v)} loading={!!busy} disabled={disabled || !!busy} aria-haspopup="menu" aria-expanded={open}>
        {!busy && <Download className="size-4" aria-hidden />}
        {busy ? 'Preparing…' : 'Download'}
        <ChevronDown className={cx('size-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </Button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-30 mt-2 w-64 animate-pop rounded-xl border border-line bg-white p-1.5 shadow-lift">
          {formats.map(({ id, icon: Icon, title, text }) => (
            <button key={id} type="button" role="menuitem" onClick={() => choose(id)} className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-canvas">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="size-[18px]" aria-hidden /></span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-[13px] text-ink-500">{text}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const show = (value, type) => {
  if (type === 'money') return inr(value);
  if (type === 'int') return Number(value || 0).toLocaleString('en-IN');
  if (type === 'date') return formatDate(value);
  if (type === 'datetime') return formatDate(value, true);
  return value || '—';
};

export default function Reports() {
  usePageTitle('Reports');
  const { toast } = useApp();
  const options = presets();
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('sales');
  const [preset, setPreset] = useState('30');
  const [range, setRange] = useState({ from: options[2].from, to: options[2].to });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    api.get('/reports').then((d) => setTypes(d.reports)).catch(() => {});
  }, []);

  const query = `from=${range.from}&to=${range.to}`;
  useEffect(() => {
    if (!range.from || !range.to) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    api
      .get(`/reports/${type}?${query}`)
      .then((d) => active && setReport(d))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [type, query, range.from, range.to]);

  const pick = (option) => {
    setPreset(option.id);
    setRange({ from: option.from, to: option.to });
  };

  const download = async (format) => {
    setDownloading(format);
    try {
      const response = await api.get(`/reports/${type}?${query}&format=${format}`, { responseType: 'blob' });
      const name = /filename="([^"]+)"/.exec(response.headers['content-disposition'] || '')?.[1] || `report.${format}`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(response.data);
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${format === 'xlsx' ? 'Excel' : 'PDF'} report downloaded`);
    } catch {
      toast.error('Could not create the report. Please try again.');
    } finally {
      setDownloading('');
    }
  };

  const current = types.find((t) => t.type === type);
  const dated = current ? current.dated : true;

  return (
    <>
      <PageHeader title="Reports" description="Pick a report and a period, check the preview, then download it.">
        <DownloadMenu onPick={download} busy={downloading} disabled={!report} />
      </PageHeader>

      {/* 1. Which report */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Report">
        {types.map((t) => {
          const Icon = ICONS[t.type] || BarChart3;
          const active = t.type === type;
          return (
            <button key={t.type} type="button" role="radio" aria-checked={active} onClick={() => setType(t.type)} className={cx('card flex items-start gap-3 p-4 text-left transition-all duration-150', active ? 'border-brand-600 ring-1 ring-brand-600' : 'hover:border-line-strong hover:shadow-lift')}>
              <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600')}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t.title}</span>
                <span className="block text-[13px] leading-snug text-ink-500">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Which period */}
      <div className="card mt-4 p-4">
        {dated ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div>
              <p className="label">Period</p>
              <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                  <button key={o.id} type="button" onClick={() => pick(o)} aria-pressed={preset === o.id} className={cx('min-h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors', preset === o.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink-700 hover:border-ink-400')}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label htmlFor="report-from" className="label">From</label>
                <input id="report-from" type="date" value={range.from} max={range.to} onChange={(e) => { setPreset('custom'); setRange({ ...range, from: e.target.value }); }} className="input w-40" />
              </div>
              <div>
                <label htmlFor="report-to" className="label">To</label>
                <input id="report-to" type="date" value={range.to} min={range.from} onChange={(e) => { setPreset('custom'); setRange({ ...range, to: e.target.value }); }} className="input w-40" />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">This report shows the stock as it is right now, so it has no period.</p>
        )}
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}

      {/* 3. Preview */}
      {!report && loading ? (
        <TableSkeleton />
      ) : report ? (
        <div className={cx('transition-opacity duration-150', loading && 'opacity-50')}>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {report.summary.map((item) => (
              <div key={item.label} className="card p-4">
                <p className="text-[13px] text-ink-500">{item.label}</p>
                <p className="mt-1 font-display text-2xl leading-tight font-medium tabular-nums">{show(item.value, item.type)}</p>
              </div>
            ))}
          </div>

          <section className="card mt-4 overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-3">
              <h2 className="card-title">{report.title}</h2>
              <p className="text-[13px] text-ink-500">
                {report.periodLabel} · {report.total} {report.total === 1 ? 'row' : 'rows'}
                {report.total > report.rows.length && ` (showing the first ${report.rows.length} — downloads include all)`}
              </p>
            </div>
            {!report.rows.length ? (
              <EmptyState icon={BarChart3} title="Nothing to report for this period" description="Try a longer period. Downloads will still work, with just the summary." />
            ) : (
              <div className="max-h-[520px] overflow-auto">
                <table className="table">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {report.columns.map((c) => (
                        <th key={c.key} className={cx('bg-canvas', (c.type === 'money' || c.type === 'int') && 'text-right')}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, i) => (
                      <tr key={i}>
                        {report.columns.map((c) => (
                          <td key={c.key} className={cx('whitespace-nowrap', (c.type === 'money' || c.type === 'int') && 'text-right tabular-nums', c.type === 'money' && 'font-medium')}>{show(row[c.key], c.type)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="mt-3 text-[13px] text-ink-400">Excel includes every column. The PDF leaves out a few wide columns (such as email and phone) so the table fits the page, and writes amounts as “Rs”.</p>
        </div>
      ) : null}
    </>
  );
}
