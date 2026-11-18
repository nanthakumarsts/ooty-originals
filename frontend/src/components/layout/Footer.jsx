import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import api from '../../lib/api';
import { useShop } from '../../context/ShopContext';
import { useToast } from '../../context/ToastContext';

// The newsletter sign-up is switched off. Change this to true to show it in the footer again.
const SHOW_NEWSLETTER = false;

function Newsletter() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api.post('/newsletter', { email });
      toast.success(d.message);
      setEmail('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 flex max-w-md items-center rounded-full bg-white/10 p-1.5 ring-1 ring-white/20 focus-within:ring-white/60">
      <label htmlFor="newsletter-email" className="sr-only">Email address</label>
      <input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        autoComplete="email"
        className="h-11 min-w-0 flex-1 bg-transparent px-4 text-base text-white placeholder:text-white/60 focus:outline-none"
      />
      <button type="submit" disabled={busy} aria-label="Subscribe" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 transition-colors duration-200 hover:bg-brand-100 disabled:opacity-60">
        <ArrowRight className="size-5" aria-hidden />
      </button>
    </form>
  );
}

export default function Footer() {
  const { settings, categories } = useShop();
  const socials = [
    { href: settings.social_instagram, label: 'Instagram', icon: Instagram },
    { href: settings.social_facebook, label: 'Facebook', icon: Facebook },
    { href: settings.social_youtube, label: 'YouTube', icon: Youtube },
  ].filter((s) => s.href);

  const linkClass = 'inline-flex min-h-9 items-center text-[15px] text-white/75 transition-colors duration-200 hover:text-white';

  return (
    <footer className="mt-24 bg-brand-900 text-white">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1.3fr_2fr] lg:gap-20">
        <div>
          <img src="/images/logo-white.png" alt="Ooty Originals" width="430" height="256" className="h-14 w-auto" />
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/75">{settings.footer_note}</p>
          {SHOW_NEWSLETTER && (
            <>
              <p className="mt-8 font-display text-xl">{settings.newsletter_title || 'Newsletter'}</p>
              {settings.newsletter_text && <p className="mt-1 text-sm text-white/70">{settings.newsletter_text}</p>}
              <Newsletter />
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <nav aria-label="Shop">
            <p className="mb-3 text-sm font-semibold tracking-wider text-white/55 uppercase">Shop</p>
            <ul>
              {categories.slice(0, 8).map((c) => (
                <li key={c.id}><Link to={`/shop?category=${c.slug}`} className={linkClass}>{c.name}</Link></li>
              ))}
              <li><Link to="/shop" className={linkClass}>All products</Link></li>
            </ul>
          </nav>
          <nav aria-label="Help">
            <p className="mb-3 text-sm font-semibold tracking-wider text-white/55 uppercase">Help</p>
            <ul>
              <li><Link to="/about" className={linkClass}>Our story</Link></li>
              <li><Link to="/contact" className={linkClass}>Contact us</Link></li>
              <li><Link to="/contact#faq" className={linkClass}>FAQs</Link></li>
              <li><Link to="/account/orders" className={linkClass}>Track my order</Link></li>
              <li><Link to="/refund-policy" className={linkClass}>Refunds &amp; returns</Link></li>
              <li><Link to="/privacy-policy" className={linkClass}>Privacy policy</Link></li>
              <li><Link to="/terms-and-conditions" className={linkClass}>Terms &amp; conditions</Link></li>
            </ul>
          </nav>
          <div className="col-span-2 sm:col-span-1">
            <p className="mb-3 text-sm font-semibold tracking-wider text-white/55 uppercase">Visit us</p>
            <ul className="space-y-3 text-[15px] text-white/75">
              {settings.contact_address && (
                <li className="flex gap-3"><MapPin className="mt-1 size-[18px] shrink-0 text-brand-300" aria-hidden /><span>{settings.contact_address}</span></li>
              )}
              {settings.contact_phone && (
                <li className="flex gap-3"><Phone className="mt-1 size-[18px] shrink-0 text-brand-300" aria-hidden /><a href={`tel:${settings.contact_phone.replace(/\s/g, '')}`} className="-my-1.5 inline-flex min-h-9 items-center hover:text-white">{settings.contact_phone}</a></li>
              )}
              {settings.contact_email && (
                <li className="flex gap-3"><Mail className="mt-1 size-[18px] shrink-0 text-brand-300" aria-hidden /><a href={`mailto:${settings.contact_email}`} className="-my-1.5 inline-flex min-h-9 items-center hover:text-white">{settings.contact_email}</a></li>
              )}
            </ul>
            {socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {socials.map(({ href, label, icon: Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white hover:text-brand-700">
                    <Icon className="size-5" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-sm text-white/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Ooty Originals · Herdsmen Business Ventures Pvt. Ltd.</p>
          <p>
            Developed by{' '}
            <a
              href="https://saitechnosolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/80 underline underline-offset-4 transition-colors hover:text-white"
            >
              Sai Techno Solutions (P) Ltd
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
