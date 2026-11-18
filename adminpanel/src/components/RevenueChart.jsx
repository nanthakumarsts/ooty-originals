import { useEffect, useMemo, useRef, useState } from 'react';
import { inr, inrCompact } from '../lib/format';

const H = 260;
const PAD = { top: 16, right: 14, bottom: 28, left: 52 };

/** Rounds the axis maximum up to a tidy number (1, 2, 2.5, 5 × 10ⁿ). */
function niceMax(value) {
  if (value <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((m) => m >= value);
}

const shortDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Daily revenue as a single-series line. One measure, one axis; hover (or focus + arrow keys)
 * for the exact value, and a table view sits behind the toggle.
 */
export default function RevenueChart({ series }) {
  const [active, setActive] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const [W, setW] = useState(720);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);

  // Draw at the real pixel width so axis text stays readable on phones.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [asTable]);

  const { points, ticks, line, area, xLabels } = useMemo(() => {
    const max = niceMax(Math.max(...series.map((d) => d.revenue), 0));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (series.length > 1 ? (i / (series.length - 1)) * innerW : innerW / 2);
    const y = (v) => PAD.top + innerH - (v / max) * innerH;
    const pts = series.map((d, i) => ({ ...d, x: x(i), y: y(d.revenue) }));
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(innerW / 90))));
    return {
      points: pts,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => ({ value: max * t, y: y(max * t) })),
      line: path,
      area: `${path} L${pts[pts.length - 1].x.toFixed(1)},${y(0)} L${pts[0].x.toFixed(1)},${y(0)} Z`,
      xLabels: pts.filter((_, i) => i % every === 0 || i === pts.length - 1).filter((p, i, arr) => i === arr.length - 1 || arr[arr.length - 1].x - p.x > 56),
    };
  }, [series, W]);

  const onMove = (e) => {
    const box = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].x - px) < Math.abs(points[nearest].x - px)) nearest = i;
    setActive(nearest);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowRight') setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? points.length) - 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const point = active != null ? points[active] : null;
  const total = series.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button type="button" onClick={() => setAsTable((v) => !v)} className="btn btn-ghost btn-sm text-brand-600" aria-pressed={asTable}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
          <table className="table">
            <thead><tr><th>Date</th><th className="text-right">Orders</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>
              {[...series].reverse().map((d) => (
                <tr key={d.day}><td>{shortDay(d.day)}</td><td className="text-right tabular-nums">{d.orders}</td><td className="text-right tabular-nums">{inr(d.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" ref={wrapRef}>
          <svg
            ref={svgRef}
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block touch-pan-y overflow-visible"
            role="img"
            aria-label={`Daily revenue for the last ${series.length} days, totalling ${inr(total)}. Use the arrow keys to read each day.`}
            tabIndex={0}
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKey}
            onBlur={() => setActive(null)}
          >
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#125f2e" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#125f2e" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t.value}>
                <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#e7e3d9" strokeWidth="1" strokeDasharray={t.value === 0 ? undefined : '3 4'} />
                <text x={PAD.left - 10} y={t.y + 4} textAnchor="end" fontSize="12" fill="#7e8c8f">{inrCompact(t.value)}</text>
              </g>
            ))}
            {xLabels.map((p, i) => (
              <text key={p.day} x={p.x} y={H - 6} textAnchor={i === xLabels.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize="12" fill="#7e8c8f">{shortDay(p.day)}</text>
            ))}
            <path d={area} fill="url(#revenue-fill)" />
            <path d={line} fill="none" stroke="#125f2e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {point && (
              <g pointerEvents="none">
                <line x1={point.x} x2={point.x} y1={PAD.top} y2={H - PAD.bottom} stroke="#a9b4b6" strokeWidth="1" />
                <circle cx={point.x} cy={point.y} r="5" fill="#125f2e" stroke="#ffffff" strokeWidth="2" />
              </g>
            )}
          </svg>
          {point && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-max rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-lift"
              style={{ left: `${(point.x / W) * 100}%`, transform: `translateX(${point.x > W * 0.7 ? 'calc(-100% - 12px)' : '12px'})` }}
              role="status"
            >
              <p className="text-xs text-ink-500">{shortDay(point.day)}</p>
              <p className="font-semibold tabular-nums">{inr(point.revenue)}</p>
              <p className="text-xs text-ink-500">{point.orders} {point.orders === 1 ? 'order' : 'orders'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
