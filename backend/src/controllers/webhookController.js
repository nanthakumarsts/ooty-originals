const refunds = require('../services/returnRefund');
const crypto = require('crypto');
const config = require('../config/env');
const { q, tx } = require('../config/db');
const { sendMail } = require('../utils/mailer');
const orders = require('../services/orderService');

/**
 * Handle incoming Razorpay Webhooks
 * Verifies HMAC SHA-256 signature with config.razorpay.webhookSecret
 */
async function razorpayWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

  if (!config.razorpay.webhookSecret) return res.status(503).json({error:'Webhook unavailable'});
  if (config.razorpay.webhookSecret) {
    if (!signature) {
      console.warn('[webhook:razorpay] Missing x-razorpay-signature header');
      return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
    }
    const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(rawBody).digest('hex');
    const isValid = /^[a-f0-9]{64}$/.test(signature) && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!isValid) {
      console.warn('[webhook:razorpay] Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const eventName = event.event;
  console.log(`[webhook:razorpay] Received event: ${eventName} (ID: ${event.id || 'n/a'})`);

  try {
    switch (eventName) {
      case 'refund.created':
      case 'refund.processed':
      case 'refund.failed': {
        const entity = event.payload?.refund?.entity;
        const cancelOrder = Number(entity?.notes?.cancellation_order_id);
        if (Number.isSafeInteger(cancelOrder) && cancelOrder > 0) {
          await require('../services/cancellationRefund').settle(cancelOrder,{
            refundId:entity.id,paymentId:entity.payment_id,amount:entity.amount/100,status:entity.status,key:entity.notes.idempotencyKey
          });
          break;
        }
        const id = Number(entity?.notes?.return_id);
        if (!Number.isSafeInteger(id) || id <= 0) break;
        const [row] = await q('SELECT order_id FROM return_requests WHERE id=?', [id]);
        if (row) await refunds.settle(row.order_id,id,{
          refundId:entity.id, paymentId:entity.payment_id, amount:entity.amount/100,
          status:entity.status, key:entity.notes.idempotencyKey
        });
        break;
      }
      case 'payment.captured':
      case 'order.paid': {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id) {
          const [attempt] = await q("SELECT id,order_id AS oid,amount FROM payments WHERE gateway_order_id=? AND gateway='razorpay'",[payment.order_id]);
          if (attempt && payment.captured && payment.currency === 'INR' && payment.amount === Math.round(attempt.amount*100))
            await require('./paymentController').completeCapture(attempt,payment.id);
        }
        break;
      }

      default:
        console.log(`[webhook:razorpay] Unhandled event: ${eventName}`);
    }

    return res.json({ status: 'ok', event: eventName });
  } catch (err) {
    console.error('[webhook:razorpay] Error processing webhook:', err);
    return res.status(500).json({ error: 'Internal processing error', message: err.message });
  }
}

/**
 * Handle incoming Shiprocket Tracking Webhooks
 */
async function shiprocketWebhook(req, res) {
  if (!config.shiprocket.webhookToken) return res.status(503).json({error:'Webhook unavailable'});
  if (config.shiprocket.webhookToken) {
    const token = req.headers['x-api-key'];
    if (token !== config.shiprocket.webhookToken) {
      console.warn('[webhook:shiprocket] Unauthorized webhook request');
      return res.status(401).json({ error: 'Unauthorized Shiprocket webhook' });
    }
  }

  const payload = req.body || {};
  const currentStatus = (payload.current_status || payload.status || '').toUpperCase();
  const awb = payload.awb || payload.awb_code;
  const orderId = payload.order_id || payload.orderId;
  const shipmentId = payload.shipment_id || payload.shipmentId;

  console.log(`[webhook:shiprocket] Tracking event: status="${currentStatus}", awb="${awb}", orderId="${orderId}", shipmentId="${shipmentId}"`);

  try {
    // 1. Reverse Shipment (Return Pickup & Warehouse Return)
    const isReturnOrder = (orderId && String(orderId).startsWith('RET-')) || payload.is_return;
    if (isReturnOrder || shipmentId || awb || payload.sr_order_id) {
      const [returnReq] = await q(
        `SELECT id, order_id, status FROM return_requests 
          WHERE (shiprocket_return_shipment_id = ? OR shiprocket_return_order_id = ? OR reverse_awb_code = ?)
          LIMIT 1`,
        [shipmentId || null, payload.sr_order_id || orderId || null, awb || null]
      );

      if (returnReq) {
        if (awb) await q('UPDATE return_requests SET reverse_awb_code=COALESCE(reverse_awb_code,?) WHERE id=?',[String(awb),returnReq.id]);
        if (['PICKED UP', 'OUT FOR PICKUP', 'IN TRANSIT'].includes(currentStatus)) {
          const note = 'Reverse pickup '+returnReq.id+': '+currentStatus+' (AWB: '+(awb || 'unassigned')+')';
          await tx(async run => {
            await run('SELECT id FROM return_requests WHERE id=? FOR UPDATE',[returnReq.id]);
            const [seen] = await run('SELECT id FROM order_status_history WHERE order_id=? AND note=? LIMIT 1',[returnReq.order_id,note]);
            if (!seen) await orders.addHistory(run,returnReq.order_id,'processing',note);
          });
        }

        if (['DELIVERED', 'REACHED WAREHOUSE', 'RETURN RECEIVED'].includes(currentStatus)) {
          if (returnReq.status === 'pickup_scheduled') {
            const changed = await q(
              "UPDATE return_requests SET status = 'received', inspected_at = NOW() WHERE id = ? AND status='pickup_scheduled'",
              [returnReq.id]
            );
            if (changed.affectedRows) await orders.addHistory(
              q,
              returnReq.order_id,
              'processing',
              `Returned package received at Nilgiri warehouse via Shiprocket (${awb || 'Courier'}). Ready for inspection & refund.`
            );
          }
        }
        return res.json({status:'ok',received:true});
      }
    }

    // 2. Forward Delivery Tracking
    if (orderId && !isReturnOrder) {
      const [order] = await q(
        `SELECT id, order_number, status, tracking_number, customer_email, courier
           FROM orders
          WHERE order_number = ?
             OR shiprocket_order_id = ?
             OR shiprocket_shipment_id = ?
             OR (tracking_number IS NOT NULL AND tracking_number <> '' AND tracking_number = ?)
          LIMIT 1`,
        [String(orderId || ''), String(orderId || ''), String(shipmentId || ''), String(awb || '')]
      );

      if (order) {
        if (awb && !order.tracking_number) {
          await q('UPDATE orders SET tracking_number = ?, courier = COALESCE(courier, ?) WHERE id = ?', [
            String(awb),
            payload.courier_name || null,
            order.id,
          ]);
        }

        const isOFD = ['OUT FOR DELIVERY', 'OUT_FOR_DELIVERY', 'OFD'].includes(currentStatus);
        const isDelivered = ['DELIVERED', 'DELIVERED_SUCCESSFULLY'].includes(currentStatus);
        const isShipped = ['IN TRANSIT', 'SHIPPED', 'PICKED UP'].includes(currentStatus);

        if (isOFD && ['confirmed', 'shipped'].includes(order.status)) {
          await q("UPDATE orders SET status = 'out_for_delivery' WHERE id = ?", [order.id]);
          await orders.addHistory(q, order.id, 'out_for_delivery', `Shiprocket: Package is out for delivery with courier (${awb || order.tracking_number || 'in transit'}).`);
          sendMail('orderStatus', order.customer_email, { order: { ...order, status: 'out_for_delivery' }, note: 'Your package is out for delivery and will arrive today.' });
        } else if (isDelivered && ['shipped', 'out_for_delivery'].includes(order.status)) {
          await q("UPDATE orders SET status = 'delivered' WHERE id = ?", [order.id]);
          await orders.addHistory(q, order.id, 'delivered', `Shiprocket: Package delivered successfully (${awb || order.tracking_number || ''}).`);
          sendMail('orderStatus', order.customer_email, { order: { ...order, status: 'delivered' }, note: 'Your order has been delivered successfully. Thank you for shopping with Sannara!' });
        } else if (isShipped && ['pending', 'placed', 'confirmed'].includes(order.status)) {
          await q("UPDATE orders SET status = 'shipped' WHERE id = ?", [order.id]);
          await orders.addHistory(q, order.id, 'shipped', `Shiprocket: Package picked up by courier (${payload.courier_name || 'Courier'} - ${awb || ''}).`);
          sendMail('orderStatus', order.customer_email, { order: { ...order, status: 'shipped' }, note: 'Your order has been dispatched.' });
        }
      }
    }

    return res.json({ status: 'ok', received: true });
  } catch (err) {
    console.error('[webhook:shiprocket] Error processing tracking webhook:', err);
    return res.status(500).json({ error: 'Internal processing error', message: err.message });
  }
}

module.exports = {
  razorpayWebhook,
  shiprocketWebhook,
};
