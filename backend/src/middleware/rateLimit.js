const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const MINUTE = 60 * 1000;

/**
 * One limiter. Counts requests per visitor (IP address) inside a time window and answers
 * 429 with a plain message once the limit is passed. Browsers are told how long to wait
 * through the standard RateLimit-* / Retry-After headers.
 */
function limiter({ minutes, limit, message, failuresOnly = false }) {
  return rateLimit({
    windowMs: minutes * MINUTE,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: failuresOnly,
    skip: (req) => req.method === 'OPTIONS',
    message: { message },
  });
}

module.exports = {
  // Everyday browsing. A normal page needs 4–6 calls, so this leaves a lot of room for real
  // shoppers (and several people sharing one office / home connection) while stopping scrapers.
  api: limiter({ minutes: 1, limit: config.rateLimit.api, message: 'You are going a little too fast. Please wait a few seconds and try again.' }),
  admin: limiter({ minutes: 1, limit: config.rateLimit.admin, message: 'Too many requests. Please wait a few seconds and try again.' }),

  // Password guessing: only wrong attempts count, so a shopper who signs in correctly is never locked out.
  login: limiter({ minutes: 15, limit: 10, failuresOnly: true, message: 'Too many wrong attempts. Please try again in 15 minutes.' }),
  adminLogin: limiter({ minutes: 15, limit: 8, failuresOnly: true, message: 'Too many wrong attempts. Please try again in 15 minutes.' }),
  register: limiter({ minutes: 60, limit: 10, message: 'Too many new accounts from this connection. Please try again later.' }),
  // Each request here sends an email — keep it low so nobody's inbox can be flooded.
  passwordReset: limiter({ minutes: 15, limit: 5, message: 'Too many password reset requests. Please try again in 15 minutes.' }),

  // Contact form and newsletter sign-ups.
  form: limiter({ minutes: 60, limit: 10, message: 'Too many submissions. Please try again later.' }),

  // Cart pricing is also where coupon codes are checked — stops code guessing.
  quote: limiter({ minutes: 1, limit: 90, message: 'Too many cart updates. Please wait a few seconds and try again.' }),
  // Placing orders and starting / confirming payments.
  checkout: limiter({ minutes: 10, limit: 30, message: 'Too many checkout attempts. Please wait a few minutes and try again.' }),

  // Admin photo uploads.
  upload: limiter({ minutes: 1, limit: 60, message: 'Too many uploads at once. Please wait a minute and try again.' }),
};
