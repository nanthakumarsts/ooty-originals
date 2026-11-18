import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useApp } from '../context/AppContext';
import { Button, Field, PageHeader, PageSkeleton, Toggle, usePageTitle } from '../components/ui';

// The storefront newsletter sign-up is switched off, so its settings are hidden too.
const SHOW_NEWSLETTER = false;

export default function SiteSettings() {
  usePageTitle('Site settings');
  const { toast } = useApp();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/settings').then((d) => setForm({ ...d.settings, promises: d.settings.promises || [], about_values: d.settings.about_values || [] })).catch((err) => toast.error(err.message));
  }, [toast]);

  if (!form) return <PageSkeleton />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  // lists such as the home page highlights: a fixed number of title + text rows
  const setListItem = (list, index, key, value) =>
    setForm((f) => {
      const rows = [...(f[list] || [])];
      while (rows.length <= index) rows.push({ title: '', text: '' });
      rows[index] = { ...rows[index], [key]: value };
      return { ...f, [list]: rows };
    });
  const setFaq = (index, key, value) => setForm((f) => ({ ...f, faqs: f.faqs.map((row, i) => (i === index ? { ...row, [key]: value } : row)) }));

  const submit = async (e) => {
    e.preventDefault();
    const problems = {};
    const isUrl = (value) => !value || /^https?:\/\/\S+\.\S+/.test(value.trim());
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contact_email.trim())) problems.contact_email = 'Enter a valid email address';
    if (form.contact_whatsapp && String(form.contact_whatsapp).replace(/\D/g, '').length < 10) problems.contact_whatsapp = 'Enter the full number with country code, e.g. 919487654990';
    if (form.shipping_fee === '' || Number(form.shipping_fee) < 0 || Number.isNaN(Number(form.shipping_fee))) problems.shipping_fee = 'Enter 0 or more';
    if (form.free_shipping_min === '' || Number(form.free_shipping_min) < 0 || Number.isNaN(Number(form.free_shipping_min))) problems.free_shipping_min = 'Enter 0 or more';
    for (const key of ['social_instagram', 'social_facebook', 'social_youtube']) if (!isUrl(form[key])) problems[key] = 'Enter the full link, starting with https://';
    setErrors(problems);
    if (Object.keys(problems).length) {
      toast.error('Some settings need fixing — see the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      const filled = (rows) => (rows || []).filter((row) => row.title && row.title.trim()).map((row) => ({ title: row.title.trim(), text: (row.text || '').trim() }));
      const payload = { ...form, faqs: form.faqs.filter((f) => f.q.trim() && f.a.trim()), promises: filled(form.promises), about_values: filled(form.about_values) };
      // the home banners have their own page — never overwrite them from here
      delete payload.hero_slides;
      const saved = (await api.put('/settings', payload)).settings;
      setForm({ ...saved, promises: saved.promises || [], about_values: saved.about_values || [] });
      toast.success('Settings saved — the storefront is updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title="Site settings" description="Text and details shown across the storefront.">
        <Button type="submit" loading={busy}>Save settings</Button>
      </PageHeader>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="card-title">Announcement bar</h2>
          <Field label="Message" value={form.announcement || ''} onChange={set('announcement')} hint="The strip at the very top of every page. Leave empty to hide it." />
        </section>

        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="card-title">Delivery &amp; payment</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery charge" type="number" min="0" prefix="₹" value={form.shipping_fee || '0'} onChange={set('shipping_fee')} error={errors.shipping_fee} hint="Enter 0 for free delivery on every order." />
              <Field label="Free delivery above" type="number" min="0" prefix="₹" value={form.free_shipping_min || '0'} onChange={set('free_shipping_min')} error={errors.free_shipping_min} hint="Orders at or above this amount ship free. 0 = no threshold." />
            </div>
            <Toggle label="Cash on Delivery" description="Let shoppers pay when the order arrives." checked={form.cod_enabled !== '0'} onChange={(v) => setForm((f) => ({ ...f, cod_enabled: v ? '1' : '0' }))} />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="card-title">Contact details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" value={form.contact_phone || ''} onChange={set('contact_phone')} />
              <Field label="WhatsApp number" value={form.contact_whatsapp || ''} onChange={set('contact_whatsapp')} error={errors.contact_whatsapp} hint="With country code, digits only — e.g. 919487654990" />
            </div>
            <Field label="Email" type="email" value={form.contact_email || ''} onChange={set('contact_email')} error={errors.contact_email} />
            <Field label="Address" as="textarea" rows={2} value={form.contact_address || ''} onChange={set('contact_address')} />
            <Field label="Working hours" value={form.business_hours || ''} onChange={set('business_hours')} />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="card-title">Social links &amp; footer</h2>
            <Field label="Instagram" type="url" value={form.social_instagram || ''} onChange={set('social_instagram')} error={errors.social_instagram} placeholder="https://" />
            <Field label="Facebook" type="url" value={form.social_facebook || ''} onChange={set('social_facebook')} error={errors.social_facebook} placeholder="https://" />
            <Field label="YouTube" type="url" value={form.social_youtube || ''} onChange={set('social_youtube')} error={errors.social_youtube} placeholder="https://" />
            <Field label="Footer note" as="textarea" rows={2} value={form.footer_note || ''} onChange={set('footer_note')} />
          </section>
        </div>

        <section className="card p-5 xl:col-span-2">
          <h2 className="card-title">Home page — highlights</h2>
          <p className="text-[13px] text-ink-500">The four points shown under the main banner.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-line p-3">
                <input className="input" aria-label={`Highlight ${i + 1} title`} placeholder={`Highlight ${i + 1} — title`} maxLength={60} value={form.promises[i]?.title || ''} onChange={(e) => setListItem('promises', i, 'title', e.target.value)} />
                <input className="input" aria-label={`Highlight ${i + 1} text`} placeholder="Short line under the title" maxLength={120} value={form.promises[i]?.text || ''} onChange={(e) => setListItem('promises', i, 'text', e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="card-title">Home page — our story</h2>
          <Field label="Heading" value={form.story_title || ''} onChange={set('story_title')} hint="Leave empty to hide this whole section." />
          <Field label="Text" as="textarea" rows={6} value={form.story_text || ''} onChange={set('story_text')} hint="Leave an empty line between paragraphs." />
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <Field label="Big number" value={form.story_stat || ''} onChange={set('story_stat')} placeholder="1000s" />
            <Field label="What it counts" value={form.story_stat_text || ''} onChange={set('story_stat_text')} />
          </div>
        </section>

        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="card-title">About page</h2>
            <Field label="Line under the title" value={form.about_tagline || ''} onChange={set('about_tagline')} />
            <div>
              <span className="label">What we stand for</span>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[160px_1fr]">
                    <input className="input" aria-label={`Value ${i + 1} title`} placeholder="Title" maxLength={60} value={form.about_values[i]?.title || ''} onChange={(e) => setListItem('about_values', i, 'title', e.target.value)} />
                    <input className="input" aria-label={`Value ${i + 1} text`} placeholder="One sentence" maxLength={240} value={form.about_values[i]?.text || ''} onChange={(e) => setListItem('about_values', i, 'text', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {SHOW_NEWSLETTER && (
            <section className="card space-y-4 p-5">
              <h2 className="card-title">Newsletter (footer)</h2>
              <Field label="Heading" value={form.newsletter_title || ''} onChange={set('newsletter_title')} />
              <Field label="Text" value={form.newsletter_text || ''} onChange={set('newsletter_text')} />
            </section>
          )}
        </div>

        <section className="card p-5 xl:col-span-2">
          <h2 className="card-title">Product page — delivery &amp; returns</h2>
          <p className="text-[13px] text-ink-500">Shown on every product page.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Delivery — short line" value={form.delivery_short || ''} onChange={set('delivery_short')} placeholder="Tamil Nadu in 1–2 days" />
            <Field label="Returns — short line" value={form.returns_short || ''} onChange={set('returns_short')} placeholder="Within 14 days" />
            <Field label="Delivery details" as="textarea" rows={4} value={form.delivery_info || ''} onChange={set('delivery_info')} hint="One point per line." />
            <Field label="Returns details" as="textarea" rows={4} value={form.returns_info || ''} onChange={set('returns_info')} hint="One point per line." />
          </div>
        </section>

        <section className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="card-title">Frequently asked questions</h2>
              <p className="text-[13px] text-ink-500">Shown on the Contact page.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, faqs: [...f.faqs, { q: '', a: '' }] }))}><Plus className="size-4" aria-hidden /> Add question</Button>
          </div>
          <div className="mt-4 space-y-3">
            {form.faqs.map((faq, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1.6fr_36px]">
                <textarea className="input" rows={2} aria-label={`Question ${i + 1}`} placeholder="Question" value={faq.q} onChange={(e) => setFaq(i, 'q', e.target.value)} />
                <textarea className="input" rows={3} aria-label={`Answer ${i + 1}`} placeholder="Answer" value={faq.a} onChange={(e) => setFaq(i, 'a', e.target.value)} />
                <button type="button" onClick={() => setForm((f) => ({ ...f, faqs: f.faqs.filter((_, idx) => idx !== i) }))} aria-label={`Remove question ${i + 1}`} className="icon-btn justify-self-end hover:bg-clay-50 hover:text-clay-600"><Trash2 className="size-4" aria-hidden /></button>
              </div>
            ))}
            {!form.faqs.length && <p className="text-sm text-ink-500">No questions yet.</p>}
          </div>
        </section>
      </div>
    </form>
  );
}
