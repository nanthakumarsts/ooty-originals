import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatDate } from '../lib/format';
import { useApp } from '../context/AppContext';
import RichEditor from '../components/RichEditor';
import { Button, Field, PageHeader, PageSkeleton, cx, usePageTitle } from '../components/ui';

export default function Pages() {
  usePageTitle('Pages');
  const { toast } = useApp();
  const [pages, setPages] = useState(null);
  const [slug, setSlug] = useState('');
  const [form, setForm] = useState({ title: '', content: '' });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/pages').then((d) => {
      setPages(d.pages);
      if (d.pages[0]) {
        setSlug(d.pages[0].slug);
        setForm({ title: d.pages[0].title, content: d.pages[0].content || '' });
      }
    }).catch((err) => toast.error(err.message));
  }, [toast]);

  if (!pages) return <PageSkeleton />;
  const current = pages.find((p) => p.slug === slug);

  const choose = (page) => {
    if (dirty && !window.confirm('You have unsaved changes on this page. Discard them?')) return;
    setSlug(page.slug);
    setForm({ title: page.title, content: page.content || '' });
    setDirty(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const d = await api.put(`/pages/${slug}`, form);
      setPages((list) => list.map((p) => (p.slug === slug ? d.page : p)));
      setDirty(false);
      toast.success('Page saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Pages" description="Edit the About page and your store policies.">
        <Button onClick={save} loading={busy} disabled={!dirty}>Save page</Button>
      </PageHeader>

      <div className="grid items-start gap-5 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Pages" className="card no-scrollbar flex gap-1 overflow-x-auto p-2 lg:flex-col">
          {pages.map((p) => (
            <button key={p.slug} type="button" onClick={() => choose(p)} aria-current={p.slug === slug ? 'page' : undefined} className={cx('min-h-10 shrink-0 rounded-lg px-3 text-left text-sm font-medium whitespace-nowrap transition-colors', p.slug === slug ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-canvas')}>
              {p.title}
            </button>
          ))}
        </nav>

        {current && (
          <section className="card space-y-4 p-5">
            <Field label="Page title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setDirty(true); }} />
            <div>
              <span className="label">Content</span>
              <RichEditor label="Page content" value={form.content} resetKey={slug} minHeight={380} onChange={(html) => { setForm((f) => ({ ...f, content: html })); setDirty(true); }} />
            </div>
            <p className="text-[13px] text-ink-400">Last updated {formatDate(current.updated_at, true)}</p>
          </section>
        )}
      </div>
    </>
  );
}
