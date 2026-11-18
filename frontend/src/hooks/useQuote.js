import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useShop } from '../context/ShopContext';

/**
 * Asks the server to price a set of items (live prices, stock, coupon, delivery).
 * By default it prices the cart; pass `items` to price something else, such as a
 * single "Buy it now" item. Re-runs whenever the items or the coupon change.
 */
export default function useQuote(items) {
  const { cart, coupon, syncCart } = useShop();
  const lines = items || cart;
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .post('/cart/quote', { items: lines, couponCode: coupon || null })
        .then((d) => {
          if (!active) return;
          setQuote(d);
          setError('');
          if (!items) syncCart(d.items); // only the real cart is tidied up
        })
        .catch((err) => active && setError(err.message))
        .finally(() => active && setLoading(false));
    }, 180); // small debounce so rapid +/- clicks make one request
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lines, items, coupon, syncCart]);

  return { quote, loading, error };
}
