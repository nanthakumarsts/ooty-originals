const { z } = require('zod');
const { q, tx } = require('../../config/db');
const { HttpError, validate } = require('../../middleware/error');
const { paging } = require('../../utils/helpers');
const { sendMail } = require('../../utils/mailer');
const config = require('../../config/env');
const orders = require('../../services/orderService');

const STATUSES = ['pending', 'placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'cancellation_requested'];

const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().max(250).optional().default(''),
  courier: z.string().trim().max(80).optional().default(''),
  tracking_number: z.string().trim().max(80).optional().default(''),
  notify: z.boolean().optional().default(true),
});

async function list(req, res) {
  const { page, limit, offset } = paging(req.query, 20, 100);
  const where = [
    '1 = 1',
    "NOT (o.payment_method = 'online' AND o.payment_status IN ('pending', 'failed') AND o.status IN ('pending', 'cancelled'))",
  ];
  const params = [];
  if (STATUSES.includes(req.query.status)) { where.push('o.status = ?'); params.push(req.query.status); }
  if (['pending', 'paid', 'failed', 'refunded', 'partially_refunded'].includes(req.query.payment)) { where.push('o.payment_status = ?'); params.push(req.query.payment); }
  if (req.query.user) { where.push('o.user_id = ?'); params.push(req.query.user); }
  if (req.query.q) {
    const like = `%${req.query.q}%`;
    where.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.ship_phone LIKE ?)');
    params.push(like, like, like, like);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { where.push('o.created_at >= ?'); params.push(req.query.from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { where.push('o.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(req.query.to); }

  const [{ total }] = await q(`SELECT COUNT(*) AS total FROM orders o WHERE ${where.join(' AND ')}`, params);
  const rows = await q(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_email, o.ship_city, o.status, o.payment_method, o.payment_status, o.total, o.created_at,
            o.ship_phone, o.courier, o.tracking_number,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS line_count,
            (SELECT name FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS first_item,
            (SELECT image FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image
       FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const byStatus = await q(
    "SELECT status, COUNT(*) AS count FROM orders o WHERE NOT (o.payment_method = 'online' AND o.payment_status IN ('pending', 'failed') AND o.status IN ('pending', 'cancelled')) GROUP BY status"
  );
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)]));
  counts.all = Object.values(counts).reduce((sum, n) => sum + n, 0);
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts });
}

async function detail(req, res) {
  let order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');

  // If order has an online cancellation refund awaiting confirmation, auto-reconcile with Razorpay
  if (order.status === 'cancellation_requested' && order.payment_method === 'online') {
    const cancelItems = Array.isArray(order.cancellation_items)
      ? order.cancellation_items
      : (typeof order.cancellation_items === 'string' ? JSON.parse(order.cancellation_items || '[]') : []);
    const attempt = cancelItems[0]?.refundAttempt;
    if (attempt?.id && attempt?.status === 'pending') {
      try {
        await require('../../services/cancellationRefund').syncRefundStatus(order.id);
        order = await orders.getOrder('id = ?', [order.id]);
      } catch (e) {
        console.error('[admin:detail] auto-sync error:', e.message);
      }
    }
  }

  res.json({ order });
}

async function updateStatus(req, res) {
  const d = validate(statusSchema, req.body);
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status === 'cancelled' && d.status !== 'cancelled') {
    throw new HttpError(409, 'A cancelled order cannot be reopened — its stock has already been returned');
  }

  const statusChanged = d.status !== order.status;
  await tx(async (run) => {
    const [locked] = await run('SELECT status,payment_method,payment_status FROM orders WHERE id=? FOR UPDATE',[order.id]);
    if (locked.status === 'cancellation_requested' || locked.status !== order.status)
      throw new HttpError(409,'Use the cancellation review or refresh this order');
    if (d.status === 'cancelled' && locked.payment_method === 'online' && ['paid','partially_refunded'].includes(locked.payment_status))
      throw new HttpError(409,'A paid order must use the cancellation refund workflow');
    await run('UPDATE orders SET status = ?, courier = ?, tracking_number = ? WHERE id = ?', [
      d.status, d.courier || order.courier || null, d.tracking_number || order.tracking_number || null, order.id,
    ]);
    if (statusChanged && d.status === 'cancelled') await orders.restoreStock(run, order.id);
    // Cash on Delivery is collected at the door.
    if (statusChanged && d.status === 'delivered' && order.payment_method === 'cod' && order.payment_status === 'pending') {
      await run("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [order.id]);
    }
    const courier = d.courier || order.courier;
    const tracking = d.tracking_number || order.tracking_number;
    const trackingChanged = (d.courier && d.courier !== order.courier) || (d.tracking_number && d.tracking_number !== order.tracking_number);
    const shipping = tracking ? `${courier ? `${courier} · ` : ''}Tracking ${tracking}` : '';
    let note = d.note || null;
    if (statusChanged && d.status === 'confirmed' && !note) note = 'Order confirmed by store. Ready for dispatch.';
    if (statusChanged && d.status === 'shipped' && shipping) note = note ? `${note} (${shipping})` : shipping;
    else if (!statusChanged && trackingChanged && shipping) note = note ? `${note} (${shipping})` : `Tracking updated: ${shipping}`;
    if (statusChanged || note) await orders.addHistory(run, order.id, d.status, note);
  });

  const updated = await orders.getOrder('id = ?', [order.id]);
  if (statusChanged && d.notify) {
    if (d.status === 'cancelled') await sendMail('orderCancelled', updated.customer_email, { order: updated });
    else await sendMail('orderStatus', updated.customer_email, { order: updated, note: d.note });
  }
  res.json({ order: updated });
}

async function updatePayment(req, res) {
  const d = validate(z.object({ payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded']) }), req.body);
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.payment_method === 'online' && d.payment_status !== order.payment_status)
    throw new HttpError(409,'Online payment status is managed by gateway confirmation');
  if (d.payment_status !== order.payment_status) {
    await tx(async (run) => {
      await run('UPDATE orders SET payment_status = ? WHERE id = ?', [d.payment_status, order.id]);
      await orders.addHistory(run, order.id, order.status, `Payment marked as ${d.payment_status}`);
    });
  }
  res.json({ order: await orders.getOrder('id = ?', [order.id]) });
}

async function syncShiprocket(req, res) {
  const shiprocket = require('../../services/shiprocketService');
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');

  try {
    const pickupLocation = req.body?.pickupLocation || config.shiprocket?.pickupLocation || 'warehouse-1';
    const srRes = await shiprocket.createOrder(order, order.items, pickupLocation);
    if (srRes?.order_id) {
      await q('UPDATE orders SET shiprocket_order_id = ?, shiprocket_shipment_id = ? WHERE id = ?', [
        String(srRes.order_id),
        String(srRes.shipment_id || ''),
        order.id,
      ]);
      await orders.addHistory(q, order.id, order.status, `Synced with Shiprocket (Order ID: ${srRes.order_id}, Shipment: ${srRes.shipment_id || 'N/A'})`);
    }
    const updated = await orders.getOrder('id = ?', [order.id]);
    res.json({ order: updated, shiprocket: srRes });
  } catch (err) {
    throw new HttpError(400, `Shiprocket error: ${err.message}`, err.details);
  }
}

async function generateShiprocketAWB(req, res) {
  const shiprocket = require('../../services/shiprocketService');
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');
  if (!order.shiprocket_shipment_id) {
    throw new HttpError(400, 'Order is not synced with Shiprocket yet. Please sync the order first.');
  }

  try {
    const courierId = req.body?.courierId || null;
    const awbRes = await shiprocket.generateAWB(order.shiprocket_shipment_id, courierId);
    const awbCode = awbRes?.response?.data?.awb_code || awbRes?.awb_code;
    const courierName = awbRes?.response?.data?.courier_name || awbRes?.courier_name;
    const awbError = awbRes?.response?.data?.awb_assign_error || (awbRes?.awb_assign_status === 0 ? awbRes?.message : null);

    if (awbError) {
      throw new Error(awbError);
    }

    if (!awbCode) {
      const msg = awbRes?.message || 'Could not assign AWB from Shiprocket. Please check courier serviceability or recharge your Shiprocket wallet.';
      throw new Error(msg);
    }

    await q('UPDATE orders SET status = "shipped", courier = COALESCE(?, courier), tracking_number = ? WHERE id = ?', [
      courierName || null,
      awbCode,
      order.id,
    ]);
    await orders.addHistory(q, order.id, 'shipped', `AWB assigned via Shiprocket: ${courierName || 'Courier'} - ${awbCode}`);

    const updated = await orders.getOrder('id = ?', [order.id]);
    sendMail('orderStatus', updated.customer_email, {
      order: updated,
      note: `Your order has been shipped via ${courierName || 'our delivery partner'}. Tracking number: ${awbCode}.`
    });
    res.json({ order: updated, awb: awbRes });
  } catch (err) {
    throw new HttpError(400, `Shiprocket AWB: ${err.message}`, err.details);
  }
}

async function syncTracking(req, res) {
  const shiprocket = require('../../services/shiprocketService');
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');

  const trackingNum = order.tracking_number;
  const shipmentId = order.shiprocket_shipment_id;

  if (!trackingNum && !shipmentId) {
    throw new HttpError(400, 'Order does not have a tracking number or Shiprocket shipment ID yet');
  }

  let trackingData = null;
  try {
    if (trackingNum) {
      trackingData = await shiprocket.trackAWB(trackingNum);
    } else if (shipmentId) {
      trackingData = await shiprocket.request(`/courier/track/shipment/${encodeURIComponent(shipmentId)}`, { method: 'GET' });
    }
  } catch (err) {
    throw new HttpError(400, `Shiprocket tracking error: ${err.message}`);
  }

  let trackInfo = trackingData?.tracking_data || trackingData?.response;
  if (!trackInfo && typeof trackingData === 'object' && trackingData !== null) {
    const firstVal = Object.values(trackingData)[0];
    trackInfo = firstVal?.tracking_data || firstVal;
  }

  const trackActivity = trackInfo?.shipment_track?.[0] || {};
  const currentStatus = String(trackActivity.current_status || trackInfo?.status || '').toUpperCase();
  const rawStatus = currentStatus || (trackInfo?.error ? 'Awaiting courier pickup' : 'In transit');

  if (currentStatus) {
    const isOFD = ['OUT FOR DELIVERY', 'OUT_FOR_DELIVERY', 'OFD'].includes(currentStatus);
    const isDelivered = ['DELIVERED', 'DELIVERED_SUCCESSFULLY'].includes(currentStatus);
    const isShipped = ['IN TRANSIT', 'SHIPPED', 'PICKED UP'].includes(currentStatus);

    if (isOFD && ['confirmed', 'shipped'].includes(order.status)) {
      await q("UPDATE orders SET status = 'out_for_delivery' WHERE id = ?", [order.id]);
      await orders.addHistory(q, order.id, 'out_for_delivery', `Shiprocket Live Sync: Package is out for delivery (${trackingNum || 'in transit'}).`);
      sendMail('orderStatus', order.customer_email, { order: { ...order, status: 'out_for_delivery' }, note: 'Your package is out for delivery and will arrive today.' });
    } else if (isDelivered && ['shipped', 'out_for_delivery'].includes(order.status)) {
      await q("UPDATE orders SET status = 'delivered' WHERE id = ?", [order.id]);
      await orders.addHistory(q, order.id, 'delivered', `Shiprocket Live Sync: Package delivered successfully (${trackingNum || ''}).`);
      sendMail('orderStatus', order.customer_email, { order: { ...order, status: 'delivered' }, note: 'Your order has been delivered successfully. Thank you for shopping with Sannara!' });
    } else if (isShipped && ['pending', 'placed', 'confirmed'].includes(order.status)) {
      await q("UPDATE orders SET status = 'shipped' WHERE id = ?", [order.id]);
      await orders.addHistory(q, order.id, 'shipped', `Shiprocket Live Sync: Package in transit (${trackingNum || ''}).`);
      sendMail('orderStatus', order.customer_email, { order: { ...order, status: 'shipped' }, note: 'Your order has been dispatched.' });
    }
  }

  const updated = await orders.getOrder('id = ?', [order.id]);
  res.json({ order: updated, tracking: trackInfo, status: rawStatus, message: trackInfo?.error || `Tracking status: ${rawStatus}` });
}

/** Approve a cancellation request from customer and process full or partial refund via Razorpay */
async function approveCancellation(req, res) {
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status !== 'cancellation_requested') {
    throw new HttpError(400, 'This order does not have a pending cancellation request');
  }

  if (order.payment_method === 'online') {
    const status = await require('../../services/cancellationRefund').approve(order.id);
    const updated = await orders.getOrder('id=?',[order.id]);
    if (status === 'failed') throw new HttpError(422,'Gateway confirmed cancellation refund failure');
    return res.status(status === 'pending' ? 202 : 200).json({order:updated,refundStatus:status,
      message: status === 'pending' ? 'Refund awaiting gateway confirmation' : 'Cancellation refund '+status});
  }
  let cancelItems = [];
  if (typeof order.cancellation_items === 'string') {
    try { cancelItems = JSON.parse(order.cancellation_items); } catch {}
  } else if (Array.isArray(order.cancellation_items)) {
    cancelItems = order.cancellation_items;
  }

  const totalOrderQty = (order.items || []).reduce((s, it) => s + Number(it.quantity), 0);
  const cancelQty = cancelItems.reduce((s, it) => s + Number(it.quantity), 0);
  const isPartial = cancelItems.length > 0 && cancelQty < totalOrderQty;

  const refundAmount = order.cancellation_refund_amount != null
    ? Number(order.cancellation_refund_amount)
    : Number(order.total);

  const refundResult = null; // Offline cancellation has no gateway refund.
  await tx(async (run) => {
    const [locked] = await run('SELECT status FROM orders WHERE id=? FOR UPDATE', [order.id]);
    if (locked?.status !== 'cancellation_requested') throw new HttpError(409, 'Cancellation already resolved');
    if (isPartial) {
      // 1. Restore stock for ONLY the cancelled items
      for (const item of cancelItems) {
        const prodId = item.productId || item.product_id;
        const varId = item.variantId || item.variant_id;
        const qty = Number(item.quantity) || 1;
        if (varId) await run('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [qty, varId]);
        if (prodId) await run('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, prodId]);

        // 2. Adjust or remove from order_items
        const matches = item.orderItemId
          ? await run('SELECT id, quantity FROM order_items WHERE order_id=? AND id=?',[order.id,item.orderItemId])
          : await run('SELECT id, quantity FROM order_items WHERE order_id=? AND product_id=? AND variant_id <=> ?',
              [order.id,prodId,varId || null]);
        if (matches.length !== 1 || matches[0].quantity < qty)
          throw new HttpError(409, 'Cancellation item requires reconciliation');
        const [existing] = matches;
        if (existing) {
          if (existing.quantity <= qty) {
            await run('DELETE FROM order_items WHERE id = ?', [existing.id]);
          } else {
            await run('UPDATE order_items SET quantity = quantity - ? WHERE id = ?', [qty, existing.id]);
          }
        }
      }

      // 3. Recalculate subtotal and total
      const remainingItems = await run('SELECT price, quantity FROM order_items WHERE order_id = ?', [order.id]);
      const newSubtotal = remainingItems.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);
      const newTotal = Math.max(0, Number(order.total) - refundAmount);

      await run(
        `UPDATE orders SET 
           status = 'confirmed', 
           payment_status = CASE WHEN payment_method = 'online' THEN 'partially_refunded' ELSE payment_status END,
           subtotal = ?, discount = ?,
           total = ?,
           cancellation_items = NULL,
           cancellation_refund_amount = NULL,
           cancellation_reason = NULL,
           cancelled_items = ?,
           cancelled_amount = COALESCE(cancelled_amount, 0) + ?
         WHERE id = ?`,
        [newSubtotal, newSubtotal + Number(order.shipping_fee) - newTotal, newTotal, JSON.stringify(cancelItems), refundAmount, order.id]
      );

      const itemsSummary = cancelItems.map((i) => `${i.name} (×${i.quantity})`).join(', ');
      const historyNote = `Partial cancellation approved by Admin (${itemsSummary}) · Refunded ₹${refundAmount}${refundResult?.refundId ? ` (Razorpay: ${refundResult.refundId})` : ''} · Remaining order confirmed`;
      await orders.addHistory(run, order.id, 'confirmed', historyNote);
    } else {
      // Full cancellation
      const newPaymentStatus = order.payment_status;
      await run(
        `UPDATE orders SET 
           status = 'cancelled', 
           payment_status = ?,
           cancellation_items = NULL,
           cancellation_refund_amount = NULL,
           cancellation_reason = NULL,
           cancelled_items = ?,
           cancelled_amount = ?
         WHERE id = ?`,
        [newPaymentStatus, JSON.stringify(cancelItems.length ? cancelItems : order.items), refundAmount, order.id]
      );
      await orders.restoreStock(run, order.id);
      const historyNote = `Cancellation approved by Admin · Refunded ₹${refundAmount}${refundResult?.refundId ? ` · Razorpay Refund ID: ${refundResult.refundId}` : ''}`;
      await orders.addHistory(run, order.id, 'cancelled', historyNote);
    }
  });

  const updated = await orders.getOrder('id = ?', [order.id]);
  await sendMail('orderCancelled', updated.customer_email, { order: updated });
  res.json({
    order: updated,
    refund: refundResult,
    message: isPartial
      ? `Partial cancellation approved. Refund of ₹${refundAmount} processed and remaining order updated.`
      : 'Full cancellation approved, inventory restored, and refund processed successfully.',
  });
}

/** Reject a cancellation request from customer */
async function rejectCancellation(req, res) {
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status !== 'cancellation_requested') {
    throw new HttpError(400, 'This order does not have a pending cancellation request');
  }

  const adminNote = (req.body?.adminNote || 'Cancellation request declined by store admin').trim().slice(0, 250);

  await tx(async (run) => {
    const [locked] = await run('SELECT status,cancellation_items FROM orders WHERE id=? FOR UPDATE',[order.id]);
    const lines = typeof locked.cancellation_items === 'string' ? JSON.parse(locked.cancellation_items) : locked.cancellation_items;
    if (locked.status !== 'cancellation_requested' || ['processing','pending'].includes(lines?.[0]?.refundAttempt?.status))
      throw new HttpError(409,'Refund already in progress or cancellation completed');
    await run(
      "UPDATE orders SET status = 'confirmed', cancellation_admin_note = ?, cancellation_items = NULL, cancellation_refund_amount = NULL, cancellation_reason = NULL WHERE id = ?",
      [adminNote, order.id]
    );
    await orders.addHistory(
      run,
      order.id,
      'confirmed',
      `Cancellation request declined by Admin · Note: ${adminNote}`
    );
  });

  const updated = await orders.getOrder('id = ?', [order.id]);
  sendMail('orderStatus', updated.customer_email, {
    order: updated,
    note: `Your order cancellation request was declined by our store team. Note: ${adminNote}`,
  });

  res.json({ order: updated, message: 'Cancellation request declined.' });
}

async function syncCancellationRefund(req, res) {
  const orderId = req.params.id;
  const status = await require('../../services/cancellationRefund').syncRefundStatus(orderId);
  const order = await orders.getOrder('id = ?', [orderId]);
  res.json({
    order,
    status,
    message: status === 'processed' ? 'Refund reconciled and processed successfully' : 'Refund is still pending with gateway',
  });
}

module.exports = {
  list,
  detail,
  updateStatus,
  updatePayment,
  syncShiprocket,
  generateShiprocketAWB,
  approveCancellation,
  rejectCancellation,
  syncCancellationRefund,
  syncTracking,
};
