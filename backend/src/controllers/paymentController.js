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
    const auth = Buffer.from(config.razorpay.keyId+':'+config.razorpay.keySecret).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId),{headers:{Authorization:'Basic '+auth}});
    if (!response.ok) throw new HttpError(502,'Cannot verify capture');
    let payment = await response.json();
    if (payment.status === 'authorized' && !payment.captured) {
      const capRes = await fetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId)+'/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + auth },
        body: JSON.stringify({ amount: Math.round(Number(attempt.amount) * 100), currency: 'INR' }),
      });
      if (capRes.ok) {
        payment = await capRes.json();
      }
    }
    if (!payment.captured || payment.id !== paymentId || payment.order_id !== data.gatewayOrderId ||
        payment.currency !== 'INR' || payment.amount !== Math.round(Number(attempt.amount)*100))
      throw new HttpError(409,'Payment capture pending or mismatched');
  } else {
    // Test gateway: only reachable when no live Razorpay keys are configured.
    if (config.paymentGateway !== 'mock') throw new HttpError(400, 'Payment verification failed');
    paymentId = `test_pay_${crypto.randomBytes(8).toString('hex')}`;
  }

  const order = await completeCapture(attempt,paymentId);
  res.json({order});
}

async function completeCapture(attempt,paymentId) {
  const changed = await tx(async run => {
    const [locked] = await run('SELECT status,payment_status FROM orders WHERE id=? FOR UPDATE',[attempt.oid]);
    const [payment] = await run('SELECT status,gateway_payment_id FROM payments WHERE id=? FOR UPDATE',[attempt.id]);
    if (['paid','partially_refunded','refunded'].includes(payment.status) && payment.gateway_payment_id === paymentId) return false;
    if (locked.status !== 'pending' || !['created','failed'].includes(payment.status))
      throw new HttpError(409,'Capture requires reconciliation');
    await run("UPDATE payments SET status = 'paid', gateway_payment_id = ?, failure_reason = NULL WHERE id = ?", [paymentId, attempt.id]);
    await run("UPDATE orders SET payment_status = 'paid', status = IF(status = 'pending', 'placed', status) WHERE id = ?", [attempt.oid]);
    await orders.addHistory(run, attempt.oid, 'placed', 'Payment received · Order placed');
    return true;
  });

  const order = await orders.getOrder('id = ?', [attempt.oid]);
  if (!changed) return order;
  const payment = order.payments.find((p) => p.id === attempt.id);
  // Send order and payment confirmation emails in the background so customer response is instant
  Promise.allSettled([
    sendMail('orderConfirmation', order.customer_email, { order }),
    sendMail('paymentConfirmation', order.customer_email, { order, payment }),
  ]).catch((e) => console.error('[mail] Background confirmation send error:', e.message));

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

  return order;
}

/** Records a failed or abandoned attempt so the customer and the admin can both see it. */
async function failed(req, res) {
  const data = validate(failSchema, req.body);
  const attempt = await findAttempt(req.user.id, data.orderNumber, data.gatewayOrderId);
  await tx(async run => {
    const [order] = await run('SELECT status FROM orders WHERE id=? FOR UPDATE',[attempt.oid]);
    if (order?.status !== 'pending') return;
    const changed = await run("UPDATE payments SET status='failed',failure_reason=? WHERE id=? AND status='created'",[data.reason || 'Payment not completed',attempt.id]);
    if (changed.affectedRows) await orders.addHistory(run,attempt.oid,'pending','Payment attempt was not completed');
  });
  res.json({ order: null, success: true });
}

module.exports = { config: config_, verify, failed, completeCapture };
