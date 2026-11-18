const config = require('../config/env');

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
async function checkServiceability({ pickupPostcode = 641104, deliveryPostcode, weight = 0.5, cod = 0 }) {
  const qs = new URLSearchParams({
    pickup_postcode: String(pickupPostcode),
    delivery_postcode: String(deliveryPostcode),
    weight: String(weight),
    cod: String(cod ? 1 : 0),
  });
  return request(`/courier/serviceability/?${qs.toString()}`, { method: 'GET' });
}

// In-memory cache for live rate checks to avoid latency & rate limiting
const rateCache = new Map();
const RATE_CACHE_TTL = 15 * 60 * 1000; // 15 mins cache

/** Get live courier shipping rate and details for a pincode */
async function getLiveShippingRate({ pickupPostcode = 641104, deliveryPostcode, weight = 0.5, cod = 0 }) {
  if (!deliveryPostcode || !/^\d{6}$/.test(String(deliveryPostcode).trim())) {
    return null;
  }
  const cleanPostcode = String(deliveryPostcode).trim();
  const cleanWeight = Math.max(0.5, Math.round(Number(weight || 0.5) * 10) / 10);
  const isCod = cod ? 1 : 0;
  const cacheKey = `${pickupPostcode}:${cleanPostcode}:${cleanWeight}:${isCod}`;

  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RATE_CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await checkServiceability({
      pickupPostcode,
      deliveryPostcode: cleanPostcode,
      weight: cleanWeight,
      cod: isCod,
    });

    const couriers = res.data?.available_courier_companies || [];
    if (!couriers.length) {
      const fallback = {
        available: false,
        message: res.message || `No courier service available for pincode ${cleanPostcode}`,
        rate: null,
      };
      rateCache.set(cacheKey, { data: fallback, timestamp: Date.now() });
      return fallback;
    }

    // Sort couriers by rate ascending to pick the most economical available courier
    const sorted = [...couriers].sort((a, b) => Number(a.rate) - Number(b.rate));
    const best = sorted[0];

    const result = {
      available: true,
      rate: Math.round(Number(best.rate) * 100) / 100,
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
  const loc = pickupLocation || config?.shiprocket?.pickupLocation || 'warehouse';
  const orderItems = items.map((item) => ({
    name: item.name,
    sku: item.sku || `SKU-${item.product_id || item.id}`,
    units: item.quantity,
    selling_price: Number(item.price),
    discount: 0,
    tax: 0,
  }));

  const payload = {
    order_id: String(order.order_number),
    order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: loc,
    billing_customer_name: order.customer_name || 'Customer',
    billing_last_name: '',
    billing_address: order.ship_line1 || 'Address Line 1',
    billing_address_2: order.ship_line2 || '',
    billing_city: order.ship_city || '',
    billing_pincode: String(order.ship_pincode || ''),
    billing_state: order.ship_state || '',
    billing_country: 'India',
    billing_email: order.customer_email || 'orders@ootyoriginals.in',
    billing_phone: String(order.ship_phone || ''),
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    sub_total: Number(order.subtotal || order.total),
    shipping_charges: Number(order.shipping_fee || 0),
    total_discount: Number(order.discount || 0),
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  };

  return request('/orders/create/adhoc', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Assign courier and generate AWB */
async function generateAWB(shipmentId, courierId = null) {
  const body = { shipment_id: shipmentId };
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
async function createReturnOrder(order, items = [], warehouseLocation = null) {
  const orderItems = items.map((item) => ({
    name: item.name,
    sku: item.sku || `SKU-${item.product_id || item.id}`,
    units: item.quantity,
    selling_price: Number(item.price),
    discount: 0,
    tax: 0,
  }));

  const payload = {
    order_id: `RET-${order.order_number}`,
    order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    channel_id: '',
    sub_total: Number(order.subtotal || order.total),
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
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
    pickup_email: order.customer_email || 'customer@ootyoriginals.in',
    pickup_phone: String(order.ship_phone || ''),

    // Delivery back to Store / Warehouse
    shipping_customer_name: 'Ooty Originals Warehouse',
    shipping_last_name: '',
    shipping_address: 'Nilgiri Mountain Store, 2/306 Blue Hills Avenue',
    shipping_address_2: 'Mettupalayam Road',
    shipping_city: 'Coimbatore',
    shipping_state: 'Tamil Nadu',
    shipping_country: 'India',
    shipping_pincode: 641104,
    shipping_email: config.smtp.user || config.admin.email || 'orders@ootyoriginals.in',
    shipping_phone: '9876543210',

    order_items: orderItems,
  };

  return request('/orders/create/return', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

module.exports = {
  getToken,
  request,
  checkServiceability,
  getLiveShippingRate,
  getPickupLocations,
  createOrder,
  createReturnOrder,
  generateAWB,
  trackAWB,
};
