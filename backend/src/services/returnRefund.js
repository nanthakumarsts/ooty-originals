const { q, tx } = require('../config/db');
const config = require('../config/env');
const { HttpError } = require('../middleware/error');
const { readItems } = require('./returnItems');
const orders = require('./orderService');

const cents = amount => Math.round(Number(amount) * 100);

async function syncReturnRefundStatus(orderId, returnId) {
  const [row] = await q('SELECT * FROM return_requests WHERE id=? AND order_id=?', [returnId, orderId]);
  if (!row || !['refund_processing', 'refund_initiated'].includes(row.status) || !row.razorpay_refund_id) return null;
  const [payment] = await q("SELECT * FROM payments WHERE order_id=? AND gateway='razorpay' AND gateway_payment_id IS NOT NULL", [orderId]);
  if (!payment) return null;

  try {
    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.gateway_payment_id)}/refunds/${encodeURIComponent(row.razorpay_refund_id)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'processed' || data.status === 'failed') {
      return await settle(orderId, returnId, {
        refundId: data.id,
        paymentId: data.payment_id,
        amount: data.amount / 100,
        status: data.status,
        key: row.idempotency_key,
      });
    }
  } catch (e) {
    console.error('[returnRefund] syncReturnRefundStatus error:', e.message);
  }
  return null;
}

async function withReturn(orderId, returnId, work) {
  return tx(async run => {
    const [order] = await run('SELECT * FROM orders WHERE id=? FOR UPDATE', [orderId]);
    const [row] = await run('SELECT * FROM return_requests WHERE id=? AND order_id=? FOR UPDATE', [returnId, orderId]);
    if (!order || !row) throw new HttpError(404, 'Return not found');
    const payments = await run("SELECT * FROM payments WHERE order_id=? AND status IN ('paid','partially_refunded','refunded') FOR UPDATE", [orderId]);
    if (order.payment_method !== 'online' || payments.length !== 1 || !payments[0].gateway_payment_id || payments[0].gateway !== config.paymentGateway)
      throw new HttpError(409,'A single verified original online payment is required. Offline refunds require separate settlement.');
    return work(run,order,row,payments[0]);
  });
}

async function processReturn(orderId, returnId) {
  const request = await withReturn(orderId,returnId,async (run,order,row,payment) => {
    if (!['received','refund_processing','refund_failed'].includes(row.status)) throw new HttpError(409,'Return is not ready for a refund');
    const items = readItems(row.items);
    const amount = cents(row.refund_amount);
    if (!items.every(i => Array.isArray(i.units) && i.units.length === i.quantity) ||
        !Number.isSafeInteger(amount) || amount <= 0 || amount !== items.reduce((sum,i) => sum+cents(i.line_total),0))
      throw new HttpError(409,'Return amount requires reconciliation');
    const [held] = await run("SELECT COALESCE(SUM(refund_amount),0) AS amount FROM return_requests WHERE order_id=? AND id<>? AND status IN ('refund_processing','refund_initiated')",[orderId,returnId]);
    if (amount + cents(held.amount) + cents(payment.refunded_amount) > cents(payment.amount))
      throw new HttpError(409,'Insufficient refundable payment balance');
    let key = 'return-refund-'+row.id;
    if (row.status === 'refund_processing') {
      if (!row.idempotency_key?.startsWith('return-refund-')) throw new HttpError(409,'Legacy refund requires provider reconciliation');
      key = row.idempotency_key;
    }
    if (row.status === 'refund_failed') {
      if (!row.razorpay_refund_id) throw new HttpError(409,'Prior refund outcome requires reconciliation');
      key += '-after-'+row.razorpay_refund_id;
    }
    await run("UPDATE return_requests SET status='refund_processing',idempotency_key=?,razorpay_refund_id=NULL WHERE id=?",[key,row.id]);
    return {key,amount:amount/100,paymentId:payment.gateway_payment_id,orderNumber:order.order_number,gatewayOrderId:payment.gateway_order_id,paymentAmount:payment.amount};
  });
  const notes = {return_id:String(returnId),order_number:request.orderNumber,idempotencyKey:request.key};
  const refund = await orders.refundPayment(request.paymentId,request.amount,notes,request);
  return settle(orderId,returnId,refund);
}

async function settle(orderId,returnId,refund) {
  let notification = null;
  const result = await withReturn(orderId,returnId,async (run,order,row,payment) => {
    if (!['refund_processing','refund_initiated'].includes(row.status)) return row.status;
    if (refund.paymentId !== payment.gateway_payment_id || cents(refund.amount) !== cents(row.refund_amount) ||
        !refund.refundId || (row.razorpay_refund_id && row.razorpay_refund_id !== refund.refundId) ||
        refund.key !== row.idempotency_key)
      throw new HttpError(409,'Refund identity or amount does not match the reserved request');
    const status = {pending:'refund_initiated',processed:'refunded',failed:'refund_failed'}[refund.status];
    if (!status) throw new HttpError(409,'Unknown refund state');
    if (status !== 'refunded') {
      await run('UPDATE return_requests SET status=?,razorpay_refund_id=? WHERE id=?',[status,refund.refundId,row.id]);
      return status;
    }
    const settled = cents(payment.refunded_amount) + cents(refund.amount);
    if (settled > cents(payment.amount)) throw new HttpError(409,'Payment balance requires reconciliation');
    const paymentStatus = settled === cents(payment.amount) ? 'refunded' : 'partially_refunded';
    await run('UPDATE payments SET refunded_amount=?,status=? WHERE id=?',[settled/100,paymentStatus,payment.id]);
    await run("UPDATE return_requests SET status='refunded',refunded_amount=refund_amount,refunded_at=NOW(),refunded_items=items,razorpay_refund_id=? WHERE id=?",[refund.refundId,row.id]);
    for (const item of readItems(row.items)) {
      if (item.product_id) await run('UPDATE products SET stock=stock+? WHERE id=?',[item.quantity,item.product_id]);
      if (item.variant_id) await run('UPDATE product_variants SET stock=stock+? WHERE id=?',[item.quantity,item.variant_id]);
    }
    const completed = await run("SELECT items FROM return_requests WHERE order_id=? AND status='refunded'",[order.id]);
    const units = new Map();
    for (const r of completed) for (const i of readItems(r.items)) units.set(i.order_item_id,(units.get(i.order_item_id)||0)+i.quantity);
    const lines = await run('SELECT id,quantity FROM order_items WHERE order_id=?',[order.id]);
    const orderStatus = lines.length && lines.every(i=>units.get(i.id)===i.quantity) ? 'returned' : order.status;
    await run('UPDATE orders SET payment_status=?, status=? WHERE id=?',[paymentStatus,orderStatus,order.id]);
    await orders.addHistory(run,order.id,orderStatus,'Refund processed for return '+row.id+' ('+refund.refundId+')');
    notification = { order, returnReq: row, refundAmount: refund.amount, refundId: refund.refundId, items: readItems(row.items) };
    return status;
  });
  if (notification) {
    await require('../utils/mailer').sendMail('returnRefunded', notification.order.customer_email, notification);
  }
  return result;
}
module.exports = { processReturn, settle, syncReturnRefundStatus };
