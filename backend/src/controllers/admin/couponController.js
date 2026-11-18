const { z } = require('zod');
const { q } = require('../../config/db');
const { HttpError, validate } = require('../../middleware/error');

const nullable = (schema) => z.preprocess((v) => (v === '' || v == null ? null : v), schema.nullable());

const schema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, 'Use 3–40 letters, numbers, - or _'),
    description: z.string().trim().max(255).optional().default(''),
    type: z.enum(['percent', 'flat']),
    value: z.coerce.number().positive('Enter a discount value').max(999999),
    min_order: z.coerce.number().min(0).max(999999).default(0),
    max_discount: nullable(z.coerce.number().positive().max(999999)),
    usage_limit: nullable(z.coerce.number().int().positive().max(1000000)),
    per_user_limit: nullable(z.coerce.number().int().positive().max(1000000)),
    starts_at: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid start date')),
    expires_at: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid end date')),
    is_active: z.coerce.boolean().default(true),
  })
  .refine((d) => d.type !== 'percent' || d.value <= 100, { message: 'A percentage discount cannot exceed 100', path: ['value'] });

const toDate = (value, endOfDay) => (value ? `${value.slice(0, 10)} ${endOfDay ? '23:59:59' : '00:00:00'}` : null);

async function list(req, res) {
  res.json({ coupons: await q('SELECT * FROM coupons ORDER BY id DESC') });
}

async function save(req, res) {
  const d = validate(schema, req.body);
  const id = req.params.id ? Number(req.params.id) : 0;
  const clash = await q('SELECT id FROM coupons WHERE code = ? AND id <> ?', [d.code, id]);
  if (clash.length) throw new HttpError(409, 'A coupon with this code already exists');
  const values = [d.code, d.description || null, d.type, d.value, d.min_order, d.max_discount, d.usage_limit, d.per_user_limit, toDate(d.starts_at), toDate(d.expires_at, true), d.is_active ? 1 : 0];
  if (id) {
    const result = await q(
      'UPDATE coupons SET code = ?, description = ?, type = ?, value = ?, min_order = ?, max_discount = ?, usage_limit = ?, per_user_limit = ?, starts_at = ?, expires_at = ?, is_active = ? WHERE id = ?',
      [...values, id]
    );
    if (!result.affectedRows) throw new HttpError(404, 'Coupon not found');
    return res.json({ id });
  }
  const result = await q(
    'INSERT INTO coupons (code, description, type, value, min_order, max_discount, usage_limit, per_user_limit, starts_at, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    values
  );
  res.status(201).json({ id: result.insertId });
}

async function remove(req, res) {
  const result = await q('DELETE FROM coupons WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'Coupon not found');
  res.json({ message: 'Coupon deleted' });
}

module.exports = { list, save, remove };
