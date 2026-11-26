const express = require('express');
const webhook = require('../controllers/webhookController');

const router = express.Router();

// Razorpay requires the raw body buffer for HMAC-SHA256 signature verification
router.post('/razorpay', express.raw({ type: '*/*' }), webhook.razorpayWebhook);

// Shiprocket sends standard JSON tracking payloads
router.post('/shiprocket', express.json({ limit: '1mb' }), webhook.shiprocketWebhook);

module.exports = router;
