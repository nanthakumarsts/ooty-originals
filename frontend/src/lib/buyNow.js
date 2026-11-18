/*
  "Buy it now" skips the cart: the chosen item is remembered here for the checkout page
  (in sessionStorage, so it survives the sign-in redirect but not a new visit).
  The shopper's cart is left exactly as it was.
*/
const KEY = 'oo_buy_now';

export function setBuyNow(item) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(item));
  } catch {
    /* storage unavailable — checkout will fall back to the cart */
  }
}

export function getBuyNow() {
  try {
    const item = JSON.parse(sessionStorage.getItem(KEY));
    return item && item.productId ? item : null;
  } catch {
    return null;
  }
}

export function clearBuyNow() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
