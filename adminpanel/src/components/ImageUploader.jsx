import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { img } from '../lib/format';
import { useApp } from '../context/AppContext';
import { cx } from './ui';

/**
 * Upload and arrange images. `value` is an array of stored paths; the first one is the cover.
 * With max = 1 it behaves as a single-image picker.
 */
export default function ImageUploader({ value, onChange, max = 8, folder = 'products', square }) {
  const { toast } = useApp();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files) => {
    const room = max - value.length;
    const picked = [...files].slice(0, Math.max(room, max === 1 ? 1 : 0));
    if (!picked.length) return;
    const form = new FormData();
    picked.forEach((file) => form.append('images', file));
    setBusy(true);
    try {
      const d = await api.post(`/uploads?folder=${folder}`, form);
      onChange(max === 1 ? d.urls.slice(0, 1) : [...value, ...d.urls]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const move = (index, delta) => {
    const next = [...value];
    const target = index + delta;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const ratio = square ? 'aspect-square' : 'aspect-[4/5]';

  return (
    <div className="flex flex-wrap gap-3">
      {value.map((url, i) => (
        <div key={url} className={cx('group relative w-28 overflow-hidden rounded-lg border border-line bg-canvas', ratio)}>
          <img src={img(url)} alt={`Image ${i + 1}`} className="size-full object-cover" />
          {i === 0 && max > 1 && <span className="absolute top-1.5 left-1.5 rounded bg-ink-900/85 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">Cover</span>}
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-ink-900/70 to-transparent p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            {max > 1 && (
              <>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="flex size-7 items-center justify-center rounded bg-white text-ink-900 disabled:opacity-40"><ArrowLeft className="size-3.5" aria-hidden /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move later" className="flex size-7 items-center justify-center rounded bg-white text-ink-900 disabled:opacity-40"><ArrowRight className="size-3.5" aria-hidden /></button>
              </>
            )}
            <button type="button" onClick={() => onChange(value.filter((u) => u !== url))} aria-label="Remove image" className="flex size-7 items-center justify-center rounded bg-white text-clay-600"><Trash2 className="size-3.5" aria-hidden /></button>
          </div>
        </div>
      ))}
      {(value.length < max || max === 1) && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={cx('flex w-28 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong bg-white text-xs font-semibold text-ink-500 transition-colors hover:border-brand-600 hover:text-brand-600', ratio, max === 1 && value.length && 'hidden')}
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
          {busy ? 'Uploading…' : 'Add image'}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple={max > 1} hidden onChange={(e) => upload(e.target.files)} />
    </div>
  );
}
