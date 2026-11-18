const express = require('express');
const limits = require('../middleware/rateLimit');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const auth = require('../controllers/authController');
const address = require('../controllers/addressController');
const catalog = require('../controllers/catalogController');
const cart = require('../controllers/cartController');
const order = require('../controllers/orderController');
const payment = require('../controllers/paymentController');
const wishlist = require('../controllers/wishlistController');
const content = require('../controllers/contentController');
const returns = require('../controllers/returnController');
const { returnUpload } = require('../middleware/upload');

const router = express.Router();

// Every route here is already under the general limit set in app.js;
// the sensitive ones below get a tighter limit of their own (see middleware/rateLimit.js).

// ---- Account ----
router.post('/auth/register', limits.register, auth.register);
router.post('/auth/login', limits.login, auth.login(false));
router.post('/auth/forgot-password', limits.passwordReset, auth.forgotPassword);
router.post('/auth/reset-password', limits.passwordReset, auth.resetPassword);
router.get('/auth/me', requireAuth, auth.me);
router.put('/auth/profile', requireAuth, auth.updateProfile);
router.put('/auth/password', requireAuth, auth.changePassword);

router.get('/addresses', requireAuth, address.list);
router.post('/addresses', requireAuth, address.create);
router.put('/addresses/:id', requireAuth, address.update);
router.patch('/addresses/:id/default', requireAuth, address.setDefault);
router.delete('/addresses/:id', requireAuth, address.remove);

// ---- Catalogue ----
router.get('/categories', catalog.categories);
router.get('/products', catalog.products);
router.get('/products/compare', catalog.compare);
router.get('/products/:slug', catalog.productDetail);

// ---- Cart & checkout ----
router.post('/cart/quote', limits.quote, optionalAuth, cart.quote);
router.get('/offers', optionalAuth, cart.offers);

router.post('/orders', limits.checkout, requireAuth, order.place);
router.get('/orders', requireAuth, order.listMine);
router.get('/orders/:orderNumber', requireAuth, order.detail);
router.post('/orders/:orderNumber/cancel', requireAuth, order.cancel);
router.post('/orders/:orderNumber/pay', limits.checkout, requireAuth, order.retryPayment);
router.post('/orders/:orderNumber/return', requireAuth, returnUpload.array('attachments', 4), returns.requestReturn);
router.get('/orders/:orderNumber/return', requireAuth, returns.getCustomerReturn);

router.get('/payments/config', payment.config);
router.post('/payments/verify', limits.checkout, requireAuth, payment.verify);
router.post('/payments/failed', requireAuth, payment.failed);

// ---- Wishlist ----
router.get('/wishlist', requireAuth, wishlist.list);
router.post('/wishlist', requireAuth, wishlist.add);
router.delete('/wishlist/:productId', requireAuth, wishlist.remove);

// ---- Site content ----
router.get('/content/settings', content.settings);
router.get('/content/pages/:slug', content.page);
router.post('/contact', limits.form, content.contact);
router.post('/newsletter', limits.form, content.newsletter);

module.exports = router;
