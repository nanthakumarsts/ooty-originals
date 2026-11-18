const { q, tx } = require('../config/db');
const { HttpError } = require('../middleware/error');
const { saveReturnAttachment } = require('../middleware/upload');
const { sendMail } = require('../utils/mailer');
const orders = require('../services/orderService');
const shiprocket = require('../services/shiprocketService');

/**
 * Customer submits a return request with reason, description, and photo/video proof
 */
async function requestReturn(req, res) {
  const { orderNumber } = req.params;
  const { reason, description } = req.body;

  if (!reason || !reason.trim()) {
    throw new HttpError(400, 'Please select a reason for the return request');
  }

  const order = await orders.getOrder('order_number = ?', [orderNumber]);
  if (!order) throw new HttpError(404, 'Order not found');

  // Verify ownership
  if (order.user_id !== req.user.id) {
    throw new HttpError(403, 'You can only request returns for your own orders');
  }

  // Check order eligibility: delivered or shipped
  if (!['delivered', 'shipped'].includes(order.status)) {
    throw new HttpError(400, 'Returns can only be requested once an order is shipped or delivered');
  }

  // Check if active return already exists
  const [existing] = await q(
    'SELECT id, status FROM return_requests WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [order.id]
  );
  if (existing && existing.status === 'pending') {
    throw new HttpError(400, 'A return request is already pending review for this order');
  }
  if (existing && existing.status === 'approved') {
    throw new HttpError(400, 'A return has already been approved for this order');
  }

  // Process attachments (images and videos)
  const attachments = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const saved = await saveReturnAttachment(file);
      attachments.push(saved);
    }
  }

  const result = await tx(async (run) => {
    const resInsert = await run(
      `INSERT INTO return_requests (order_id, user_id, reason, description, attachments, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [order.id, req.user.id, reason.trim(), description ? description.trim() : null, JSON.stringify(attachments)]
    );

    await orders.addHistory(run, order.id, order.status, `Return requested by customer: ${reason.trim()}`);
    return resInsert.insertId;
  });

  const [returnReq] = await q('SELECT * FROM return_requests WHERE id = ?', [result]);
  if (returnReq && typeof returnReq.attachments === 'string') {
    try { returnReq.attachments = JSON.parse(returnReq.attachments); } catch { returnReq.attachments = []; }
  }

  // Send confirmation email to customer
  try {
    sendMail('returnRequested', order.customer_email, { order, returnReq });
  } catch (err) {
    console.error('Failed to send returnRequested mail:', err.message);
  }

  res.status(201).json({
    ok: true,
    message: 'Return request submitted successfully. Our team will review your proof.',
    returnRequest: returnReq,
  });
}

/**
 * Get return request for a specific customer order
 */
async function getCustomerReturn(req, res) {
  const { orderNumber } = req.params;
  const order = await orders.getOrder('order_number = ?', [orderNumber]);
  if (!order) throw new HttpError(404, 'Order not found');

  if (order.user_id !== req.user.id) {
    throw new HttpError(403, 'Forbidden');
  }

  const [returnReq] = await q(
    'SELECT * FROM return_requests WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [order.id]
  );

  if (returnReq && typeof returnReq.attachments === 'string') {
    try { returnReq.attachments = JSON.parse(returnReq.attachments); } catch { returnReq.attachments = []; }
  }

  res.json({ returnRequest: returnReq || null });
}

/**
 * Admin: list all return requests
 */
async function adminListReturns(req, res) {
  const { status } = req.query;
  const where = ['1=1'];
  const params = [];

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    where.push('r.status = ?');
    params.push(status);
  }

  const rows = await q(
    `SELECT r.*,
            o.order_number, o.customer_name, o.customer_email, o.ship_phone,
            o.total, o.payment_method, o.payment_status, o.created_at AS order_created_at
       FROM return_requests r
       JOIN orders o ON o.id = r.order_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.id DESC`,
    params
  );

  const formatted = rows.map((r) => {
    let att = [];
    if (typeof r.attachments === 'string') {
      try { att = JSON.parse(r.attachments); } catch {}
    } else if (Array.isArray(r.attachments)) {
      att = r.attachments;
    }
    return { ...r, attachments: att };
  });

  const [counts] = await q(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
            COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected
       FROM return_requests`
  );

  res.json({ items: formatted, counts: counts || { total: 0, pending: 0, approved: 0, rejected: 0 } });
}

/**
 * Admin: Get return request for an order
 */
async function adminGetOrderReturn(req, res) {
  const { id } = req.params;
  const [returnReq] = await q(
    'SELECT * FROM return_requests WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [id]
  );

  if (!returnReq) return res.json({ returnRequest: null });

  if (typeof returnReq.attachments === 'string') {
    try { returnReq.attachments = JSON.parse(returnReq.attachments); } catch { returnReq.attachments = []; }
  }

  res.json({ returnRequest: returnReq });
}

/**
 * Admin: Approve return request
 * - Automatically triggers Razorpay refund if paid online
 * - Automatically creates Shiprocket Return Order for reverse pickup
 * - Updates DB & restores stock
 * - Sends customer luxury email
 */
async function adminApproveReturn(req, res) {
  const { id } = req.params;
  const { adminNote = '', pickupLocation = 'warehouse' } = req.body;

  const order = await orders.getOrder('id = ?', [id]);
  if (!order) throw new HttpError(404, 'Order not found');

  const [returnReq] = await q(
    'SELECT * FROM return_requests WHERE order_id = ? AND status = "pending" ORDER BY id DESC LIMIT 1',
    [order.id]
  );
  if (!returnReq) {
    throw new HttpError(400, 'No pending return request found for this order');
  }

  // 1. Process Refund
  let refundResult = null;
  const isPaidOnline = order.payment_method === 'online' && order.payment_status === 'paid';

  if (isPaidOnline) {
    const [paidPayment] = await q(
      "SELECT gateway_payment_id, amount FROM payments WHERE order_id = ? AND status = 'paid' ORDER BY id DESC LIMIT 1",
      [order.id]
    );

    if (paidPayment?.gateway_payment_id) {
      refundResult = await orders.refundPayment(
        paidPayment.gateway_payment_id,
        order.total,
        { reason: returnReq.reason, order_number: order.order_number }
      );
    }
  }

  // 2. Create Shiprocket Reverse Pickup (Return Order)
  let srReturnRes = null;
  try {
    srReturnRes = await shiprocket.createReturnOrder(order, order.items, pickupLocation);
  } catch (srErr) {
    console.error('Shiprocket return order creation note:', srErr.message);
    // Don't fail the entire approval if Shiprocket returns warning, but log details
  }

  const srReturnId = srReturnRes?.order_id || srReturnRes?.return_order_id ? String(srReturnRes.order_id || srReturnRes.return_order_id) : null;
  const srShipmentId = srReturnRes?.shipment_id ? String(srReturnRes.shipment_id) : null;

  // 3. Update Database in a transaction
  await tx(async (run) => {
    await run(
      `UPDATE return_requests
          SET status = 'approved',
              admin_note = ?,
              refund_amount = ?,
              razorpay_refund_id = ?,
              shiprocket_return_order_id = ?,
              shiprocket_return_shipment_id = ?
        WHERE id = ?`,
      [
        adminNote.trim() || 'Return and refund approved by store',
        order.total,
        refundResult?.refundId || null,
        srReturnId,
        srShipmentId,
        returnReq.id,
      ]
    );

    // Update order status to returned & payment_status to refunded
    await run(
      `UPDATE orders
          SET status = 'returned',
              payment_status = 'refunded'
        WHERE id = ?`,
      [order.id]
    );

    // Put items back in inventory
    await orders.restoreStock(run, order.id);

    // Add order status history
    const historyNote = `Return approved & Refund initiated (${refundResult?.refundId ? `Razorpay: ${refundResult.refundId}` : 'COD Refund'}). ${srReturnId ? `Shiprocket Reverse Pickup: #${srReturnId}` : ''}`;
    await orders.addHistory(run, order.id, 'returned', historyNote);
  });

  const updatedOrder = await orders.getOrder('id = ?', [order.id]);
  const [updatedReturn] = await q('SELECT * FROM return_requests WHERE id = ?', [returnReq.id]);
  if (updatedReturn && typeof updatedReturn.attachments === 'string') {
    try { updatedReturn.attachments = JSON.parse(updatedReturn.attachments); } catch {}
  }

  // 4. Send customer approval email
  try {
    sendMail('returnApproved', order.customer_email, {
      order: updatedOrder,
      returnReq: updatedReturn,
      refund: refundResult,
    });
  } catch (mailErr) {
    console.error('Failed to send returnApproved mail:', mailErr.message);
  }

  res.json({
    ok: true,
    message: 'Return approved, refund processed, and reverse pickup initiated!',
    order: updatedOrder,
    returnRequest: updatedReturn,
    refund: refundResult,
    shiprocket: srReturnRes,
  });
}

/**
 * Admin: Reject return request
 */
async function adminRejectReturn(req, res) {
  const { id } = req.params;
  const { adminNote = '' } = req.body;

  if (!adminNote.trim()) {
    throw new HttpError(400, 'Please provide a reason for rejecting the return request');
  }

  const order = await orders.getOrder('id = ?', [id]);
  if (!order) throw new HttpError(404, 'Order not found');

  const [returnReq] = await q(
    'SELECT * FROM return_requests WHERE order_id = ? AND status = "pending" ORDER BY id DESC LIMIT 1',
    [order.id]
  );
  if (!returnReq) {
    throw new HttpError(400, 'No pending return request found for this order');
  }

  await tx(async (run) => {
    await run(
      `UPDATE return_requests
          SET status = 'rejected',
              admin_note = ?
        WHERE id = ?`,
      [adminNote.trim(), returnReq.id]
    );

    await orders.addHistory(run, order.id, order.status, `Return request rejected: ${adminNote.trim()}`);
  });

  const updatedOrder = await orders.getOrder('id = ?', [order.id]);
  const [updatedReturn] = await q('SELECT * FROM return_requests WHERE id = ?', [returnReq.id]);
  if (updatedReturn && typeof updatedReturn.attachments === 'string') {
    try { updatedReturn.attachments = JSON.parse(updatedReturn.attachments); } catch {}
  }

  // Send rejection email to customer
  try {
    sendMail('returnRejected', order.customer_email, {
      order: updatedOrder,
      returnReq: updatedReturn,
      adminNote: adminNote.trim(),
    });
  } catch (mailErr) {
    console.error('Failed to send returnRejected mail:', mailErr.message);
  }

  res.json({
    ok: true,
    message: 'Return request has been declined',
    order: updatedOrder,
    returnRequest: updatedReturn,
  });
}

module.exports = {
  requestReturn,
  getCustomerReturn,
  adminListReturns,
  adminGetOrderReturn,
  adminApproveReturn,
  adminRejectReturn,
};
