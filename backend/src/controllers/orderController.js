const { z } = require('zod');
const { q, tx } = require('../config/db');
const { HttpError, validate } = require('../middleware/error');
const { buildQuote } = require('../utils/pricing');
const { sendMail } = require('../utils/mailer');
const { paging } = require('../utils/helpers');
const { itemsSchema } = require('./cartController');
const orders = require('../services/orderService');

const placeSchema = z.object({
  items: itemsSchema.min(1, 'Your cart is empty'),
  addressId: z.coerce.number().int().positive('Select a delivery address'),
  paymentMethod: z.enum(['online', 'cod'], { errorMap: () => ({ message: 'Select a payment method' }) }),
  couponCode: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(500).optional().default(''),
});

const CANCELLABLE = ['pending', 'confirmed', 'processing'];
const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours cancellation window

async function place(req, res) {
  const data = validate(placeSchema, req.body);
  const user = req.user;
  const [address] = await q('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [data.addressId, user.id]);
  if (!address) throw new HttpError(422, 'Select a delivery address');
  if (data.paymentMethod === 'cod') {
    const [cod] = await q("SELECT `value` FROM settings WHERE settings.key = 'cod_enabled'");
    if (!cod || cod.value === '0') {
      throw new HttpError(422, 'Cash on Delivery is currently disabled. Please choose an online payment method.');
    }
  }

  const orderId = await tx(async (run) => {
    const quote = await buildQuote(run, data.items, data.couponCode, true, user.id);
    if (!quote.items.length) throw new HttpError(409, 'The items in your cart are no longer available');
    if (quote.hasIssues) {
      const bad = quote.items.find((i) => i.issue);
      throw new HttpError(409, `${bad.name}: ${bad.issue}. Please update your cart.`);
    }
    if (data.couponCode && quote.couponError) throw new HttpError(409, quote.couponError);

    const isCod = data.paymentMethod === 'cod';
    const result = await run(
      `INSERT INTO orders (user_id, status, payment_method, subtotal, discount, shipping_fee, total, coupon_code,
          customer_name, customer_email, ship_name, ship_phone, ship_line1, ship_line2, ship_city, ship_state, ship_pincode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, isCod ? 'confirmed' : 'pending', data.paymentMethod, quote.subtotal, quote.discount, quote.shipping, quote.total,
        quote.coupon ? quote.coupon.code : null, user.name, user.email,
        address.full_name, address.phone, address.line1, address.line2, address.city, address.state, address.pincode, data.notes || null,
      ]
    );
    const id = result.insertId;
    await run('UPDATE orders SET order_number = ? WHERE id = ?', [`OO${100000 + id}`, id]);

    for (const item of quote.items) {
      await run(
        'INSERT INTO order_items (order_id, product_id, variant_id, name, variant_label, image, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, item.productId, item.variantId, item.name, item.variantLabel, item.image, item.price, item.quantity]
      );
      if (item.variantId) await run('UPDATE product_variants SET stock = stock - ? WHERE id = ?', [item.quantity, item.variantId]);
      await run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.productId]);
    }
    if (quote.coupon) await run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [quote.coupon.code]);
    await orders.addHistory(run, id, isCod ? 'confirmed' : 'pending', isCod ? 'Order placed — Cash on Delivery' : 'Order placed — awaiting payment');
    return id;
  });

  const order = await orders.getOrder('id = ?', [orderId]);
  if (order.payment_method === 'cod') {
    sendMail('orderConfirmation', order.customer_email, { order });
    // Push COD order to Shiprocket automatically in the background
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
      }).catch((e) => console.error('Shiprocket COD auto-sync warning:', e.message));
    } catch (e) {
      console.error('Shiprocket COD init warning:', e.message);
    }
    return res.status(201).json({ order, payment: null });
  }

  let payment = null;
  try {
    payment = await orders.createGatewayPayment(order);
  } catch (err) {
    // The order is saved; the shopper can retry payment from the order page.
    return res.status(201).json({ order, payment: null, paymentError: err.message });
  }
  res.status(201).json({ order, payment });
}

async function listMine(req, res) {
  const { page, limit, offset } = paging(req.query, 10, 30);
  const [{ total }] = await q('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [req.user.id]);
  const rows = await q(
    `SELECT o.id, o.order_number, o.status, o.payment_method, o.payment_status, o.total, o.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT image FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image,
            (SELECT name FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS first_item
       FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [req.user.id, limit, offset]
  );
  res.json({ orders: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function findMine(req) {
  const order = await orders.getOrder('order_number = ? AND user_id = ?', [req.params.orderNumber, req.user.id]);
  if (!order) throw new HttpError(404, 'Order not found');
  return order;
}

async function detail(req, res) {
  const order = await findMine(req);
  const elapsed = order.created_at ? Date.now() - new Date(order.created_at).getTime() : 0;
  const within24Hrs = elapsed <= CANCEL_WINDOW_MS;
  const canCancel = CANCELLABLE.includes(order.status) && within24Hrs;
  const isExpiredCancel = CANCELLABLE.includes(order.status) && !within24Hrs;
  res.json({
    order,
    canCancel,
    isExpiredCancel,
    canPay: order.payment_method === 'online' && order.payment_status !== 'paid' && order.status === 'pending',
  });
}

async function cancel(req, res) {
  const order = await findMine(req);
  if (!CANCELLABLE.includes(order.status)) throw new HttpError(409, 'This order can no longer be cancelled');
  const elapsed = order.created_at ? Date.now() - new Date(order.created_at).getTime() : 0;
  if (elapsed > CANCEL_WINDOW_MS) {
    throw new HttpError(409, 'Orders can only be cancelled within 24 hours of placing them');
  }
  // Never drop an unpaid online order without asking Razorpay whether the money arrived after all.
  if (order.status === 'pending' && order.payment_method === 'online' && (await orders.confirmIfPaid(order.id)) === 'paid') {
    throw new HttpError(409, 'This order has already been paid for');
  }

  // If paid online, issue a refund back to customer's account via Razorpay
  let refundResult = null;
  const isPaidOnline = order.payment_method === 'online' && order.payment_status === 'paid';
  if (isPaidOnline) {
    const [paidPayment] = await q(
      "SELECT gateway_payment_id FROM payments WHERE order_id = ? AND status = 'paid' ORDER BY id DESC LIMIT 1",
      [order.id]
    );
    if (paidPayment?.gateway_payment_id) {
      try {
        refundResult = await orders.refundPayment(
          paidPayment.gateway_payment_id,
          order.total,
          { reason: 'Customer cancelled within 24 hours', order_number: order.order_number }
        );
      } catch (err) {
        console.error('Cancellation auto-refund note:', err.message);
      }
    }
  }

  await tx(async (run) => {
    const [fresh] = await run('SELECT status FROM orders WHERE id = ? FOR UPDATE', [order.id]);
    if (!CANCELLABLE.includes(fresh.status)) throw new HttpError(409, 'This order can no longer be cancelled');
    const newPaymentStatus = isPaidOnline ? 'refunded' : order.payment_status;
    await run("UPDATE orders SET status = 'cancelled', payment_status = ? WHERE id = ?", [newPaymentStatus, order.id]);
    await orders.restoreStock(run, order.id);
    const historyNote = `Cancelled by customer${refundResult?.refundId ? ` · Razorpay Refund: ${refundResult.refundId}` : ''}`;
    await orders.addHistory(run, order.id, 'cancelled', historyNote);
  });
  const updated = await orders.getOrder('id = ?', [order.id]);
  const neverConfirmed = order.status === 'pending' && order.payment_status !== 'paid';
  if (!neverConfirmed) sendMail('orderCancelled', updated.customer_email, { order: updated });
  res.json({ order: updated, canCancel: false, canPay: false, refund: refundResult });
}

/** Start a fresh payment attempt for an unpaid online order. */
async function retryPayment(req, res) {
  const order = await findMine(req);
  if (order.payment_method !== 'online' || order.payment_status === 'paid' || order.status !== 'pending') {
    throw new HttpError(409, 'This order does not need a payment');
  }
  // If an earlier attempt did go through at Razorpay, confirm it instead of charging again.
  if ((await orders.confirmIfPaid(order.id)) === 'paid') {
    const paid = await orders.getOrder('id = ?', [order.id]);
    sendMail('orderConfirmation', paid.customer_email, { order: paid });
    return res.json({ order: paid, payment: null });
  }
  res.json({ order, payment: await orders.createGatewayPayment(order) });
}

module.exports = { place, listMine, detail, cancel, retryPayment, CANCELLABLE };
