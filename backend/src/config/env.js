const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = process.env;

/**
 * Email: a Gmail address + app password (SMTP_USER / SMTP_PASS) is all that is needed.
 * SMTP_HOST / SMTP_PORT / SMTP_SECURE / MAIL_FROM are only for other mail providers.
 */
function mailSettings() {
  const host = (env.SMTP_HOST || '').trim() || 'smtp.gmail.com';
  const gmail = /(^|\.)gmail\.com$|googlemail\.com$/i.test(host);
  const user = (env.SMTP_USER || '').trim();
  // Google shows app passwords as "abcd efgh ijkl mnop" — the spaces are not part of it
  const pass = gmail ? (env.SMTP_PASS || '').replace(/\s+/g, '') : env.SMTP_PASS || '';
  const port = Number(env.SMTP_PORT) || 465;
  const name = (env.MAIL_FROM_NAME || 'Ooty Originals').replace(/["<>]/g, '').trim();
  return {
    host,
    gmail,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    user,
    pass,
    from: (env.MAIL_FROM || '').trim() || `"${name}" <${user || 'hi@ootyoriginals.in'}>`,
    ready: Boolean(user && pass),
  };
}

const config = {
  port: Number(env.PORT) || 5000,
  isProd: env.NODE_ENV === 'production',
  apiUrl: (env.API_URL || 'http://localhost:5000').trim().replace(/\/+$/, ''),
  clientUrl: (env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),
  adminUrl: (env.ADMIN_URL || 'http://localhost:5174').trim().replace(/\/+$/, ''),
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'ooty_originals',
    ssl: env.DB_SSL === 'true' || String(env.DB_PORT) === '4000' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  },
  jwt: {
    secret: env.JWT_SECRET || 'dev-only-secret',
    expires: env.JWT_EXPIRES || '7d',
  },
  admin: {
    name: env.ADMIN_NAME || 'Store Admin',
    email: env.ADMIN_EMAIL || 'admin@ootyoriginals.in',
    password: env.ADMIN_PASSWORD || 'Admin@123',
  },
  smtp: mailSettings(),
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || '',
    keySecret: env.RAZORPAY_KEY_SECRET || '',
  },
  shiprocket: {
    email: (env.SHIPROCKET_EMAIL || '').trim(),
    password: (env.SHIPROCKET_PASSWORD || '').trim(),
    pickupLocation: (env.SHIPROCKET_PICKUP_LOCATION || 'warehouse').trim(),
  },
  uploadsDir: path.join(__dirname, '..', '..', 'uploads'),
  // Requests allowed per minute from one visitor (IP address).
  rateLimit: {
    api: Number(env.RATE_LIMIT_PER_MINUTE) || 240,
    admin: Number(env.ADMIN_RATE_LIMIT_PER_MINUTE) || 600,
  },
  // How many proxies (nginx, Cloudflare, cPanel…) sit in front of the API. Needed so the rate
  // limits see each visitor's own address instead of the proxy's. 0 = none (your own computer).
  trustProxy: env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '' ? Number(env.TRUST_PROXY) || 0 : env.NODE_ENV === 'production' ? 1 : 0,
};

config.paymentGateway = config.razorpay.keyId && config.razorpay.keySecret ? 'razorpay' : 'mock';

if (config.isProd && config.jwt.secret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

module.exports = config;
