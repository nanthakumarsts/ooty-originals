const crypto = require('crypto');
const config = require('../config/env');
const { q, tx } = require('../config/db');
const { HttpError } = require('../middleware/error');

/** Order with its items, status history and payment attempts. */
async function getOrder(where, params) {
  const [order] = await q(`SELECT * FROM orders WHERE ${where} LIMIT 1`, params);
  if (!order) return null;
  const [items, history, payments] = await Promise.all([
    q(
      `SELECT oi.*, p.slug FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id`,
      [order.id]
    ),
    q('SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id', [order.id]),
    q('SELECT id, gateway, gateway_order_id, gateway_payment_id, amount, status, failure_reason, created_at, updated_at FROM payments WHERE order_id = ? ORDER BY id DESC', [order.id]),
  ]);
  return { ...order, items, history, payments };
}

/** Put the items of an order back on the shelf (used when an order is cancelled). */
async function restoreStock(run, orderId) {
  const items = await run('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
  for (const item of items) {
    if (!item.product_id) continue;
    if (item.variant_id) await run('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [item.quantity, item.variant_id]);
    await run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
  }
}

const addHistory = (run, orderId, status, note = null) =>
  run('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [orderId, status, note]);

/**
 * Open a payment with the gateway and record the attempt.
 * With Razorpay keys configured this creates a real Razorpay order;
 * otherwise a clearly-labelled test gateway is used so the flow can be tried locally.
 */
async function createGatewayPayment(order) {
  const amountPaise = Math.round(Number(order.total) * 100);
  let gatewayOrderId;

  if (config.paymentGateway === 'razorpay') {
    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: order.order_number, notes: { order_number: order.order_number } }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.id) {
      console.error('[razorpay] order create failed:', body);
      throw new HttpError(502, 'The payment gateway is not responding. Please try again in a moment.');
    }
    gatewayOrderId = body.id;
  } else {
    gatewayOrderId = `test_order_${crypto.randomBytes(8).toString('hex')}`;
  }

  await q('INSERT INTO payments (order_id, gateway, gateway_order_id, amount) VALUES (?, ?, ?, ?)', [order.id, config.paymentGateway, gatewayOrderId, order.total]);
  return {
    gateway: config.paymentGateway,
    keyId: config.paymentGateway === 'razorpay' ? config.razorpay.keyId : null,
    gatewayOrderId,
    amount: amountPaise,
    currency: 'INR',
  };
}

function verifyRazorpaySignature(gatewayOrderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${gatewayOrderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Asks Razorpay whether money was actually collected for one of its orders. */
async function findCapturedPayment(gatewayOrderId) {
  if (config.paymentGateway !== 'razorpay' || !String(gatewayOrderId).startsWith('order_')) return null;
  try {
    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/orders/${gatewayOrderId}/payments`, { headers: { Authorization: `Basic ${auth}` } });
    if (!response.ok) return undefined; // could not check — leave the order alone for now
    const body = await response.json();
    return (body.items || []).find((p) => p.status === 'captured' || p.status === 'authorized') || null;
  } catch {
    return undefined;
  }
}

/**
 * Double-checks an unpaid online order with Razorpay before anything drastic is done to it.
 * Returns 'paid' (the order has just been confirmed), 'unpaid', or 'unknown' when Razorpay
 * could not be reached.
 */
async function confirmIfPaid(orderId) {
  const attempts = await q("SELECT id, gateway_order_id FROM payments WHERE order_id = ? AND gateway = 'razorpay' AND status <> 'paid' ORDER BY id DESC", [orderId]);
  let unknown = false;
  for (const attempt of attempts) {
    const payment = await findCapturedPayment(attempt.gateway_order_id);
    if (payment === undefined) { unknown = true; continue; }
    if (!payment) continue;
    await tx(async (run) => {
      await run("UPDATE payments SET status = 'paid', gateway_payment_id = ?, failure_reason = NULL WHERE id = ?", [payment.id, attempt.id]);
      await run("UPDATE orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ? AND status = 'pending'", [orderId]);
      await addHistory(run, orderId, 'confirmed', 'Payment received (confirmed with Razorpay)');
    });
    return 'paid';
  }
  return unknown ? 'unknown' : 'unpaid';
}

/**
 * Housekeeping for online orders that were started but never paid (window closed, payment abandoned).
 * After `minutes` they are cancelled and their stock goes back on sale. Before cancelling, Razorpay is
 * asked whether the customer did pay — if so the order is confirmed instead, so nobody pays for nothing.
 */
async function expireUnpaidOrders(minutes = 30) {
  const stale = await q(
    "SELECT id FROM orders WHERE status = 'pending' AND payment_method = 'online' AND payment_status <> 'paid' AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)",
    [minutes]
  );
  let cancelled = 0;
  for (const { id } of stale) {
    const check = await confirmIfPaid(id);
    if (check !== 'unpaid') continue; // paid after all, or Razorpay could not be reached — try again next round
    await tx(async (run) => {
      const [fresh] = await run('SELECT status, payment_status FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!fresh || fresh.status !== 'pending' || fresh.payment_status === 'paid') return;
      await run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [id]);
      await restoreStock(run, id);
      await addHistory(run, id, 'cancelled', 'Cancelled automatically — payment was not completed');
      cancelled++;
    });
  }
  return cancelled;
}

/**
 * Processes a refund through Razorpay (or mock in development)
 */
async function refundPayment(paymentId, amountInRupees, notes = {}) {
  const amountPaise = Math.round(Number(amountInRupees) * 100);
  if (config.paymentGateway === 'razorpay') {
    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        notes: {
          reason: notes.reason || 'Customer return approved',
          ...notes,
        },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[razorpay] refund failed:', body);
      let msg = body.error?.description || 'Razorpay refund failed';
      if (msg === 'invalid request sent') {
        msg = 'Razorpay refund failed: Insufficient merchant balance in your Razorpay account. Razorpay deducted transaction fees from the order, so available balance is slightly lower than the refund amount. Please add test orders / refund credits in your Razorpay Dashboard, or process from Razorpay Dashboard.';
      }
      throw new HttpError(400, msg);
    }
    return {
      refundId: body.id,
      amount: body.amount / 100,
      status: body.status,
    };
  } else {
    // Mock refund in development
    return {
      refundId: `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`,
      amount: Number(amountInRupees),
      status: 'processed',
    };
  }
}

module.exports = {
  getOrder,
  restoreStock,
  addHistory,
  createGatewayPayment,
  verifyRazorpaySignature,
  confirmIfPaid,
  expireUnpaidOrders,
  refundPayment,
};
