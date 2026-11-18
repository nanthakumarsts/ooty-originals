const { q } = require('../config/db');
const { HttpError } = require('../middleware/error');
const { CARD_FIELDS, toCard } = require('./catalogController');

async function items(userId) {
  const rows = await q(
    `SELECT ${CARD_FIELDS} FROM wishlist w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE w.user_id = ? AND p.is_active = 1 ORDER BY w.created_at DESC`,
    [userId]
  );
  return rows.map(toCard);
}

async function list(req, res) {
  res.json({ items: await items(req.user.id) });
}

async function add(req, res) {
  const productId = Number(req.body.productId);
  const [product] = await q('SELECT id FROM products WHERE id = ? AND is_active = 1', [productId]);
  if (!product) throw new HttpError(404, 'Product not found');
  await q('INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)', [req.user.id, productId]);
  res.status(201).json({ items: await items(req.user.id) });
}

async function remove(req, res) {
  await q('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, Number(req.params.productId)]);
  res.json({ items: await items(req.user.id) });
}

module.exports = { list, add, remove };
