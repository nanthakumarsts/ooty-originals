const express = require('express');
const limits = require('../middleware/rateLimit');
const { requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const auth = require('../controllers/authController');
const { dashboard, summary } = require('../controllers/admin/dashboardController');
const products = require('../controllers/admin/productController');
const categories = require('../controllers/admin/categoryController');
const orders = require('../controllers/admin/orderController');
const returns = require('../controllers/returnController');
const users = require('../controllers/admin/userController');
const coupons = require('../controllers/admin/couponController');
const content = require('../controllers/admin/contentController');
const reports = require('../controllers/admin/reportController');

const router = express.Router();


router.post('/auth/login', limits.adminLogin, auth.login(true));

// Everything below needs an administrator token.
router.use(requireAdmin);
const reviews = require('../controllers/reviewController');
router.get('/reviews', reviews.queue);
router.patch('/reviews/:id', reviews.moderate);

router.get('/auth/me', auth.me);
router.put('/auth/profile', auth.updateProfile);
router.put('/auth/password', auth.changePassword);

router.get('/dashboard', dashboard);
router.get('/summary', summary);

router.get('/reports', reports.list);
router.get('/reports/:type', reports.show);

router.get('/products', products.list);
router.post('/products', products.save);
router.get('/products/:id', products.detail);
router.put('/products/:id', products.save);
router.patch('/products/:id', products.patch);
router.delete('/products/:id', products.remove);
router.post('/uploads', limits.upload, upload.array('images', 8), products.uploadImages);

router.get('/categories', categories.list);
router.post('/categories', categories.save);
router.put('/categories/:id', categories.save);
router.delete('/categories/:id', categories.remove);

router.get('/orders', orders.list);
router.get('/orders/:id', orders.detail);
router.patch('/orders/:id/status', orders.updateStatus);
router.patch('/orders/:id/payment', orders.updatePayment);
router.post('/orders/:id/shiprocket-sync', orders.syncShiprocket);
router.post('/orders/:id/shiprocket-awb', orders.generateShiprocketAWB);
router.post('/orders/:id/track-sync', orders.syncTracking);
router.post('/orders/:id/cancellation/approve', orders.approveCancellation);
router.post('/orders/:id/cancellation/reject', orders.rejectCancellation);
router.post('/orders/:id/cancellation/sync', orders.syncCancellationRefund);
router.get('/returns', returns.adminListReturns);
router.get('/returns/:id', returns.adminGetOrderReturn);
router.post('/returns/:id/approve', returns.adminApproveReturn);
router.post('/returns/:id/schedule-pickup', returns.adminSchedulePickup);
router.get('/returns/:id/pickup-options', returns.adminPickupOptions);
router.post('/returns/:id/receive', returns.adminReceivePackage);
router.post('/returns/:id/refund', returns.adminProcessRefund);
router.post('/returns/:id/reject', returns.adminRejectReturn);

router.get('/orders/:id/return', returns.adminGetOrderReturn);
router.post('/orders/:id/return/approve', returns.adminApproveReturn);
router.post('/orders/:id/return/schedule-pickup', returns.adminSchedulePickup);
router.post('/orders/:id/return/receive', returns.adminReceivePackage);
router.post('/orders/:id/return/refund', returns.adminProcessRefund);
router.post('/orders/:id/return/reject', returns.adminRejectReturn);

router.get('/users', users.list);
router.get('/users/:id', users.detail);
router.patch('/users/:id/status', users.setStatus);

router.get('/coupons', coupons.list);
router.post('/coupons', coupons.save);
router.put('/coupons/:id', coupons.save);
router.delete('/coupons/:id', coupons.remove);

router.get('/settings', content.settings);
router.put('/settings', content.saveSettings);
router.get('/pages', content.pages);
router.put('/pages/:slug', content.savePage);
router.get('/messages', content.messages);
router.patch('/messages/:id', content.markMessage);
router.delete('/messages/:id', content.deleteMessage);
router.get('/subscribers', content.subscribers);

module.exports = router;
