const { randomUUID } = require('crypto');
const { q, tx } = require('../config/db');
const config = require('../config/env');
const { HttpError } = require('../middleware/error');
const orders = require('./orderService');
const { readItems, selectItems } = require('./returnItems');

const cents = amount => Math.round(Number(amount) * 100);

function quote(order, selection, options) {
  const lines = selectItems(order, selection, [], options);
  const full = order.items.every(line => lines.some(i => i.order_item_id === line.id && i.quantity === line.quantity));
  const amount = full ? cents(order.total) : lines.reduce((sum,i) => sum+cents(i.line_total),0);
  return {lines,full,amount};
}

async function syncRefundStatus(orderId) {
  const [order] = await q('SELECT * FROM orders WHERE id=?', [orderId]);
  if (!order || order.status !== 'cancellation_requested' || order.payment_method !== 'online') return null;
  const items = readItems(order.cancellation_items);
  const attempt = items[0]?.refundAttempt;
  if (!attempt?.id || !attempt?.paymentId || attempt.status !== 'pending') return null;

  if (config.paymentGateway === 'razorpay') {
    try {
      const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
      const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(attempt.paymentId)}/refunds/${encodeURIComponent(attempt.id)}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === 'processed') {
        return await settle(orderId, {
          refundId: data.id,
          paymentId: data.payment_id,
          amount: data.amount / 100,
          status: 'processed',
          key: attempt.key,
        });
      } else if (data.status === 'failed') {
        return await settle(orderId, {
          refundId: data.id,
          paymentId: data.payment_id,
          amount: data.amount / 100,
          status: 'failed',
          key: attempt.key,
        });
      }
    } catch (e) {
      console.error('[cancellationRefund] syncRefundStatus error:', e.message);
    }
  }
  return null;
}

async function prepare(orderId) {
  return tx(async run => {
    const [order] = await run('SELECT * FROM orders WHERE id=? FOR UPDATE',[orderId]);
    if (!order || order.status !== 'cancellation_requested' || order.payment_method !== 'online')
      throw new HttpError(409,'No pending prepaid cancellation');
    const items = readItems(order.cancellation_items);
    if (!items[0].cancellationId) throw new HttpError(409,'Reconcile this legacy cancellation with the gateway before approval');
    order.items = await run('SELECT * FROM order_items WHERE order_id=? ORDER BY id',[order.id]);
    const {amount} = quote(order,items.map(i=>({order_item_id:i.orderItemId,quantity:i.quantity})), { storedRequest: true });
    if (amount !== cents(order.cancellation_refund_amount) || amount <= 0)
      throw new HttpError(409,'Cancellation amount requires reconciliation');
    const payments = await run("SELECT * FROM payments WHERE order_id=? AND status IN ('paid','partially_refunded') FOR UPDATE",[order.id]);
    const payment = payments[0];
    if (payments.length !== 1 || payment.gateway !== config.paymentGateway || !payment.gateway_payment_id ||
        amount+cents(payment.refunded_amount)>cents(payment.amount))
      throw new HttpError(409,'Insufficient or unverified payment balance');
    const prev = items[0].refundAttempt;
    if (prev?.status === 'pending') return {pending:true};
    const key = prev?.status === 'processing' ? prev.key : 'cancel-'+randomUUID();
    items[0].refundAttempt = {key,status:'processing',paymentId:payment.gateway_payment_id};
    await run('UPDATE orders SET cancellation_items=? WHERE id=?',[JSON.stringify(items),order.id]);
    return {key,paymentId:payment.gateway_payment_id,amount:amount/100,gatewayOrderId:payment.gateway_order_id,
      paymentAmount:payment.amount,orderNumber:order.order_number};
  });
}

async function approve(orderId) {
  const synced = await syncRefundStatus(orderId);
  if (synced === 'processed') return 'processed';

  const request = await prepare(orderId);
  if (request.pending) return 'pending';
  const refund = await orders.refundPayment(request.paymentId,request.amount,{
    cancellation_order_id:String(orderId),order_number:request.orderNumber,idempotencyKey:request.key
  },request);
  return settle(orderId,refund);
}

async function settle(orderId,refund) {
  let notification = null;
  const result = await tx(async run => {
    const [order] = await run('SELECT * FROM orders WHERE id=? FOR UPDATE',[orderId]);
    if (order?.status !== 'cancellation_requested') return 'ignored';
    const items = readItems(order.cancellation_items);
    const attempt = items[0].refundAttempt;
    if (!attempt || attempt.key !== refund.key || attempt.status === 'failed') return 'ignored';
    const amount = cents(refund.amount);
    if (!refund.refundId || refund.paymentId !== attempt.paymentId || amount !== cents(order.cancellation_refund_amount) ||
        (attempt.id && attempt.id !== refund.refundId) || !['processed','pending','failed'].includes(refund.status))
      throw new HttpError(409,'Cancellation refund details do not match');
    attempt.id = refund.refundId;
    attempt.status = refund.status;
    if (refund.status !== 'processed') {
      await run('UPDATE orders SET cancellation_items=? WHERE id=?',[JSON.stringify(items),orderId]);
      return refund.status;
    }
    const [payment] = await run('SELECT * FROM payments WHERE order_id=? AND gateway_payment_id=? FOR UPDATE',[orderId,refund.paymentId]);
    if (!payment || amount+cents(payment.refunded_amount)>cents(payment.amount))
      throw new HttpError(409,'Payment balance requires reconciliation');
    order.items = await run('SELECT * FROM order_items WHERE order_id=? ORDER BY id FOR UPDATE',[orderId]);
    const {lines,full,amount:eligible} = quote(order,items.map(i=>({order_item_id:i.orderItemId,quantity:i.quantity})), { storedRequest: true });
    if (eligible !== amount) throw new HttpError(409,'Order lines require reconciliation');
    const settled = amount+cents(payment.refunded_amount);
    const paymentStatus = settled === cents(payment.amount) ? 'refunded' : 'partially_refunded';
    await run('UPDATE payments SET status=?,refunded_amount=? WHERE id=?',[paymentStatus,settled/100,payment.id]);
    let gross = 0;
    for (const i of lines) {
      gross += cents(i.price)*i.quantity;
      if (i.product_id) await run('UPDATE products SET stock=stock+? WHERE id=?',[i.quantity,i.product_id]);
      if (i.variant_id) await run('UPDATE product_variants SET stock=stock+? WHERE id=?',[i.quantity,i.variant_id]);
      if (!full) {
        const original = order.items.find(line=>line.id === i.order_item_id);
        if (original.quantity === i.quantity) await run('DELETE FROM order_items WHERE order_id=? AND id=?',[orderId,i.order_item_id]);
        else await run('UPDATE order_items SET quantity=quantity-? WHERE order_id=? AND id=?',[i.quantity,orderId,i.order_item_id]);
      }
    }
    const previous = typeof order.cancelled_items === 'string' ? JSON.parse(order.cancelled_items) : (order.cancelled_items || []);
    if (!Array.isArray(previous)) throw new HttpError(409,'Prior cancellations require reconciliation');
    const status = full ? 'cancelled' : 'confirmed';
    await run(`UPDATE orders SET status=?,payment_status=?,subtotal=?,discount=?,total=?,cancelled_items=?,
      cancelled_amount=COALESCE(cancelled_amount,0)+?,cancellation_items=NULL,cancellation_refund_amount=NULL,cancellation_reason=NULL WHERE id=?`,
      [status,paymentStatus,full?order.subtotal:(cents(order.subtotal)-gross)/100,
       full?order.discount:(cents(order.discount)-gross+amount)/100,full?order.total:(cents(order.total)-amount)/100,
       JSON.stringify([...previous,...items]),amount/100,orderId]);
    await orders.addHistory(run,orderId,status,'Cancellation refund processed: '+refund.refundId);
    notification = { order: { ...order, status }, note: `Your cancellation refund of ₹${Number(refund.amount).toFixed(2)} has been processed. Refund ID: ${refund.refundId}.` };
    return 'processed';
  });
  if (notification) {
    await require('../utils/mailer').sendMail('orderStatus', notification.order.customer_email, notification);
  }
  return result;
}

module.exports = {quote,approve,settle,syncRefundStatus};
