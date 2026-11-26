const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');
const limits = require('./middleware/rateLimit');

const app = express();

// Behind a proxy the visitor's address arrives in a header; only believe it when a proxy is really there.
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

// Product images are loaded by the storefront and admin panel from other origins.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Allow the storefront and admin panel; supports www/non-www and strips trailing slashes.
function expandOrigins(urls) {
  const set = new Set();
  for (const raw of urls) {
    if (!raw) continue;
    const clean = raw.trim().replace(/\/+$/, '');
    set.add(clean);
    set.add(clean.replace('://localhost', '://127.0.0.1'));
    set.add(clean.replace('://127.0.0.1', '://localhost'));
    try {
      const u = new URL(clean);
      if (u.hostname.startsWith('www.')) {
        set.add(`${u.protocol}//${u.hostname.slice(4)}${u.port ? `:${u.port}` : ''}`);
      } else if (!u.hostname.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
        set.add(`${u.protocol}//www.${u.hostname}${u.port ? `:${u.port}` : ''}`);
      }
    } catch {}
  }
  return set;
}
const allowedOrigins = expandOrigins([config.clientUrl, config.adminUrl]);

// While developing, the sites can also be opened from other devices on the same Wi-Fi / LAN
// (http://192.168.x.x:5173). In production only the configured addresses are accepted.
function isLocalNetwork(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  } catch {
    return false;
  }
}

function isVercel(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, done) => done(null, !origin || allowedOrigins.has(origin) || isVercel(origin) || (!config.isProd && isLocalNetwork(origin))),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  })
);
app.use(compression());
// Webhooks must be mounted before global express.json() so raw body buffer is preserved for HMAC verification
app.use('/api/webhooks', require('./routes/webhooks'));
app.use(express.json({ limit: '1mb' }));
if (!config.isProd) app.use(morgan('dev'));

const {serveProof,signProofs} = require('./middleware/returnProof');
app.get('/uploads/returns/:name',serveProof);
app.use(['/api/orders/:id/return','/api/admin/returns','/api/admin/orders/:id/return'],signProofs);
for (const folder of ['products','content']) app.use(
  '/uploads/'+folder,
  express.static(require('path').join(config.uploadsDir,folder), {
    maxAge: config.isProd ? '1d' : 0,
    etag: true,
    lastModified: true,
    fallthrough: false,
    index: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', config.isProd ? 'public, max-age=86400, must-revalidate' : 'no-cache, must-revalidate');
    },
  })
);

app.get('/api/health', (req, res) => res.json({ ok: true, gateway: config.paymentGateway }));
// Product photos (/uploads) are not counted — only API calls are.
app.use('/api/admin', limits.admin, require('./routes/admin'));
app.use('/api', limits.api, require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
