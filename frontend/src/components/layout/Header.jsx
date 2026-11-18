import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, GitCompareArrows, Heart, LogOut, Package, Search, ShoppingBag, User, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { img, inr, photoFit } from '../../lib/format';
import { cx } from '../ui';

/** Hamburger that folds into an X (and back) — used for the mobile menu button. */
function MenuIcon({ open }) {
  const bar = 'absolute left-0 h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-soft';
  return (
    <span className="relative block h-[18px] w-6" aria-hidden>
      <span className={cx(bar, open ? 'top-2 rotate-45' : 'top-0')} />
      <span className={cx(bar, 'top-2', open && 'scale-x-0 opacity-0')} />
      <span className={cx(bar, open ? 'top-2 -rotate-45' : 'top-4')} />
    </span>
  );
}

function CountDot({ count }) {
  if (!count) return null;
  return (
    // keyed by the number so the badge pops whenever it changes
    <span key={count} className="absolute top-1 right-0.5 flex h-[18px] min-w-[18px] animate-pop items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] leading-none font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Search box with live product suggestions as you type. */
function SearchBox({ onDone, autoFocus, id = 'site-search' }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const q = term.trim();

  useEffect(() => {
    if (q.length < 2) {
      setResults(null);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      api.get(`/products?q=${encodeURIComponent(q)}&limit=5`).then((d) => active && setResults(d)).catch(() => {});
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const finish = () => {
    setTerm('');
    setOpen(false);
    onDone?.();
  };

  const submit = (e) => {
    e.preventDefault();
    if (!q) return;
    navigate(`/shop?q=${encodeURIComponent(q)}`);
    finish();
  };

  return (
    <form ref={box} onSubmit={submit} role="search" className="relative w-full">
      <label htmlFor={id} className="sr-only">Search products</label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        id={id}
        type="search"
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Search teas, chocolates, oils…"
        autoFocus={autoFocus}
        autoComplete="off"
        className="h-12 w-full rounded-full border border-sand-300 bg-white pr-4 pl-11 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 focus:outline-none"
      />
      {open && results && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 animate-fade-in overflow-hidden rounded-2xl border border-sand-200 bg-white p-2 shadow-lift">
          {results.items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-500">No products match “{q}”. Try a shorter word.</p>
          ) : (
            <>
              {results.items.map((p) => (
                <Link key={p.id} to={`/product/${p.slug}`} onClick={finish} className="flex items-center gap-3 rounded-xl p-2 hover:bg-sand-100">
                  <img src={img(p.image)} alt="" className="aspect-[4/5] w-10 shrink-0 rounded-md bg-sand-100 object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block text-[13px] text-ink-500">{p.hasVariants ? 'From ' : ''}{inr(p.price)}</span>
                  </span>
                </Link>
              ))}
              <button type="submit" className="mt-1 flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                See all {results.total} results
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { settings, categories, cartCount, wishlist, compare } = useShop();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // The announcement bar can be closed. We remember WHICH message was closed,
  // so a new announcement written in the admin panel shows up again.
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('oo_announcement_closed') || '';
    } catch {
      return '';
    }
  });
  const dismissAnnouncement = () => {
    setDismissed(settings.announcement);
    try {
      localStorage.setItem('oo_announcement_closed', settings.announcement);
    } catch {
      /* private mode: stays closed for this visit only */
    }
  };
  const accountRef = useRef(null);
  const megaTimer = useRef(null);

  // Close every overlay when the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setMegaOpen(false);
    setSearchOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mobile menu: the category list is a dropdown, folded away again once the menu has slid shut.
  const [catsOpen, setCatsOpen] = useState(false);
  useEffect(() => {
    if (menuOpen) {
      const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
    const timer = setTimeout(() => setCatsOpen(false), 320);
    return () => clearTimeout(timer);
  }, [menuOpen]);
  // Menu rows drift in one after another as the menu opens.
  const row = (i) => ({
    className: cx('transition-[opacity,translate] ease-soft', menuOpen ? 'translate-x-0 opacity-100 duration-500' : '-translate-x-4 opacity-0 duration-200'),
    style: { transitionDelay: menuOpen ? `${90 + i * 45}ms` : '0ms' },
  });

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen && !megaOpen) return undefined;
    const close = (e) => !accountRef.current?.contains(e.target) && setAccountOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setAccountOpen(false);
      setMegaOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen, megaOpen]);

  // The Shop menu stays open while the pointer is anywhere on the trigger or the panel;
  // a short grace period lets the pointer travel between the two without it snapping shut.
  const openMega = () => { clearTimeout(megaTimer.current); setMegaOpen(true); };
  const closeMega = () => { clearTimeout(megaTimer.current); megaTimer.current = setTimeout(() => setMegaOpen(false), 260); };
  const closeMegaNow = () => { clearTimeout(megaTimer.current); setMegaOpen(false); };
  useEffect(() => () => clearTimeout(megaTimer.current), []);

  const onShopClick = (event) => {
    // On touch screens there is no hover: the first tap opens the menu, the second goes to the shop.
    if (!megaOpen && window.matchMedia('(hover: none)').matches) {
      event.preventDefault();
      openMega();
      return;
    }
    closeMegaNow();
  };

  const signOut = () => {
    logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    cx(
      'relative flex h-full items-center gap-1 px-1 text-[15px] font-medium transition-colors duration-200 hover:text-brand-600',
      'after:absolute after:inset-x-1 after:bottom-5 after:h-0.5 after:origin-left after:rounded-full after:bg-brand-600 after:transition-transform after:duration-300 after:ease-soft',
      isActive ? 'text-brand-600 after:scale-x-100' : 'text-ink-900 after:scale-x-0 hover:after:scale-x-100'
    );

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-full focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>

      {settings.announcement && dismissed !== settings.announcement && (
        <div className="relative bg-brand-700 text-white">
          <p className="container-page py-2 pr-12 pl-12 text-center text-[13px] font-medium tracking-wide">{settings.announcement}</p>
          <button
            type="button"
            onClick={dismissAnnouncement}
            aria-label="Close announcement"
            title="Close"
            className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/15 hover:text-white sm:right-4"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <header className={cx('sticky top-0 z-50 border-b bg-cream/92 backdrop-blur-md transition-shadow duration-300', scrolled || megaOpen ? 'border-sand-200 shadow-soft' : 'border-transparent')}>
        <div className="container-page flex h-[72px] items-center gap-3 lg:h-20">
          <button type="button" className="icon-btn -ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
            <MenuIcon open={menuOpen} />
          </button>

          <Link to="/" aria-label="Ooty Originals — home" className="shrink-0">
            <img src="/images/logo.png" alt="Ooty Originals" width="430" height="256" className="h-11 w-auto lg:h-[52px]" />
          </Link>

          <nav aria-label="Main" className="ml-10 hidden h-full items-stretch gap-8 lg:flex">
            <NavLink to="/" end className={navClass}>Home</NavLink>
            {/* full header height, so the pointer never leaves the hover area on its way to the panel */}
            <div className="flex h-full items-stretch" onMouseEnter={openMega} onMouseLeave={closeMega}>
              <NavLink to="/shop" className={navClass} aria-haspopup="true" aria-expanded={megaOpen} onClick={onShopClick} onFocus={openMega}>
                Shop
                <ChevronDown className={cx('size-4 transition-transform duration-200', megaOpen && 'rotate-180')} aria-hidden />
              </NavLink>
            </div>
            <NavLink to="/about" className={navClass} onFocus={closeMegaNow}>Our Story</NavLink>
            <NavLink to="/contact" className={navClass}>Contact</NavLink>
          </nav>

          <div className="ml-auto flex items-center lg:gap-1">
            <div className="hidden w-64 xl:block xl:w-72">
              <SearchBox />
            </div>
            <button type="button" className="icon-btn xl:hidden" onClick={() => setSearchOpen((v) => !v)} aria-label="Search" aria-expanded={searchOpen}>
              {searchOpen ? <X className="size-[22px]" aria-hidden /> : <Search className="size-[22px]" aria-hidden />}
            </button>

            <Link to="/compare" className="icon-btn hidden sm:inline-flex" aria-label={`Compare, ${compare.length} products`}>
              <GitCompareArrows className="size-[22px]" aria-hidden />
              <CountDot count={compare.length} />
            </Link>
            <Link to="/wishlist" className="icon-btn hidden sm:inline-flex" aria-label={`Wishlist, ${wishlist.length} items`}>
              <Heart className="size-[22px]" aria-hidden />
              <CountDot count={wishlist.length} />
            </Link>

            <div className="relative" ref={accountRef}>
              {user ? (
                <button type="button" className="icon-btn" onClick={() => setAccountOpen((v) => !v)} aria-label="Account menu" aria-expanded={accountOpen} aria-haspopup="menu">
                  <User className="size-[22px]" aria-hidden />
                </button>
              ) : (
                <Link to="/login" className="icon-btn" aria-label="Sign in">
                  <User className="size-[22px]" aria-hidden />
                </Link>
              )}
              {accountOpen && user && (
                <div role="menu" className="absolute top-full right-0 mt-2 w-60 animate-fade-in rounded-2xl border border-sand-200 bg-white p-2 shadow-lift">
                  <div className="border-b border-sand-200 px-3 pt-2 pb-3">
                    <p className="truncate font-semibold">{user.name}</p>
                    <p className="truncate text-sm text-ink-500">{user.email}</p>
                  </div>
                  {[
                    { to: '/account', label: 'My account', icon: User },
                    { to: '/account/orders', label: 'My orders', icon: Package },
                    { to: '/wishlist', label: 'Wishlist', icon: Heart },
                  ].map(({ to, label, icon: Icon }) => (
                    <Link key={to} to={to} role="menuitem" className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-sand-100">
                      <Icon className="size-[18px] text-ink-500" aria-hidden />
                      {label}
                    </Link>
                  ))}
                  <button type="button" role="menuitem" onClick={signOut} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-clay-600 hover:bg-clay-50">
                    <LogOut className="size-[18px]" aria-hidden />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <Link to="/cart" className="icon-btn -mr-2" aria-label={`Cart, ${cartCount} items`}>
              <ShoppingBag className="size-[22px]" aria-hidden />
              <CountDot count={cartCount} />
            </Link>
          </div>
        </div>

        {searchOpen && (
          <div className="container-page animate-fade-in pb-4 xl:hidden">
            <SearchBox id="site-search-mobile" autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        )}

        {/* Shop mega menu (desktop) */}
        {megaOpen && (
          <div className="absolute inset-x-0 top-full hidden animate-fade-in border-t border-sand-200 bg-white shadow-lift lg:block" onMouseEnter={openMega} onMouseLeave={closeMega}>
            <div className="container-page grid grid-cols-[1fr_300px] gap-12 py-9">
              <div>
                <p className="eyebrow mb-4">Shop by category</p>
                <ul className="columns-3 gap-x-10">
                  {categories.map((c) => (
                    <li key={c.id} className="break-inside-avoid">
                      <Link to={`/shop?category=${c.slug}`} onClick={closeMegaNow} className="group flex min-h-11 items-center justify-between rounded-lg text-[15px] font-medium hover:text-brand-600">
                        {c.name}
                        <span className="text-xs font-normal text-ink-400">{c.product_count}</span>
                      </Link>
                      {c.children.length > 0 && (
                        <ul className="mb-2 border-l border-sand-200 pl-3">
                          {c.children.map((s) => (
                            <li key={s.id}>
                              <Link to={`/shop?category=${c.slug}&sub=${s.slug}`} onClick={closeMegaNow} className="group flex min-h-8 items-center justify-between pr-2 text-sm text-ink-500 hover:text-brand-600">
                                <span>{s.name}</span>
                                <span className="text-xs font-normal text-ink-400">{s.product_count}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex gap-3 border-t border-sand-200 pt-6">
                  {[['/shop', 'All products'], ['/shop?tag=bestseller', 'Best sellers'], ['/shop?tag=new', 'New arrivals'], ['/shop?tag=sale', 'On offer']].map(([to, label]) => (
                    <Link key={to} to={to} onClick={closeMegaNow} className="chip">{label}</Link>
                  ))}
                </div>
              </div>
              {categories[0] && (
                <Link to={`/shop?category=${categories[0].slug}`} onClick={closeMegaNow} className="group relative min-h-72 overflow-hidden rounded-2xl bg-sand-200">
                  <img src={img(categories[0].image)} alt="" loading="lazy" className={`absolute inset-0 size-full object-cover transition-transform duration-500 ease-soft group-hover:scale-105 ${photoFit(categories[0].image)}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/10 to-transparent" />
                  <div className="absolute inset-x-5 bottom-5 text-white">
                    <p className="font-display text-2xl">{categories[0].name}</p>
                    {categories[0].description && <p className="line-clamp-2 text-sm text-white/85">{categories[0].description}</p>}
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile drawer — always in the page so it can slide shut as smoothly as it slides open */}
      <div
        className={cx('fixed inset-0 z-[80] transition-[visibility] lg:hidden', menuOpen ? 'visible duration-0' : 'invisible duration-300')}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <div className={cx('absolute inset-0 bg-ink-900/50 transition-opacity ease-soft', menuOpen ? 'opacity-100 duration-[400ms]' : 'opacity-0 duration-300')} onClick={() => setMenuOpen(false)} aria-hidden />
        <div className={cx('absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-cream shadow-lift transition-transform ease-soft will-change-transform', menuOpen ? 'translate-x-0 duration-[400ms]' : '-translate-x-full duration-300')}>
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-sand-200 px-5">
            <Link to="/" onClick={() => setMenuOpen(false)} className="inline-block">
              <img src="/images/logo.png" alt="Ooty Originals" className="h-10 w-auto" />
            </Link>
            <button type="button" className="icon-btn -mr-2" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <MenuIcon open={menuOpen} />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <div {...row(0)}><Link to="/" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center text-lg font-medium">Home</Link></div>
            <div {...row(1)}><Link to="/shop" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center text-lg font-medium">Shop all</Link></div>
            <div {...row(2)}>
              <button
                type="button"
                onClick={() => setCatsOpen((v) => !v)}
                aria-expanded={catsOpen}
                aria-controls="mobile-categories"
                className="flex min-h-12 w-full items-center justify-between text-left text-lg font-medium"
              >
                Categories
                <ChevronDown className={cx('size-5 text-ink-500 transition-transform duration-300 ease-soft', catsOpen && 'rotate-180')} aria-hidden />
              </button>
              <div id="mobile-categories" className={cx('grid transition-[grid-template-rows] duration-300 ease-soft', catsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="overflow-hidden" inert={!catsOpen}>
                  <div className={cx('mb-2 rounded-2xl bg-white px-3 py-1.5 transition-opacity duration-300', catsOpen ? 'opacity-100' : 'opacity-0')}>
                    {categories.map((c) => (
                      <Link key={c.id} to={`/shop?category=${c.slug}`} onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center gap-3 text-[15px] text-ink-700">
                        <img src={img(c.image)} alt="" loading="lazy" className={`size-9 shrink-0 rounded-full object-cover ${photoFit(c.image)}`} />
                        <span className="leading-tight">{c.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div {...row(3)}><Link to="/about" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center text-lg font-medium">Our Story</Link></div>
            <div {...row(4)}><Link to="/contact" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center text-lg font-medium">Contact</Link></div>
            <div {...row(5)}>
              <Link to="/compare" onClick={() => setMenuOpen(false)} className="flex min-h-12 items-center justify-between text-lg font-medium">
                Compare {compare.length > 0 && <span className="text-sm text-ink-500">{compare.length}</span>}
              </Link>
            </div>
          </nav>
          <div className="shrink-0 border-t border-sand-200 p-5">
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/account" onClick={() => setMenuOpen(false)} className="btn btn-outline flex-1">My account</Link>
                <button type="button" onClick={() => { setMenuOpen(false); signOut(); }} className="btn btn-ghost text-clay-600">Sign out</button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-primary flex-1">Sign in</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="btn btn-outline flex-1">Register</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
