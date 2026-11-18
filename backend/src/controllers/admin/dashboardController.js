const { q } = require('../../config/db');

// An order counts as a sale once it is paid, or placed as Cash on Delivery, and not cancelled.
const SALE = "o.status <> 'cancelled' AND (o.payment_status = 'paid' OR o.payment_method = 'cod')";

async function dashboard(req, res) {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;

  const [[totals], [previous], [counts], daily, topProducts, lowStock] = await Promise.all([
    q(`SELECT COALESCE(SUM(o.total), 0) AS revenue, COUNT(*) AS orders FROM orders o WHERE ${SALE} AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [days - 1]),
    q(
      `SELECT COALESCE(SUM(o.total), 0) AS revenue, COUNT(*) AS orders FROM orders o
        WHERE ${SALE} AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND o.created_at < DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [days * 2 - 1, days - 1]
    ),
    q(
      `SELECT (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
              (SELECT COUNT(*) FROM users WHERE role = 'customer' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)) AS new_customers,
              (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products,
              (SELECT COUNT(*) FROM products WHERE is_active = 1 AND stock <= 0) AS out_of_stock,
              (SELECT COUNT(*) FROM orders WHERE status IN ('confirmed', 'processing')) AS to_fulfil,
              (SELECT COUNT(*) FROM contact_messages WHERE is_read = 0) AS unread_messages`,
      [days - 1]
    ),
    q(
      `SELECT DATE_FORMAT(o.created_at, '%Y-%m-%d') AS day, COALESCE(SUM(o.total), 0) AS revenue, COUNT(*) AS orders
         FROM orders o WHERE ${SALE} AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY day ORDER BY day`,
      [days - 1]
    ),
    q(
      `SELECT oi.name, SUM(oi.quantity) AS units, SUM(oi.price * oi.quantity) AS revenue, MAX(oi.image) AS image
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE ${SALE} AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY oi.name ORDER BY units DESC LIMIT 5`,
      [days - 1]
    ),
    q(
      `SELECT p.id, p.name, p.stock, (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image
         FROM products p WHERE p.is_active = 1 AND p.stock <= 5 ORDER BY p.stock, p.name LIMIT 6`
    ),
  ]);

  // Fill the gaps so the chart has one point per day.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const row = byDay.get(key);
    series.push({ day: key, revenue: row ? Number(row.revenue) : 0, orders: row ? Number(row.orders) : 0 });
  }

  res.json({
    days,
    revenue: Number(totals.revenue),
    orders: Number(totals.orders),
    previousRevenue: Number(previous.revenue),
    previousOrders: Number(previous.orders),
    averageOrder: totals.orders ? Number(totals.revenue) / Number(totals.orders) : 0,
    ...counts,
    series,
    topProducts: topProducts.map((t) => ({ ...t, units: Number(t.units), revenue: Number(t.revenue) })),
    lowStock,
  });
}

/** Small counts for the admin panel's menu badges. */
async function summary(req, res) {
  const [row] = await q(
    `SELECT (SELECT COUNT(*) FROM orders WHERE status IN ('confirmed', 'processing')) AS to_fulfil,
            (SELECT COUNT(*) FROM contact_messages WHERE is_read = 0) AS unread_messages,
            (SELECT COUNT(*) FROM products WHERE is_active = 1 AND stock <= 0) AS out_of_stock,
            (SELECT COUNT(*) FROM return_requests WHERE status = 'pending') AS pending_returns`
  );
  res.json(row);
}

module.exports = { dashboard, summary };
