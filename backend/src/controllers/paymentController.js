const crypto = require('crypto');
const { z } = require('zod');
const config = require('../config/env');
const { q, tx } = require('../config/db');
const { HttpError, validate } = require('../middleware/error');
const { sendMail } = require('../utils/mailer');
const orders = require('../services/orderService');

const verifySchema = z.object({
  orderNumber: z.string().min(3),
  gatewayOrderId: z.string().min(3),
  paymentId: z.string().max(80).optional(),
  signature: z.string().max(200).optional(),
});

const failSchema = z.object({
  orderNumber: z.string().min(3),
  gatewayOrderId: z.string().min(3),
  reason: z.string().max(240).optional(),
});

function config_(req, res) {
  res.json({ gateway: config.paymentGateway, keyId: config.paymentGateway === 'razorpay' ? config.razorpay.keyId : null });
}

async function findAttempt(userId, orderNumber, gatewayOrderId) {
  const [row] = await q(
    `SELECT pay.*, o.id AS oid, o.payment_status AS order_payment_status, o.status AS order_status
       FROM payments pay JOIN orders o ON o.id = pay.order_id
      WHERE o.order_number = ? AND o.user_id = ? AND pay.gateway_order_id = ?`,
    [orderNumber, userId, gatewayOrderId]
  );
  if (!row) throw new HttpError(404, 'Payment not found');
  return row;
}

/** Confirms a payment. The order is only marked paid after the gateway signature checks out. */
async function verify(req, res) {
  const data = validate(verifySchema, req.body);
  const attempt = await findAttempt(req.user.id, data.orderNumber, data.gatewayOrderId);

  if (attempt.status === 'paid') {
    return res.json({ order: await orders.getOrder('id = ?', [attempt.oid]) }); // already confirmed
  }
  if (attempt.order_status === 'cancelled') throw new HttpError(409, 'This order was cancelled');

  let paymentId = data.paymentId;
  if (attempt.gateway === 'razorpay') {
    if (!paymentId || !orders.verifyRazorpaySignature(data.gatewayOrderId, paymentId, data.signature)) {
      throw new HttpError(400, 'Payment verification failed. If money was deducted it will be refunded automatically.');
    }
  } else {
    // Test gateway: only reachable when no live Razorpay keys are configured.
    if (config.paymentGateway !== 'mock') throw new HttpError(400, 'Payment verification failed');
    paymentId = `test_pay_${crypto.randomBytes(8).toString('hex')}`;
  }

  await tx(async (run) => {
    await run("UPDATE payments SET status = 'paid', gateway_payment_id = ?, failure_reason = NULL WHERE id = ?", [paymentId, attempt.id]);
    await run("UPDATE orders SET payment_status = 'paid', status = IF(status = 'pending', 'confirmed', status) WHERE id = ?", [attempt.oid]);
    await orders.addHistory(run, attempt.oid, 'confirmed', 'Payment received');
  });

  const order = await orders.getOrder('id = ?', [attempt.oid]);
  const payment = order.payments.find((p) => p.id === attempt.id);
  sendMail('orderConfirmation', order.customer_email, { order });
  sendMail('paymentConfirmation', order.customer_email, { order, payment });

  // Push paid order to Shiprocket automatically in the background
  try {
    const shiprocket = require('../services/shiprocketService');
    shiprocket.createOrder(order, order.items).then(async (sr) => {
      if (sr?.order_id) {
        await q('UPDATE orders SET shiprocket_order_id = ?, shiprocket_shipment_id = ? WHERE id = ?', [
          String(sr.order_id),
          String(sr.shipment_id || ''),
          order.id,
        ]);
      }
    }).catch((e) => console.error('Shiprocket Online auto-sync warning:', e.message));
  } catch (e) {
    console.error('Shiprocket Online init warning:', e.message);
  }

  res.json({ order });
}

/** Records a failed or abandoned attempt so the customer and the admin can both see it. */
async function failed(req, res) {
  const data = validate(failSchema, req.body);
  const attempt = await findAttempt(req.user.id, data.orderNumber, data.gatewayOrderId);
  if (attempt.status !== 'paid') {
    await q("UPDATE payments SET status = 'failed', failure_reason = ? WHERE id = ?", [data.reason || 'Payment was not completed', attempt.id]);
    await q("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status <> 'paid'", [attempt.oid]);
    await q('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [attempt.oid, attempt.order_status, `Payment not completed: ${data.reason || 'the payment window was closed'}`]);
  }
  res.json({ order: await orders.getOrder('id = ?', [attempt.oid]) });
}

module.exports = { config: config_, verify, failed };
