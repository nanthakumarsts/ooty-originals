const { round2 } = require('./helpers');
const config = require('../config/env');
const shiprocket = require('../services/shiprocketService');
const { calculatePackage, extractWeightInKg } = require('./shippingPackage');

const MAX_QTY = 20;

async function quoteOrderShipping(parcel, merchandiseTotal, freeShipping) {
  let declaredValue = merchandiseTotal;
  // Coverage and COD fees can change when shipping moves the order into a higher value band.
  for (let attempt = 0; attempt < 8; attempt++) {
    const quote = await shiprocket.getLiveShippingRate({ ...parcel, declaredValue });
    if (!quote?.available || quote.rate == null || freeShipping) return quote;
    const orderTotal = round2(merchandiseTotal + quote.rate);
    if (orderTotal === declaredValue) return quote;
    declaredValue = orderTotal;
  }
  return { available: false, message: 'Unable to confirm the delivery charge. Please try again.' };
}

/**
 * Check a coupon against a subtotal. Returns { coupon, discount } or { error }.
 * `run` is a query function (pool or transaction bound).
 */
async function applyCoupon(run, code, subtotal, userId = null) {
  if (!code) return { coupon: null, discount: 0 };
  const [coupon] = await run('SELECT * FROM coupons WHERE code = ? LIMIT 1', [String(code).trim().toUpperCase()]);
  const now = new Date();
  if (!coupon || !coupon.is_active) return { error: 'This coupon code is not valid' };
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { error: 'This coupon is not active yet' };
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return { error: 'This coupon has expired' };
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return { error: 'This coupon has been fully redeemed' };
  if (subtotal < coupon.min_order) {
    return { error: `Add items worth ₹${round2(coupon.min_order - subtotal).toLocaleString('en-IN')} more to use ${coupon.code}` };
  }
  if (coupon.per_user_limit != null) {
    if (!userId) {
      return { error: 'Please sign in to use this coupon' };
    }
    const [usage] = await run(
      "SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND coupon_code = ? AND status <> 'cancelled'",
      [userId, coupon.code]
    );
    if (usage && usage.count >= coupon.per_user_limit) {
      return { error: `You have reached the usage limit (${coupon.per_user_limit} time${coupon.per_user_limit > 1 ? 's' : ''}) for this coupon` };
    }
  }
  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.max_discount != null) discount = Math.min(discount, coupon.max_discount);
  discount = round2(Math.min(discount, subtotal));
  return { coupon: { code: coupon.code, description: coupon.description, type: coupon.type, value: coupon.value }, discount };
}

/**
 * Price a cart from scratch using current database values — the client's prices are never trusted.
 * @param run        query function
 * @param rawItems   [{ productId, variantId, quantity }]
 * @param couponCode optional coupon
 * @param lock       when true, rows are locked (use inside a transaction while placing an order)
 * @param userId     optional customer id for per-user coupon limits
 * @param shippingOptions optional { pincode, paymentMethod } for live Shiprocket courier rate calculation
 */
async function buildQuote(run, rawItems, couponCode, lock = false, userId = null, shippingOptions = {}) {
  const wanted = (rawItems || []).filter((i) => i && Number(i.productId) > 0);
  const empty = { items: [], subtotal: 0, discount: 0, shipping: 0, shippingDetails: null, total: 0, coupon: null, couponError: null, hasIssues: false, itemCount: 0 };
  if (!wanted.length) return empty;

  const ids = [...new Set(wanted.map((i) => Number(i.productId)))];
  const suffix = lock ? ' FOR UPDATE' : '';
  const products = await run(
    `SELECT p.id, p.name, p.slug, p.price, p.compare_price, p.stock, p.is_active,
            p.package_length, p.package_breadth, p.package_height, p.package_weight,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image
       FROM products p WHERE p.id IN (?)${suffix}`,
    [ids]
  );
  const variants = await run(`SELECT * FROM product_variants WHERE product_id IN (?) ORDER BY sort_order, id${suffix}`, [ids]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantsByProduct = new Map();
  for (const v of variants) {
    if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
    variantsByProduct.get(v.product_id).push(v);
  }

  const items = [];
  const seen = new Set();
  for (const raw of wanted) {
    const product = productMap.get(Number(raw.productId));
    if (!product) continue; // product was deleted — silently drop it from the cart
    const options = variantsByProduct.get(product.id) || [];
    let variant = null;
    if (options.length) {
      variant = options.find((v) => v.id === Number(raw.variantId)) || null;
      if (!variant) continue; // option no longer exists
    }
    const key = `${product.id}:${variant ? variant.id : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const quantity = Math.min(MAX_QTY, Math.max(1, parseInt(raw.quantity, 10) || 1));
    const stock = variant ? variant.stock : product.stock;
    const price = Number(variant ? variant.price : product.price);
    const comparePrice = variant ? variant.compare_price : product.compare_price;
    let issue = null;
    if (!product.is_active) issue = 'No longer available';
    else if (stock <= 0) issue = 'Out of stock';
    else if (stock < quantity) issue = `Only ${stock} left`;

    items.push({
      key,
      productId: product.id,
      variantId: variant ? variant.id : null,
      name: product.name,
      slug: product.slug,
      image: product.image,
      variantLabel: variant ? variant.label : null,
      sku: (variant && variant.sku) ? variant.sku : product.sku,
      packageLength: (variant && Number(variant.package_length) > 0) ? variant.package_length : product.package_length,
      packageBreadth: (variant && Number(variant.package_breadth) > 0) ? variant.package_breadth : product.package_breadth,
      packageHeight: (variant && Number(variant.package_height) > 0) ? variant.package_height : product.package_height,
      packageWeight: (variant && Number(variant.package_weight) > 0) ? variant.package_weight : product.package_weight,
      price,
      comparePrice: comparePrice && Number(comparePrice) > price ? Number(comparePrice) : null,
      quantity,
      stock: Math.max(0, stock),
      lineTotal: round2(price * quantity),
      issue,
    });
  }

  const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  const { coupon = null, discount = 0, error = null } = await applyCoupon(run, couponCode, subtotal, userId);

  const settingRows = await run("SELECT `key`, `value` FROM settings WHERE `key` IN ('shipping_fee', 'free_shipping_min')");
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, Number(r.value) || 0]));
  const fee = settings.shipping_fee || 0;
  const freeFrom = settings.free_shipping_min || 0;
  const afterDiscount = subtotal - discount;

  let shipping = 0;
  let shippingDetails = null;
  const { pincode = null, paymentMethod = 'online', country = 'India' } = (typeof shippingOptions === 'object' && shippingOptions !== null) ? shippingOptions : {};
  const isDomestic = !country || String(country).toLowerCase() === 'india';

  const pkg = calculatePackage(items);

  if (isDomestic && pincode && /^\d{6}$/.test(String(pincode).trim())) {
    const isCod = paymentMethod === 'cod';

    const freeShipping = freeFrom > 0 && afterDiscount >= freeFrom;
    const srRate = await quoteOrderShipping({
      pickupPostcode: 641104,
      deliveryPostcode: pincode,
      weight: pkg.weight,
      length: pkg.length,
      breadth: pkg.breadth,
      height: pkg.height,
      cod: isCod ? 1 : 0,
    }, round2(afterDiscount), freeShipping);

    if (srRate && srRate.available && srRate.rate != null) {
      if (freeShipping) {
        shipping = 0;
        shippingDetails = {
          ...srRate,
          freeShippingApplied: true,
          originalRate: srRate.rate,
          package: pkg,
        };
      } else {
        shipping = srRate.rate;
        shippingDetails = {
          ...srRate,
          package: pkg,
        };
      }
    } else if (srRate && !srRate.available) {
      shipping = 0;
      shippingDetails = {
        available: false,
        message: srRate.message || `No courier service available for PIN code ${pincode}`,
        source: 'fallback',
        package: pkg,
      };
    } else {
      shipping = !items.length || fee <= 0 || (freeFrom > 0 && afterDiscount >= freeFrom) ? 0 : fee;
      shippingDetails = null;
    }
  } else if (!isDomestic) {
    // International shipping: standard international courier rate
    const intlFee = Number(settings.international_shipping_fee) || 1200;
    shipping = !items.length ? 0 : intlFee;
    shippingDetails = {
      available: true,
      rate: shipping,
      courierName: 'International Air Courier',
      source: 'international',
      package: pkg,
    };
  } else {
    shipping = !items.length || fee <= 0 || (freeFrom > 0 && afterDiscount >= freeFrom) ? 0 : fee;
  }

  return {
    items,
    subtotal,
    discount,
    shipping,
    shippingDetails,
    isServiceable: shippingDetails ? shippingDetails.available !== false : true,
    package: pkg,
    total: round2(afterDiscount + shipping),
    coupon,
    couponError: error,
    hasIssues: items.some((i) => i.issue),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    freeShippingMin: freeFrom,
    shippingFee: fee,
  };
}

module.exports = { buildQuote, applyCoupon, calculatePackage, extractWeightInKg, MAX_QTY };
