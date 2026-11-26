// These expressions use the orders table alias "o". A cancellation can already
// reduce o.total, so use the captured payment balance for partial refunds.
const SALE = `o.status <> 'cancelled' AND o.payment_status <> 'refunded'
  AND (o.payment_method = 'cod' OR o.payment_status IN ('paid','partially_refunded'))`;
const NET_AMOUNT = `CASE WHEN o.payment_status = 'partially_refunded' THEN
  COALESCE((SELECT SUM(p.amount - p.refunded_amount) FROM payments p
    WHERE p.order_id = o.id AND p.status IN ('paid','partially_refunded','refunded')), 0)
  ELSE o.total END`;

module.exports = { SALE, NET_AMOUNT };
