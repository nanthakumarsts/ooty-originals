const { z } = require('zod');
const { q } = require('../config/db');
const { validate } = require('../middleware/error');
const { buildQuote } = require('../utils/pricing');

const itemsSchema = z
  .array(
    z.object({
      productId: z.coerce.number().int().positive(),
      variantId: z.coerce.number().int().positive().nullable().optional(),
      quantity: z.coerce.number().int().min(1).max(20),
    })
  )
  .max(50);

const quoteSchema = z.object({
  items: itemsSchema,
  couponCode: z.string().trim().max(40).nullable().optional(),
  pincode: z.string().trim().max(15).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  addressId: z.coerce.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(['online', 'cod']).optional().default('online'),
});

/** Prices a cart with live data. The cart itself lives in the browser. */
async function quote(req, res) {
  const data = validate(quoteSchema, req.body);
  let pincode = data.pincode ? String(data.pincode).trim() : null;
  let country = data.country ? String(data.country).trim() : 'India';
  if (data.addressId && req.user?.id) {
    const [addr] = await q('SELECT pincode, country FROM addresses WHERE id = ? AND user_id = ?', [data.addressId, req.user.id]);
    if (addr?.pincode) pincode = String(addr.pincode).trim();
    if (addr?.country) country = String(addr.country).trim();
  }
  res.json(await buildQuote(q, data.items, data.couponCode, false, req.user?.id || null, {
    pincode,
    country,
    paymentMethod: data.paymentMethod,
  }));
}

/** Offers a shopper can apply right now. */
async function offers(req, res) {
  const rows = await q(
    `SELECT code, description, type, value, min_order, max_discount, per_user_limit, expires_at
       FROM coupons
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at >= NOW())
        AND (usage_limit IS NULL OR used_count < usage_limit)
      ORDER BY min_order`
  );
  let available = rows;
  if (req.user?.id) {
    const userOrders = await q(
      "SELECT coupon_code, COUNT(*) AS count FROM orders WHERE user_id = ? AND coupon_code IS NOT NULL AND status <> 'cancelled' GROUP BY coupon_code",
      [req.user.id]
    );
    const usedMap = new Map(userOrders.map((o) => [o.coupon_code, o.count]));
    available = rows.filter((r) => r.per_user_limit == null || (usedMap.get(r.code) || 0) < r.per_user_limit);
  }
  res.json({ offers: available });
}

module.exports = { quote, offers, itemsSchema };
