const { SALE, NET_AMOUNT } = require('../../utils/salesRevenue');
const { z } = require('zod');
const { q } = require('../../config/db');
const { HttpError, validate } = require('../../middleware/error');
const { paging } = require('../../utils/helpers');

async function list(req, res) {
  const { page, limit, offset } = paging(req.query, 20, 100);
  const where = ["u.role = 'customer'"];
  const params = [];
  if (req.query.q) {
    const like = `%${req.query.q}%`;
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(like, like, like);
  }
  if (['active', 'blocked'].includes(req.query.status)) { where.push('u.status = ?'); params.push(req.query.status); }

  const [{ total }] = await q(`SELECT COUNT(*) AS total FROM users u WHERE ${where.join(' AND ')}`, params);
  const rows = await q(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(${NET_AMOUNT}), 0) FROM orders o WHERE o.user_id = u.id AND ${SALE}) AS total_spent
       FROM users u WHERE ${where.join(' AND ')} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function detail(req, res) {
  const [user] = await q("SELECT id, name, email, phone, status, created_at, last_login_at FROM users WHERE id = ? AND role = 'customer'", [req.params.id]);
  if (!user) throw new HttpError(404, 'Customer not found');
  const [addresses, orders] = await Promise.all([
    q('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [user.id]),
    q('SELECT id, order_number, status, payment_status, payment_method, total, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50', [user.id]),
  ]);
  res.json({ user, addresses, orders });
}

async function setStatus(req, res) {
  const { status } = validate(z.object({ status: z.enum(['active', 'blocked']) }), req.body);
  const result = await q("UPDATE users SET status = ? WHERE id = ? AND role = 'customer'", [status, req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'Customer not found');
  res.json({ message: status === 'blocked' ? 'Customer blocked' : 'Customer unblocked' });
}

module.exports = { list, detail, setStatus };
