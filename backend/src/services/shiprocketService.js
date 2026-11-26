const config = require('../config/env');
const { calculatePackage } = require('../utils/shippingPackage');

let cachedToken = null;
let tokenExpiresAt = 0;

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

/**
 * Authenticates with Shiprocket API and retrieves a JWT Bearer token.
 * Tokens are valid for 10 days; we cache the token in memory to avoid redundant logins.
 */
async function getToken() {
  const { email, password } = config.shiprocket;
  if (!email || !password) {
    throw new Error('Shiprocket credentials (SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD) are missing in .env');
  }

  // Reuse cached token if valid for at least another 2 hours
  if (cachedToken && Date.now() < tokenExpiresAt - 2 * 3600 * 1000) {
    return cachedToken;
  }

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data.message || `Shiprocket login failed with HTTP ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  if (!data.token) {
    throw new Error('No token returned from Shiprocket authentication');
  }

  cachedToken = data.token;
  // 10 days = 10 * 24 * 3600 * 1000 ms
  tokenExpiresAt = Date.now() + 10 * 24 * 3600 * 1000;
  return cachedToken;
}

/**
 * Authorized HTTP request helper for Shiprocket API
 */
async function request(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.message || `Shiprocket error HTTP ${response.status}`);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

/** Check courier serviceability between two pincodes */
async function checkServiceability({
  pickupPostcode = 641104,
  deliveryPostcode,
  weight = 0.5,
  length = 10,
  breadth = 10,
  height = 10,
  cod = 0,
  declaredValue = 0,
  isReturn = false,
}) {
  const qs = new URLSearchParams({
    pickup_postcode: String(pickupPostcode),
    delivery_postcode: String(deliveryPostcode),
    weight: String(weight),
    cod: String(cod ? 1 : 0),
  });
  if (isReturn) qs.set('is_return','1');
  if (length) qs.set('length', String(length));
  if (breadth) qs.set('breadth', String(breadth));
  if (height) qs.set('height', String(height));
  if (declaredValue && Number(declaredValue) > 0) qs.set('declared_value', String(declaredValue));
  return request(`/courier/serviceability/?${qs.toString()}`, { method: 'GET' });
}

// In-memory cache for live rate checks to avoid latency & rate limiting
const rateCache = new Map();
const RATE_CACHE_TTL = 15 * 60 * 1000; // 15 mins cache

/** Get live courier shipping rate and details for a pincode (returns lowest available courier) */
async function getLiveShippingRate({
  pickupPostcode = 641104,
  deliveryPostcode,
  weight = 0.5,
  length = 10,
  breadth = 10,
  height = 10,
  cod = 0,
  declaredValue = 0,
}) {
  if (!deliveryPostcode || !/^\d{6}$/.test(String(deliveryPostcode).trim())) {
    return null;
  }
  const cleanPostcode = String(deliveryPostcode).trim();
  const cleanWeight = Math.max(0.5, Math.round(Number(weight || 0.5) * 100) / 100);
  const cleanLength = Math.max(5, Math.round(Number(length || 10)));
  const cleanBreadth = Math.max(5, Math.round(Number(breadth || 10)));
  const cleanHeight = Math.max(5, Math.round(Number(height || 5)));
  const isCod = cod ? 1 : 0;
  const cleanDeclared = Math.round(Number(declaredValue || 0) * 100) / 100;
  const cacheKey = `${pickupPostcode}:${cleanPostcode}:${cleanWeight}:${cleanLength}x${cleanBreadth}x${cleanHeight}:${isCod}:${cleanDeclared}`;

  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RATE_CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await checkServiceability({
      pickupPostcode,
      deliveryPostcode: cleanPostcode,
      weight: cleanWeight,
      length: cleanLength,
      breadth: cleanBreadth,
      height: cleanHeight,
      cod: isCod,
      declaredValue: cleanDeclared,
    });

    const couriers = (res.data?.available_courier_companies || []).filter((c) => Number(c.rate) > 0 && !c.blocked);
    if (!couriers.length) {
      const fallback = {
        available: false,
        message: res.message || `No courier service available for pincode ${cleanPostcode}`,
        rate: null,
      };
      rateCache.set(cacheKey, { data: fallback, timestamp: Date.now() });
      return fallback;
    }

    // Map each courier with Auto-Secure coverage charges if present in the account
    const mapped = couriers.map((c) => {
      const base = Number(c.rate);
      const cov = Number(c.coverage_charges || 0);
      const wa = Number(c.whatsapp_charges || 0);
      const other = Number(c.other_charges || 0);
      // When Shiprocket Auto-Secure is active on the account, Shiprocket dashboard includes coverage + whatsapp charges
      const covTotal = cov > 0 ? Math.round((cov + wa + other) * 100) / 100 : 0;
      const totalRate = Math.round((base + covTotal) * 100) / 100;
      return {
        ...c,
        totalRate,
        coverageTotal: covTotal,
      };
    });

    // Sort couriers by totalRate ascending
    const sorted = [...mapped].sort((a, b) => a.totalRate - b.totalRate);
    const best = sorted[0];

    const result = {
      available: true,
      rate: best.totalRate,
      baseFreightRate: Number(best.rate),
      coverageCharges: best.coverageTotal,
      courierName: best.courier_name,
      courierCompanyId: best.courier_company_id,
      etd: best.etd || (best.estimated_delivery_days ? `${best.estimated_delivery_days} days` : null),
      source: 'shiprocket',
    };

    rateCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.error('Shiprocket rate calculation warning:', err.message);
    return null;
  }
}

/** Get registered pickup addresses from Shiprocket */
async function getPickupLocations() {
  return request('/settings/company/pickup', { method: 'GET' });
}

/** Create a shipment order in Shiprocket */
async function createOrder(order, items = [], pickupLocation = null) {
  const loc = pickupLocation || config?.shiprocket?.pickupLocation || 'warehouse-1';
  const pkg = calculatePackage(items.length ? items : (order.items || []));
  const orderItems = items.map((item) => ({
    name: item.name,
    sku: item.sku || `SKU-${item.product_id || item.id}`,
    units: item.quantity,
    selling_price: Number(item.price),
    discount: 0,
    tax: 0,
  }));

  const isSameAddress = (
    (!order.bill_line1 || order.bill_line1 === order.ship_line1) &&
    (!order.bill_pincode || String(order.bill_pincode) === String(order.ship_pincode))
  );

  const payload = {
    order_id: String(order.order_number),
    order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: loc,
    billing_customer_name: order.bill_name || order.customer_name || 'Customer',
    billing_last_name: '',
    billing_address: order.bill_line1 || order.ship_line1 || 'Address Line 1',
    billing_address_2: order.bill_line2 || order.ship_line2 || '',
    billing_city: order.bill_city || order.ship_city || '',
    billing_pincode: String(order.bill_pincode || order.ship_pincode || ''),
    billing_state: order.bill_state || order.ship_state || '',
    billing_country: order.bill_country || order.ship_country || 'India',
    billing_email: order.bill_email || order.customer_email || 'orders@sannara.in',
    billing_phone: String(order.bill_phone || order.ship_phone || ''),
    shipping_is_billing: isSameAddress,
    shipping_customer_name: order.ship_name || order.customer_name || 'Customer',
    shipping_last_name: '',
    shipping_address: order.ship_line1 || 'Address Line 1',
    shipping_address_2: order.ship_line2 || '',
    shipping_city: order.ship_city || '',
    shipping_pincode: String(order.ship_pincode || ''),
    shipping_state: order.ship_state || '',
    shipping_country: order.ship_country || 'India',
    shipping_email: order.customer_email || 'orders@sannara.in',
    shipping_phone: String(order.ship_phone || ''),
    order_items: orderItems,
    payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    sub_total: Number(order.subtotal || order.total),
    shipping_charges: Number(order.shipping_fee || 0),
    total_discount: Number(order.discount || 0),
    length: pkg.length,
    breadth: pkg.breadth,
    height: pkg.height,
    weight: pkg.weight,
  };

  return request('/orders/create/adhoc', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Assign courier and generate AWB */
async function generateAWB(shipmentId, courierId = null, isReturn = false) {
  const body = { shipment_id: shipmentId };
  if (isReturn) body.is_return = 1;
  if (courierId) body.courier_id = courierId;
  return request('/courier/assign/awb', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Track an order by AWB code */
async function trackAWB(awbCode) {
  return request(`/courier/track/awb/${encodeURIComponent(awbCode)}`, { method: 'GET' });
}

/** Create a Reverse Pickup (Return Order) in Shiprocket */
async function createReturnOrder(order, items, warehouse, returnRequestId) {
  const pkg = calculatePackage(items.length ? items : (order.items || []));
  const orderItems = items.map((item) => ({
    name: item.name,
    sku: item.sku || `SKU-${item.product_id || item.id}`,
    units: item.quantity,
    selling_price: Number(item.price),
    discount: 0,
    tax: 0,
  }));

  const returnedSubtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const retIdSuffix = returnRequestId ? `-${returnRequestId}` : `-${Date.now().toString().slice(-4)}`;

  const payload = {
    order_id: `RET-${order.order_number}${retIdSuffix}`,
    order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    channel_id: '',
    sub_total: returnedSubtotal > 0 ? returnedSubtotal : Number(order.subtotal || order.total),
    length: pkg.length,
    breadth: pkg.breadth,
    height: pkg.height,
    weight: pkg.weight,
    payment_method: 'Prepaid',
    total_discount: 0,

    // Pickup from Customer
    pickup_customer_name: order.ship_name || order.customer_name || 'Customer',
    pickup_last_name: '',
    pickup_address: order.ship_line1 || 'Customer Address',
    pickup_address_2: order.ship_line2 || '',
    pickup_city: order.ship_city || '',
    pickup_state: order.ship_state || '',
    pickup_country: 'India',
    pickup_pincode: Number(order.ship_pincode) || order.ship_pincode,
    pickup_email: order.customer_email || 'customer@sannara.in',
    pickup_phone: String(order.ship_phone || ''),

    // Delivery back to Store / Warehouse
    shipping_customer_name: warehouse.name || warehouse.pickup_location,
    shipping_address: warehouse.address,
    shipping_address_2: warehouse.address_2 || '',
    shipping_city: warehouse.city,
    shipping_state: warehouse.state,
    shipping_country: warehouse.country,
    shipping_pincode: warehouse.pin_code,
    shipping_email: warehouse.email,
    shipping_phone: warehouse.phone,
    existing_order_id: order.shiprocket_order_id,
    order_items: orderItems,
  };

  return request('/orders/create/return', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Check reverse courier serviceability (from customer pincode to warehouse pincode) */
async function checkReverseServiceability({ customerPostcode, warehousePostcode, weight, length, breadth, height, declaredValue }) {
  if (!customerPostcode || !/^\d{6}$/.test(String(customerPostcode).trim())) {
    return { available: false, message: 'Invalid 6-digit Indian customer pincode for reverse pickup' };
  }
  return checkServiceability({
    declaredValue, isReturn:true,
    pickupPostcode: String(customerPostcode).trim(),
    deliveryPostcode: String(warehousePostcode).trim(),
    length, breadth, height,
    weight,
    cod: 0,
  });
}

module.exports = {
  getToken,
  request,
  checkServiceability,
  checkReverseServiceability,
  getLiveShippingRate,
  getPickupLocations,
  createOrder,
  createReturnOrder,
  generateAWB,
  trackAWB,
};
