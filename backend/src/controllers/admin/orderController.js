const { z } = require('zod');
const { q, tx } = require('../../config/db');
const { HttpError, validate } = require('../../middleware/error');
const { paging } = require('../../utils/helpers');
const { sendMail } = require('../../utils/mailer');
const orders = require('../../services/orderService');

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().max(250).optional().default(''),
  courier: z.string().trim().max(80).optional().default(''),
  tracking_number: z.string().trim().max(80).optional().default(''),
  notify: z.boolean().optional().default(true),
});

async function list(req, res) {
  const { page, limit, offset } = paging(req.query, 20, 100);
  const where = ['1 = 1'];
  const params = [];
  if (STATUSES.includes(req.query.status)) { where.push('o.status = ?'); params.push(req.query.status); }
  if (['pending', 'paid', 'failed', 'refunded'].includes(req.query.payment)) { where.push('o.payment_status = ?'); params.push(req.query.payment); }
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
  const byStatus = await q('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)]));
  counts.all = Object.values(counts).reduce((sum, n) => sum + n, 0);
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts });
}

async function detail(req, res) {
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');
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
    if (statusChanged && d.status === 'shipped' && shipping) note = note ? `${note} (${shipping})` : shipping;
    else if (!statusChanged && trackingChanged && shipping) note = note ? `${note} (${shipping})` : `Tracking updated: ${shipping}`;
    if (statusChanged || note) await orders.addHistory(run, order.id, d.status, note);
  });

  const updated = await orders.getOrder('id = ?', [order.id]);
  if (statusChanged && d.notify) {
    if (d.status === 'cancelled') sendMail('orderCancelled', updated.customer_email, { order: updated });
    else sendMail('orderStatus', updated.customer_email, { order: updated, note: d.note });
  }
  res.json({ order: updated });
}

async function updatePayment(req, res) {
  const d = validate(z.object({ payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']) }), req.body);
  const order = await orders.getOrder('id = ?', [req.params.id]);
  if (!order) throw new HttpError(404, 'Order not found');
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
    const pickupLocation = req.body?.pickupLocation || 'warehouse';
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
    const awbRes = await shiprocket.generateAWB(order.shiprocket_shipment_id, req.body.courierId || null);
    const awbCode = awbRes?.response?.data?.awb_code;
    const courierName = awbRes?.response?.data?.courier_name;

    if (awbCode) {
      await q('UPDATE orders SET courier = COALESCE(?, courier), tracking_number = ? WHERE id = ?', [
        courierName || null,
        awbCode,
        order.id,
      ]);
      await orders.addHistory(q, order.id, 'shipped', `AWB assigned via Shiprocket: ${courierName || 'Courier'} - ${awbCode}`);
    }
    const updated = await orders.getOrder('id = ?', [order.id]);
    res.json({ order: updated, awb: awbRes });
  } catch (err) {
    throw new HttpError(400, `Shiprocket AWB error: ${err.message}`, err.details);
  }
}

module.exports = { list, detail, updateStatus, updatePayment, syncShiprocket, generateShiprocketAWB };
