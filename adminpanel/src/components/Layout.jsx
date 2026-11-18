import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, FileText, FolderTree, Images, Inbox, LayoutDashboard, LogOut, Menu, Package, RotateCcw, Settings2, ShoppingCart, Tag, UserCog, Users, X } from 'lucide-react';
import api from '../lib/api';
import { useApp } from '../context/AppContext';
import { cx } from './ui';

const NAV = [
  {
    heading: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    heading: 'Store',
    items: [
      { to: '/orders', label: 'Orders', icon: ShoppingCart, badge: 'to_fulfil' },
      { to: '/returns', label: 'Returns & refunds', icon: RotateCcw, badge: 'pending_returns' },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/categories', label: 'Categories', icon: FolderTree },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/coupons', label: 'Offers & coupons', icon: Tag },
    ],
  },
  {
    heading: 'Website',
    items: [
      { to: '/content/banners', label: 'Home banners', icon: Images },
      { to: '/content/settings', label: 'Site settings', icon: Settings2 },
      { to: '/content/pages', label: 'Pages', icon: FileText },
      { to: '/messages', label: 'Messages', icon: Inbox, badge: 'unread_messages' },
    ],
  },
];

function Sidebar({ counts, onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-brand-900 text-white">
      <Link to="/" onClick={onNavigate} className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5" aria-label="Dashboard">
        <img src="/images/logo-white.png" alt="Ooty Originals" className="h-9 w-auto" />
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-brand-200 uppercase">Admin</span>
      </Link>
      <nav aria-label="Main" className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {NAV.map((group) => (
          <div key={group.heading} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">{group.heading}</p>
            {group.items.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cx('mb-0.5 flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors duration-150', isActive ? 'bg-white text-brand-800' : 'text-white/80 hover:bg-white/10 hover:text-white')
                }
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {badge && counts[badge] > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f2b84b] px-1.5 text-[11px] font-bold text-brand-900" aria-label={`${counts[badge]} need attention`}>
                    {counts[badge]}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}

function UserMenu() {
  const { admin, logout } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
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

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-canvas">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white uppercase">{admin.name.charAt(0)}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-semibold">{admin.name}</span>
          <span className="block text-xs text-ink-500">Administrator</span>
        </span>
        <ChevronDown className={cx('size-4 text-ink-400 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-50 mt-2 w-60 animate-pop rounded-xl border border-line bg-white p-1.5 shadow-lift">
          <div className="border-b border-line px-3 pt-1.5 pb-2.5">
            <p className="truncate text-sm font-semibold">{admin.name}</p>
            <p className="truncate text-[13px] text-ink-500">{admin.email}</p>
          </div>
          <Link to="/account" role="menuitem" className="mt-1 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-canvas">
            <UserCog className="size-4 text-ink-500" aria-hidden /> My account
          </Link>
          <button type="button" role="menuitem" onClick={() => { logout(); navigate('/login'); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-clay-600 hover:bg-clay-50">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function TopLink({ to, icon: Icon, count, label }) {
  return (
    <Link to={to} className="icon-btn relative size-10" aria-label={`${label}${count ? `, ${count}` : ''}`} title={label}>
      <Icon className="size-5" aria-hidden />
      {count > 0 && <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-600 px-1 text-[10px] leading-none font-bold text-white">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    // refresh the "needs attention" badges as the admin moves around
    api.get('/summary').then(setCounts).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar counts={counts} />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur sm:gap-3 sm:px-6 lg:px-8">
        <button type="button" className="icon-btn -ml-1.5 size-10 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <Menu className="size-5" aria-hidden />
        </button>
        <img src="/images/logo.png" alt="Ooty Originals" className="h-8 w-auto lg:hidden" />
        <p className="hidden text-sm text-ink-500 lg:block">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <TopLink to="/orders?status=confirmed" icon={ShoppingCart} count={counts.to_fulfil} label="Orders to fulfil" />
          <TopLink to="/returns" icon={RotateCcw} count={counts.pending_returns} label="Pending returns" />
          <TopLink to="/messages" icon={Inbox} count={counts.unread_messages} label="Unread messages" />
          <span className="mx-1 hidden h-7 w-px bg-line sm:block" aria-hidden />
          <UserMenu />
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-ink-900/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-lift">
            <Sidebar counts={counts} onNavigate={() => setOpen(false)} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10">
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
