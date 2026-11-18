import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ArrowUp, Heart, Home, LayoutGrid, ShoppingBag, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import WhatsAppIcon from '../WhatsAppIcon';
import { cx } from '../ui';

/**
 * Helpers that follow the shopper around:
 *  - a bottom tab bar on phones and tablets (thumb-reach navigation)
 *  - a WhatsApp help button
 *  - a back-to-top button once the page has been scrolled
 */
export default function MobileBar() {
  const { user } = useAuth();
  const { cartCount, wishlist, settings } = useShop();
  const [scrolled, setScrolled] = useState(false);
  // cart and checkout have their own bar pinned above the tabs on phones
  const { pathname } = useLocation();
  const lifted = pathname === '/cart' || pathname === '/checkout';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tabs = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/shop', label: 'Shop', icon: LayoutGrid },
    { to: '/wishlist', label: 'Wishlist', icon: Heart, count: wishlist.length },
    { to: '/cart', label: 'Cart', icon: ShoppingBag, count: cartCount },
    { to: user ? '/account' : '/login', label: user ? 'Account' : 'Sign in', icon: User },
  ];

  const floating = 'flex size-11 items-center justify-center rounded-full shadow-lift transition-all duration-300 ease-soft hover:-translate-y-0.5';

  return (
    <>
      <div className={cx('fixed right-4 z-40 flex flex-col gap-2.5 transition-[bottom] duration-300 lg:right-6 lg:bottom-6', lifted ? 'bottom-40' : 'bottom-20')}>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          tabIndex={scrolled ? 0 : -1}
          className={cx(floating, 'border border-sand-200 bg-white text-ink-900', scrolled ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0')}
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
        {settings.contact_whatsapp && (
          <a
            href={`https://wa.me/${settings.contact_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi Ooty Originals, I need some help.')}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            title="Chat with us on WhatsApp"
            className={cx(floating, 'bg-[#25D366] text-white hover:bg-[#1FB855]')}
          >
            <WhatsAppIcon className="size-6" />
          </a>
        )}
      </div>

      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end, count }) => (
            <li key={label}>
              <NavLink to={to} end={end} className={({ isActive }) => cx('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', isActive ? 'text-brand-600' : 'text-ink-500')}>
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                      {count > 0 && (
                        <span key={count} className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 animate-pop items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] leading-none font-bold text-white">{count > 99 ? '99+' : count}</span>
                      )}
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
