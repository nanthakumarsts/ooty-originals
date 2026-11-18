import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

/**
 * Everything the shopper carries around the site:
 *   cart     – kept in the browser, priced by the server on the cart/checkout pages
 *   wishlist – saved to the account (needs sign-in)
 *   compare  – kept in the browser, up to 4 products
 *   site     – settings and the category tree, loaded once
 */
const ShopContext = createContext(null);

const MAX_QTY = 20;
const MAX_COMPARE = 4;

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

export function ShopProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [settings, setSettings] = useState({});
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => read('oo_cart', []));
  const [coupon, setCoupon] = useState(() => localStorage.getItem('oo_coupon') || '');
  const [compare, setCompare] = useState(() => read('oo_compare', []));
  const [wishlist, setWishlist] = useState([]);

  // false until the first answer arrives — pages show placeholders meanwhile
  const [settingsReady, setSettingsReady] = useState(false);
  const [categoriesReady, setCategoriesReady] = useState(false);

  // Site settings and categories are needed on every page. If the first try fails (server
  // restarting, weak signal) keep asking until they arrive instead of leaving the site empty.
  useEffect(() => {
    let active = true;
    const missing = { settings: true, categories: true };
    const busy = { settings: false, categories: false };
    const fetchOne = (key, url, done) => {
      if (!missing[key] || busy[key]) return;
      busy[key] = true;
      api
        .get(url)
        .then((d) => {
          missing[key] = false;
          if (active) done(d);
        })
        .catch(() => {})
        .finally(() => { busy[key] = false; });
    };
    const load = () => {
      fetchOne('settings', '/content/settings', (d) => { setSettings(d.settings); setSettingsReady(true); });
      fetchOne('categories', '/categories', (d) => { setCategories(d.categories); setCategoriesReady(true); });
    };
    const again = () => !document.hidden && load();
    load();
    const timer = setInterval(again, 6000);
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, []);

  useEffect(() => localStorage.setItem('oo_cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('oo_compare', JSON.stringify(compare)), [compare]);
  useEffect(() => (coupon ? localStorage.setItem('oo_coupon', coupon) : localStorage.removeItem('oo_coupon')), [coupon]);

  useEffect(() => {
    if (!user) {
      setWishlist([]);
      return;
    }
    api.get('/wishlist').then((d) => setWishlist(d.items)).catch(() => {});
  }, [user]);

  // ---- Cart ----
  const addToCart = useCallback(
    (product, variantId = null, quantity = 1) => {
      setCart((items) => {
        const existing = items.find((i) => i.productId === product.id && (i.variantId || null) === (variantId || null));
        if (existing) {
          return items.map((i) => (i === existing ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i));
        }
        return [...items, { productId: product.id, variantId: variantId || null, quantity: Math.min(MAX_QTY, quantity) }];
      });
      toast.success(`${product.name} added to cart`, { action: { label: 'View cart', to: '/cart' } });
    },
    [toast]
  );

  const setQuantity = useCallback((productId, variantId, quantity) => {
    setCart((items) =>
      items.map((i) => (i.productId === productId && (i.variantId || null) === (variantId || null) ? { ...i, quantity: Math.max(1, Math.min(MAX_QTY, quantity)) } : i))
    );
  }, []);

  const removeFromCart = useCallback((productId, variantId) => {
    setCart((items) => items.filter((i) => !(i.productId === productId && (i.variantId || null) === (variantId || null))));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCoupon('');
  }, []);

  /** Drop cart lines the server no longer recognises (deleted products or options). */
  const syncCart = useCallback((quotedItems) => {
    const valid = new Set(quotedItems.map((i) => i.key));
    setCart((items) => {
      const kept = items.filter((i) => valid.has(`${i.productId}:${i.variantId || 0}`));
      return kept.length === items.length ? items : kept;
    });
  }, []);

  // ---- Wishlist ----
  const wishlistIds = useMemo(() => new Set(wishlist.map((p) => p.id)), [wishlist]);

  const toggleWishlist = useCallback(
    async (product) => {
      if (!user) {
        toast.error('Sign in to save items to your wishlist');
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
      try {
        if (wishlistIds.has(product.id)) {
          const d = await api.delete(`/wishlist/${product.id}`);
          setWishlist(d.items);
          toast.success('Removed from wishlist');
        } else {
          const d = await api.post('/wishlist', { productId: product.id });
          setWishlist(d.items);
          toast.success('Saved to wishlist', { action: { label: 'View', to: '/wishlist' } });
        }
      } catch (err) {
        toast.error(err.message);
      }
    },
    [user, wishlistIds, toast, navigate, location]
  );

  // ---- Compare ----
  const toggleCompare = useCallback(
    (product) => {
      if (compare.includes(product.id)) {
        setCompare(compare.filter((id) => id !== product.id));
        toast.success('Removed from compare');
      } else if (compare.length >= MAX_COMPARE) {
        toast.error(`You can compare up to ${MAX_COMPARE} products`, { action: { label: 'Compare', to: '/compare' } });
      } else {
        setCompare([...compare, product.id]);
        toast.success('Added to compare', { action: { label: 'Compare', to: '/compare' } });
      }
    },
    [compare, toast]
  );

  const value = useMemo(
    () => ({
      settings,
      settingsReady,
      categories,
      categoriesReady,
      cart,
      // number of different products in the cart — 20 packs of one tea still counts as 1
      cartCount: cart.length,
      coupon,
      setCoupon,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      syncCart,
      wishlist,
      wishlistIds,
      toggleWishlist,
      compare,
      setCompare,
      toggleCompare,
    }),
    [settings, settingsReady, categories, categoriesReady, cart, coupon, addToCart, setQuantity, removeFromCart, clearCart, syncCart, wishlist, wishlistIds, toggleWishlist, compare, toggleCompare]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
