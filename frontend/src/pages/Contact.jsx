import { useState } from 'react';
import { ChevronDown, Clock, Mail, MapPin, Phone } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { email, maxLength, minLength, onlyDigits, phone, required, useValidation } from '../lib/validation';
import Reveal from '../components/Reveal';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { Alert, Button, Field, PageHeader, usePageTitle } from '../components/ui';

const RULES = {
  name: [required('Enter your name'), minLength(2, 'Enter your name')],
  email: [required('Enter your email so we can reply'), email()],
  phone: [phone('Enter a 10-digit mobile number, or leave this empty')],
  subject: [required('Add a short subject'), minLength(3, 'Add a short subject')],
  message: [required('Write your message'), minLength(10, 'Please write a few more words so we can help'), maxLength(3000)],
};

function ContactForm() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', subject: '', message: '' });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const v = useValidation(RULES, form);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === 'phone' ? onlyDigits(e.target.value, 10) : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!v.check()) return;
    setBusy(true);
    try {
      const d = await api.post('/contact', { ...form, name: form.name.trim(), email: form.email.trim() });
      setStatus({ tone: 'success', text: d.message });
      setForm((f) => ({ ...f, subject: '', message: '' }));
      v.reset();
    } catch (err) {
      v.setServerErrors(err.fields);
      if (!Object.keys(err.fields || {}).length) setStatus({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
      <h2 className="text-2xl font-medium sm:col-span-2">Send us a message</h2>
      {status && <Alert tone={status.tone} className="sm:col-span-2">{status.text}</Alert>}
      <Field label="Your name" required value={form.name} onChange={set('name')} {...v.bind('name')} autoComplete="name" />
      <Field label="Email address" required type="email" value={form.email} onChange={set('email')} {...v.bind('email')} autoComplete="email" />
      <Field label="Phone (optional)" type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} {...v.bind('phone')} autoComplete="tel-national" placeholder="10-digit number" />
      <Field label="Subject" required value={form.subject} onChange={set('subject')} {...v.bind('subject')} />
      <Field className="sm:col-span-2" label="Message" required as="textarea" rows={5} value={form.message} onChange={set('message')} {...v.bind('message')} hint={`For B2B and bulk enquiries, tell us the products and quantities you need. ${form.message.length}/3000`} />
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">Send message</Button>
      </div>
    </form>
  );
}

export default function Contact() {
  usePageTitle('Contact us');
  const { settings } = useShop();
  const faqs = settings.faqs || [];

  const details = [
    settings.contact_phone && { icon: Phone, label: 'Call us', value: settings.contact_phone, href: `tel:${settings.contact_phone.replace(/\s/g, '')}` },
    settings.contact_whatsapp && { icon: WhatsAppIcon, label: 'WhatsApp', value: 'Chat with us', href: `https://wa.me/${settings.contact_whatsapp.replace(/\D/g, '')}`, whatsapp: true },
    settings.contact_email && { icon: Mail, label: 'Email', value: settings.contact_email, href: `mailto:${settings.contact_email}` },
    settings.business_hours && { icon: Clock, label: 'Working hours', value: settings.business_hours },
    settings.contact_address && { icon: MapPin, label: 'Visit us', value: settings.contact_address },
  ].filter(Boolean);

  return (
    <>
      <PageHeader eyebrow="We are happy to help" title="Contact us" description="Questions about an order, a product or a bulk enquiry? Our team in Ooty will get back to you within one business day." />

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[380px_1fr] lg:gap-16 lg:py-16">
        <ul className="space-y-6">
          {details.map(({ icon: Icon, label, value, href, whatsapp }, i) => (
            <Reveal as="li" key={label} delay={i * 80} className="flex gap-4">
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${whatsapp ? 'bg-[#25D366] text-white' : 'bg-brand-50 text-brand-600'}`}>
                <Icon className={whatsapp ? 'size-6' : 'size-5'} strokeWidth={1.7} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-wider text-ink-400 uppercase">{label}</p>
                {href ? (
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-[17px] font-medium hover:text-brand-600">{value}</a>
                ) : (
                  <p className="text-[17px] leading-relaxed">{value}</p>
                )}
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal delay={150}><ContactForm /></Reveal>
      </div>

      {faqs.length > 0 && (
        <section id="faq" className="scroll-mt-28 border-t border-sand-200 bg-white">
          <div className="container-page max-w-3xl py-16 lg:py-20">
            <p className="eyebrow mb-3 text-center">Helpful answers</p>
            <h2 className="section-title text-center">Frequently asked questions</h2>
            <div className="mt-10 divide-y divide-sand-200 border-y border-sand-200">
              {faqs.map((faq) => (
                <details key={faq.q} className="group">
                  <summary className="flex min-h-14 list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <ChevronDown className="size-5 shrink-0 text-ink-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="pr-8 pb-5 leading-relaxed text-ink-500">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
