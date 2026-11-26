const refunds = require('../services/returnRefund');
const { q, tx } = require('../config/db');
const config = require('../config/env');
const { HttpError } = require('../middleware/error');
const { saveReturnAttachment } = require('../middleware/upload');
const { sendMail } = require('../utils/mailer');
const orders = require('../services/orderService');
const { selectItems, readItems } = require('../services/returnItems');
const shiprocket = require('../services/shiprocketService');

/**
 * Helper to find return request and associated order by either returnId or orderId
 */
async function findReturnAndOrder(req, allowedStatuses = null) {
  const byOrder = req.route?.path?.startsWith('/orders/');
  const rows = await q(byOrder ? 'SELECT * FROM return_requests WHERE order_id=? ORDER BY id DESC LIMIT 2' :
    'SELECT * FROM return_requests WHERE id=?', [req.params.id]);
  if (rows.length > 1) throw new HttpError(409,'Select the individual return from the returns list');
  const [returnReq] = rows;
  if (!returnReq) {
    throw new HttpError(404, 'Return request not found');
  }

  if (allowedStatuses && allowedStatuses.length && !allowedStatuses.includes(returnReq.status)) {
    throw new HttpError(400, `Return request is in "${returnReq.status}" state, not eligible for this action`);
  }

  const order = await orders.getOrder('id = ?', [returnReq.order_id]);
  if (!order) throw new HttpError(404, 'Associated order not found');

  return { returnReq, order };
}

/**
 * Customer submits a return request with reason, description, and photo/video proof
 * Validates at item-level (supports returning Item A first, and later Item B).
 */
async function requestReturn(req, res) {
  const [allowReturnRow] = await q("SELECT `value` FROM settings WHERE settings.key = 'allow_returns'");
  if (allowReturnRow && allowReturnRow.value === '0') {
    throw new HttpError(403, 'Product returns are currently disabled by store policy');
  }

  const { orderNumber } = req.params;
  const { reason, description } = req.body;

  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 100) {
    throw new HttpError(400, 'Please select a reason for the return request');
  }

  const order = await orders.getOrder('order_number = ?', [orderNumber]);
  if (!order) throw new HttpError(404, 'Order not found');

  // Verify ownership
  if (order.user_id !== req.user.id) {
    throw new HttpError(403, 'You can only request returns for your own orders');
  }

  // Check order eligibility: delivered
  if (order.status !== 'delivered') {
    throw new HttpError(400, 'Returns can only be requested after delivery');
  }

  // 7-day return policy check from delivery
  const deliveredEntry = order.history?.find((h) => h.status === 'delivered');
  const deliveredTime = deliveredEntry?.created_at ? new Date(deliveredEntry.created_at).getTime() : null;
  if (!deliveredTime || Date.now() - deliveredTime > 7 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'The 7-day return window has expired for this order');
  }

  const requestKey = req.body.requestKey;
  if (requestKey != null && !/^[a-zA-Z0-9-]{16,80}$/.test(requestKey))
    throw new HttpError(400,'Invalid return request identifier');
  const requested = readItems(req.body.items);
  const signature = items => items.map(i => String(i?.order_item_id)+'/'+String(i?.quantity)).sort().join(',');
  // Process attachments (images and videos)
  const attachments = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const saved = await saveReturnAttachment(file);
      attachments.push(saved);
    }
  }

  const result = await tx(async (run) => {
    const [current] = await run('SELECT status FROM orders WHERE id = ? FOR UPDATE', [order.id]);
    if (current?.status !== 'delivered') throw new HttpError(400, 'Delivery is required before return');
    
    // Per-item reservation check (selectItems ensures unreturned units are available)
    const prior = await run('SELECT status, items FROM return_requests WHERE order_id = ? ORDER BY id FOR UPDATE', [order.id]);
    for (const row of prior) {
      if (!row.items) continue;
      const previous = readItems(row.items);
      if ((requestKey && previous[0].requestKey === requestKey) ||
          (!requestKey && row.status === 'pending' && signature(previous) === signature(requested)))
        throw new HttpError(409,'This return request was already submitted');
    }
    const selectedItems = selectItems(order, requested, prior);
    if (requestKey) selectedItems.forEach(item => { item.requestKey = requestKey; });
    
    // requestedRefund is net price after proportional coupon discounts
    const requestedRefund = selectedItems.reduce((sum, item) => sum + Math.round(item.line_total * 100), 0) / 100;
    
    const resInsert = await run(
      `INSERT INTO return_requests (order_id, user_id, reason, description, attachments, items, refund_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [order.id, req.user.id, reason.trim(), description ? description.trim() : null, JSON.stringify(attachments), JSON.stringify(selectedItems), requestedRefund]
    );

    const itemsSummary = selectedItems.map((i) => `${i.name} (×${i.quantity})`).join(', ');
    await orders.addHistory(run, order.id, order.status, `Return requested for: ${itemsSummary} (Refund: ₹${requestedRefund}) · Reason: ${reason.trim()}`);
    return resInsert.insertId;
  });

  const [returnReq] = await q('SELECT * FROM return_requests WHERE id = ?', [result]);
  if (returnReq && typeof returnReq.attachments === 'string') {
    try { returnReq.attachments = JSON.parse(returnReq.attachments); } catch { returnReq.attachments = []; }
  }
  if (returnReq && typeof returnReq.items === 'string') {
    try { returnReq.items = JSON.parse(returnReq.items); } catch { returnReq.items = []; }
  }

  // Send confirmation email to customer
  try {
    await sendMail('returnRequested', order.customer_email, { order, returnReq });
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
 * Get return request(s) for a specific customer order
 */
async function getCustomerReturn(req, res) {
  const { orderNumber } = req.params;
  const order = await orders.getOrder('order_number = ?', [orderNumber]);
  if (!order) throw new HttpError(404, 'Order not found');

  if (order.user_id !== req.user.id) {
    throw new HttpError(403, 'Forbidden');
  }

  const rows = await q(
    'SELECT * FROM return_requests WHERE order_id = ? ORDER BY id DESC',
    [order.id]
  );

  const formatted = rows.map((r) => {
    let att = [];
    if (typeof r.attachments === 'string') {
      try { att = JSON.parse(r.attachments); } catch {}
    } else if (Array.isArray(r.attachments)) {
      att = r.attachments;
    }
    let itms = [];
    if (typeof r.items === 'string') {
      try { itms = JSON.parse(r.items); } catch {}
    } else if (Array.isArray(r.items)) {
      itms = r.items;
    }
    // Review releases the request to the scheduling queue. Customer approval
    // is communicated only after the carrier confirms a pickup date.
    if (r.status === 'approved') return { ...r, status: 'pending', admin_note: null, attachments: att, items: itms };
    return { ...r, attachments: att, items: itms };
  });

  // Return latest active return request as primary, and full list
  res.json({
    returnRequest: formatted[0] || null,
    returnRequests: formatted,
  });
}

/**
 * Admin: list all return requests
 */
async function adminListReturns(req, res) {
  const { status } = req.query;
  const where = ['1=1'];
  const params = [];

  const validStatuses = ['refund_processing','pending', 'approved', 'pickup_scheduled', 'received', 'refund_initiated', 'refunded', 'refund_failed', 'rejected', 'cancelled'];
  if (status && validStatuses.includes(status)) {
    where.push('r.status = ?');
    params.push(status);
  }

  const rows = await q(
    `SELECT r.*,
            o.order_number, o.customer_name, o.customer_email, o.ship_phone,
            o.total, o.shipping_fee, o.payment_method, o.payment_status, o.created_at AS order_created_at
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
    let itms = [];
    if (typeof r.items === 'string') {
      try { itms = JSON.parse(r.items); } catch {}
    } else if (Array.isArray(r.items)) {
      itms = r.items;
    }
    let refItms = [];
    if (typeof r.refunded_items === 'string') {
      try { refItms = JSON.parse(r.refunded_items); } catch {}
    } else if (Array.isArray(r.refunded_items)) {
      refItms = r.refunded_items;
    }
    return { ...r, attachments: att, items: itms, refunded_items: refItms };
  });

  const [counts] = await q(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status = 'refund_processing' THEN 1 ELSE 0 END), 0) AS refund_processing,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
            COALESCE(SUM(CASE WHEN status = 'pickup_scheduled' THEN 1 ELSE 0 END), 0) AS pickup_scheduled,
            COALESCE(SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END), 0) AS received,
            COALESCE(SUM(CASE WHEN status = 'refund_initiated' THEN 1 ELSE 0 END), 0) AS refund_initiated,
            COALESCE(SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END), 0) AS refunded,
            COALESCE(SUM(CASE WHEN status = 'refund_failed' THEN 1 ELSE 0 END), 0) AS refund_failed,
            COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected,
            COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
       FROM return_requests`
  );

  res.json({
    items: formatted,
    counts: counts || {
      total: 0,
      pending: 0,
      approved: 0,
      pickup_scheduled: 0,
      received: 0,
      refund_initiated: 0,
      refunded: 0,
      refund_failed: 0,
      rejected: 0,
      cancelled: 0,
    },
  });
}

/**
 * Admin: Get return request for an order
 */
async function adminGetOrderReturn(req, res) {
  const { id } = req.params;
  let [returnReq] = await q(
    req.route.path.startsWith('/orders/') ? 'SELECT * FROM return_requests WHERE order_id=? ORDER BY id DESC LIMIT 1' :
      'SELECT * FROM return_requests WHERE id=?',
    [id]
  );

  if (!returnReq) return res.json({ returnRequest: null });

  if (['refund_processing', 'refund_initiated'].includes(returnReq.status) && returnReq.razorpay_refund_id) {
    try {
      await refunds.syncReturnRefundStatus(returnReq.order_id, returnReq.id);
      [returnReq] = await q('SELECT * FROM return_requests WHERE id=?', [returnReq.id]);
    } catch (e) {
      console.error('[adminGetOrderReturn] auto-sync error:', e.message);
    }
  }

  if (typeof returnReq.attachments === 'string') {
    try { returnReq.attachments = JSON.parse(returnReq.attachments); } catch { returnReq.attachments = []; }
  }
  if (typeof returnReq.items === 'string') {
    try { returnReq.items = JSON.parse(returnReq.items); } catch { returnReq.items = []; }
  }
  if (typeof returnReq.refunded_items === 'string') {
    try { returnReq.refunded_items = JSON.parse(returnReq.refunded_items); } catch { returnReq.refunded_items = []; }
  }

  res.json({ returnRequest: returnReq });
}

/**
 * Step 1: Admin Approves Return Request (Review proofs & accept)
 * Supports both returnId and orderId
 */
async function adminApproveReturn(req, res) {
  const { id } = req.params;
  const { adminNote = '' } = req.body;

  const { returnReq, order } = await findReturnAndOrder(req, ['pending']);

  let returnItems = [];
  if (typeof returnReq.items === 'string') {
    try { returnItems = JSON.parse(returnReq.items); } catch {}
  } else if (Array.isArray(returnReq.items)) {
    returnItems = returnReq.items;
  }

  await tx(async (run) => {
    const changed = await run(
      `UPDATE return_requests
          SET status = 'approved',
              admin_note = ?
        WHERE id = ? AND status = 'pending'`,
      [adminNote.trim() || null, returnReq.id]
    );
    if (!changed.affectedRows) throw new HttpError(409, 'Return was already reviewed');

    const itemsSummary = returnItems.length > 0 ? returnItems.map((i) => `${i.name} (×${i.quantity})`).join(', ') : 'All items';
    await orders.addHistory(run, order.id, order.status, `Return under review: ${itemsSummary}. Awaiting pickup confirmation.`);
  });

  const updatedOrder = await orders.getOrder('id = ?', [order.id]);
  const [updatedReturn] = await q('SELECT * FROM return_requests WHERE id = ?', [returnReq.id]);
  if (updatedReturn && typeof updatedReturn.attachments === 'string') {
    try { updatedReturn.attachments = JSON.parse(updatedReturn.attachments); } catch {}
  }
  if (updatedReturn && typeof updatedReturn.items === 'string') {
    try { updatedReturn.items = JSON.parse(updatedReturn.items); } catch {}
  }

  res.json({
    ok: true,
    message: 'Ready to schedule pickup. The customer will be notified after courier confirmation.',
    order: updatedOrder,
    returnRequest: updatedReturn,
  });
}

/**
 * Step 2: Schedule Reverse Pickup (Shiprocket)
 * Creates Shiprocket return order with accurate returned items subtotal and generates Reverse AWB
 */
async function existingReverseShipment(returnReq) {
  const orderId = returnReq.shiprocket_return_order_id;
  const shipmentId = returnReq.shiprocket_return_shipment_id;
  if (!orderId && !shipmentId) return null;
  const remote = await shiprocket.request('/orders/show/' + encodeURIComponent(orderId));
  const shipment = [].concat(remote.data?.shipments || []).find(s => String(s.id) === String(shipmentId));
  if (!shipment || /cancelled|canceled/i.test(shipment.status || ''))
    throw new HttpError(409, 'Verify the existing return shipment in Shiprocket before scheduling');
  return shipment;
}

async function pickupOptions(order, returnReq, pickupLocation = config.shiprocket?.pickupLocation || 'warehouse-1') {
  // Validate Indian domestic address for Shiprocket reverse pickup
  if (order.ship_country && order.ship_country.toLowerCase() !== 'india') {
    throw new HttpError(422, 'Shiprocket automated pickup only supports Indian domestic addresses. For international orders, please arrange concierge return.');
  }

  const customerPincode = String(order.ship_pincode || '').trim();
  if (!/^\d{6}$/.test(customerPincode)) {
    throw new HttpError(400, `Invalid customer pincode (${customerPincode}). Domestic courier pickup requires a 6-digit Indian PIN.`);
  }

  const itemsForPickup = readItems(returnReq.items);
  const shipment = await existingReverseShipment(returnReq);
  const awb = shipment?.awb || returnReq.reverse_awb_code;
  if (awb) return { couriers: [], assigned: { awb, name: shipment?.courier || returnReq.courier_name }, itemsForPickup, shipment };
  if (!order.shiprocket_order_id || !order.shiprocket_shipment_id)
    throw new HttpError(409, 'Original shipment is missing');
  const locations = await shiprocket.getPickupLocations();
  const warehouse = locations.data?.shipping_address?.find(w => w.pickup_location === pickupLocation);
  if (!warehouse?.address || !warehouse.pin_code || !warehouse.city || !warehouse.state || !warehouse.country)
    throw new HttpError(422, 'Configured warehouse address is incomplete');
  const service = await shiprocket.checkReverseServiceability({
    customerPostcode: customerPincode, warehousePostcode: warehouse.pin_code,
    ...require('../utils/shippingPackage').calculatePackage(itemsForPickup),
    declaredValue: itemsForPickup.reduce((sum,i) => sum+i.price*i.quantity,0)
  });
  const couriers = (service.data?.available_courier_companies || [])
    .filter(c => !Number(c.blocked) && Number(c.courier_company_id) > 0 && Number(c.rate) > 0)
    .map(c => ({
      id: Number(c.courier_company_id), name: c.courier_name,
      rate: Math.round((Number(c.rate) + Number(c.whatsapp_charges || 0) + Number(c.other_charges || 0)) * 100) / 100,
    }))
    .filter(c => Number.isFinite(c.rate) && c.rate > 0)
    .sort((a,b) => a.rate - b.rate || a.id - b.id);
  if (!couriers.length)
    throw new HttpError(422, 'No reverse courier available');
  return { warehouse, couriers, itemsForPickup, shipment };
}

async function adminPickupOptions(req, res) {
  const { order, returnReq } = await findReturnAndOrder(req, ['approved']);
  const { couriers, assigned } = await pickupOptions(order, returnReq);
  res.json({ couriers, assigned });
}

async function adminSchedulePickup(req, res) {
  const { pickupDate, pickupLocation, courierId, quotedRate } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate || ''))
    throw new HttpError(400, 'Please select a valid pickup date');
  const { order, returnReq } = await findReturnAndOrder(req, ['approved','pickup_scheduled']);
  if (returnReq.status === 'pickup_scheduled') return res.json({ok:true,returnRequest:returnReq,message:'Pickup already scheduled'});
  const { warehouse, couriers, itemsForPickup, assigned, shipment } = await pickupOptions(order, returnReq, pickupLocation);
  const courier = courierId == null ? couriers[0] : couriers.find(c => c.id === Number(courierId));
  if (!assigned && (!courier || (quotedRate != null && Number(quotedRate) !== courier.rate)))
    throw new HttpError(409,'Courier availability or price changed. Review the updated quote.');
  const resumeKey = 'pickup-' + returnReq.id;
  const previousKey = returnReq.idempotency_key;
  if (previousKey && (previousKey !== resumeKey || !returnReq.shiprocket_return_shipment_id))
    throw new HttpError(409,'A booking is in progress or needs verification in Shiprocket');
  const activeKey = 'booking-' + require('crypto').randomUUID();
  const claim = await q("UPDATE return_requests SET idempotency_key=? WHERE id=? AND status='approved' AND idempotency_key <=> ?",
    [activeKey,returnReq.id,previousKey]);
  if (!claim.affectedRows) throw new HttpError(409,'Pickup is already being processed');
  try {
    await scheduleClaimedPickup(res, {order, returnReq, warehouse, courier, itemsForPickup, pickupDate, shipment});
  } finally {
    await q('UPDATE return_requests SET idempotency_key=? WHERE id=? AND idempotency_key=?',[resumeKey,returnReq.id,activeKey]);
  }
}

async function scheduleClaimedPickup(res, {order, returnReq, warehouse, courier, itemsForPickup, pickupDate, shipment}) {
  let srReturnId = returnReq.shiprocket_return_order_id;
  let srShipmentId = Number(returnReq.shiprocket_return_shipment_id);
  let reverseAwbCode = returnReq.reverse_awb_code;
  let courierName = returnReq.courier_name;
  let confirmedDate;
  if (shipment) {
    reverseAwbCode ||= shipment.awb;
    courierName ||= shipment.courier;
    confirmedDate = String(shipment.pickup_scheduled_date || '').slice(0,10);
  } else {
    const created = await shiprocket.createReturnOrder(order,itemsForPickup,warehouse,returnReq.id);
    srReturnId = created.order_id || created.return_order_id;
    srShipmentId = created.shipment_id;
    if (!srReturnId || !srShipmentId) throw new HttpError(502, 'Reverse order not confirmed');
    await q('UPDATE return_requests SET shiprocket_return_order_id=?,shiprocket_return_shipment_id=? WHERE id=?',[srReturnId,srShipmentId,returnReq.id]);
  }
  if (!reverseAwbCode) {
    const awbRes = await shiprocket.generateAWB(srShipmentId,courier.id,true);
    reverseAwbCode = awbRes.response?.data?.awb_code;
    courierName = awbRes.response?.data?.courier_name || courier.name;
    if (!reverseAwbCode) throw new HttpError(502,awbRes.message || awbRes.response?.data?.awb_assign_error || 'Shiprocket has not confirmed the reverse AWB');
  }
  await q('UPDATE return_requests SET reverse_awb_code=?,courier_name=? WHERE id=?',[reverseAwbCode,courierName,returnReq.id]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate || '')) {
    const pickup = await shiprocket.request('/courier/generate/pickup',{method:'POST',
      body:JSON.stringify({shipment_id:[srShipmentId],pickup_date:[pickupDate]})});
    confirmedDate = String(pickup.response?.pickup_scheduled_date || '').slice(0,10);
    if (Number(pickup.pickup_status) !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate))
      throw new HttpError(502,'Pickup confirmation is pending');
  }
  await tx(async (run) => {
    await run(
      `UPDATE return_requests
          SET status = 'pickup_scheduled',
              pickup_date = ?,
              shiprocket_return_order_id = COALESCE(?, shiprocket_return_order_id),
              shiprocket_return_shipment_id = COALESCE(?, shiprocket_return_shipment_id),
              reverse_awb_code = COALESCE(?, reverse_awb_code),
              courier_name = COALESCE(?, courier_name)
        WHERE id = ?`,
      [confirmedDate, srReturnId, srShipmentId, reverseAwbCode, courierName, returnReq.id]
    );

    const itemsSummary = itemsForPickup.map((i) => `${i.name} (×${i.quantity})`).join(', ');
    const note = `Reverse pickup scheduled for ${confirmedDate} for ${itemsSummary}. ${srReturnId ? `(Shiprocket Return #${srReturnId}` : ''}${reverseAwbCode ? ` · AWB: ${reverseAwbCode}` : ''})`;
    await orders.addHistory(run, order.id, order.status, note);
  });

  const updatedOrder = await orders.getOrder('id = ?', [order.id]);
  const [updatedReturn] = await q('SELECT * FROM return_requests WHERE id = ?', [returnReq.id]);
  if (updatedReturn && typeof updatedReturn.attachments === 'string') {
    try { updatedReturn.attachments = JSON.parse(updatedReturn.attachments); } catch {}
  }
  if (updatedReturn && typeof updatedReturn.items === 'string') {
    try { updatedReturn.items = JSON.parse(updatedReturn.items); } catch {}
  }

  // Send email to customer with pickup date
  try {
    await sendMail('returnPickupScheduled', order.customer_email, {
      order: updatedOrder,
      returnReq: updatedReturn,
      pickupDate:confirmedDate,
      items: itemsForPickup,
    });
  } catch (mailErr) {
    console.error('Failed to send returnPickupScheduled mail:', mailErr.message);
  }

  res.json({
    ok: true,
    message: `Reverse pickup successfully scheduled for ${confirmedDate}!`,
    order: updatedOrder,
    returnRequest: updatedReturn,
    shiprocket: {order_id:srReturnId,shipment_id:srShipmentId},
    awb: reverseAwbCode,
  });
}

/**
 * Step 3: Mark Package Received at Warehouse (Inspection Phase)
 */
async function adminReceivePackage(req, res) {
  const { id } = req.params;

  const { returnReq, order } = await findReturnAndOrder(req, ['pickup_scheduled']);

  await tx(async (run) => {
    await run(
      `UPDATE return_requests
          SET status = 'received',
              inspected_at = NOW()
        WHERE id = ?`,
      [returnReq.id]
    );

    await orders.addHistory(run, order.id, order.status, 'Returned package received at warehouse. Physical product inspection in progress.');
  });

  const updatedOrder = await orders.getOrder('id = ?', [order.id]);
  const [updatedReturn] = await q('SELECT * FROM return_requests WHERE id = ?', [returnReq.id]);
  if (updatedReturn && typeof updatedReturn.attachments === 'string') {
    try { updatedReturn.attachments = JSON.parse(updatedReturn.attachments); } catch {}
  }
  if (updatedReturn && typeof updatedReturn.items === 'string') {
    try { updatedReturn.items = JSON.parse(updatedReturn.items); } catch {}
  }

  res.json({
    ok: true,
    message: 'Package marked as received. You can now inspect the product and process refund.',
    order: updatedOrder,
    returnRequest: updatedReturn,
  });
}

/**
 * Step 4: Process Refund (Inspection Passed)
 * - Proportional coupon discount calculation
 * - Concurrency lock with idempotency key
 * - Razorpay refund execution with over-refund protection
 * - Two-phase state handling (instant processed vs pending webhook)
 */
async function adminProcessRefund(req, res) {
  const { returnReq, order } = await findReturnAndOrder(req);
  const status = await refunds.processReturn(order.id, returnReq.id);
  if (status === 'refund_failed') throw new HttpError(422, 'Gateway confirmed refund failure');
  const [updated] = await q('SELECT * FROM return_requests WHERE id=?', [returnReq.id]);
  res.status(status === 'refund_initiated' ? 202 : 200).json({
    ok: true, message: 'Refund status: ' + status, returnRequest: updated,
    order: await orders.getOrder('id=?', [order.id])
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

  const { returnReq, order } = await findReturnAndOrder(req, ['pending', 'approved']);
  const declineKey = 'decline-' + returnReq.id;
  if (returnReq.shiprocket_return_order_id) {
    // Serialize with scheduling. Keep the claim across retries while the
    // carrier processes cancellation of a partially created reverse order.
    const carrierOrder = () => shiprocket.request('/orders/show/' + encodeURIComponent(returnReq.shiprocket_return_order_id));
    const isCancelled = data => /^(?:return )?cancelled$|^(?:return )?canceled$/i.test(data?.status || '');
    if (returnReq.idempotency_key !== declineKey) {
      const initial = (await carrierOrder()).data;
      const shipment = [].concat(initial?.shipments || []).find(s => String(s.id) === String(returnReq.shiprocket_return_shipment_id));
      if (!isCancelled(initial) && (!shipment || shipment.pickup_scheduled_date || !/^(return pending|new|awb assigned|return awb assigned)$/i.test(initial?.status || '')))
        throw new HttpError(409, 'Verify the pickup status in Shiprocket before declining this return.');
      const claim = await q("UPDATE return_requests SET idempotency_key=? WHERE id=? AND status='approved' AND (idempotency_key IS NULL OR idempotency_key=?)",
        [declineKey,returnReq.id,'pickup-'+returnReq.id]);
      if (!claim.affectedRows) throw new HttpError(409, 'Another booking action is in progress.');
    }
    const current = (await carrierOrder()).data;
    if (!isCancelled(current)) {
      const shipment = [].concat(current?.shipments || []).find(s => String(s.id) === String(returnReq.shiprocket_return_shipment_id));
      if (!shipment || shipment.pickup_scheduled_date || !/^(return pending|new|awb assigned|return awb assigned)$/i.test(current?.status || ''))
        throw new HttpError(409, 'Verify the carrier status before completing the decline.');
      await shiprocket.request('/orders/cancel', {method:'POST',body:JSON.stringify({ids:[Number(returnReq.shiprocket_return_order_id)]})});
      if (!isCancelled((await carrierOrder()).data))
        throw new HttpError(409, 'Shiprocket cancellation is pending. Retry Decline Return after the carrier confirms.');
    }
  }

  await tx(async (run) => {
    const changed = await run(
      `UPDATE return_requests
          SET status = 'rejected',
              admin_note = ?
        WHERE id = ? AND status IN ('pending','approved') AND (idempotency_key IS NULL OR idempotency_key = ?)`,
      [adminNote.trim(), returnReq.id, declineKey]
    );
    if (!changed.affectedRows) throw new HttpError(409, 'Verify the existing pickup attempt before declining this return.');

    await orders.addHistory(run, order.id, order.status, `Return request rejected: ${adminNote.trim()}`);
  });

  const updatedOrder = await orders.getOrder('id = ?', [order.id]);
  const [updatedReturn] = await q('SELECT * FROM return_requests WHERE id = ?', [returnReq.id]);
  if (updatedReturn && typeof updatedReturn.attachments === 'string') {
    try { updatedReturn.attachments = JSON.parse(updatedReturn.attachments); } catch {}
  }

  // Send rejection email to customer
  try {
    await sendMail('returnRejected', order.customer_email, {
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
  adminSchedulePickup,
  adminPickupOptions,
  adminReceivePackage,
  adminProcessRefund,
  adminRejectReturn,
};
