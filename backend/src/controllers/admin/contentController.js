const { z } = require('zod');
const { q, tx } = require('../../config/db');
const { HttpError, validate } = require('../../middleware/error');
const { getSettings, cleanHtml, parseJSON, paging } = require('../../utils/helpers');

/** Settings the admin panel may edit. Anything else in the request is ignored. */
const SETTING_KEYS = [
  'announcement', 'hero_eyebrow', 'hero_title', 'hero_subtitle', 'hero_image',
  'contact_phone', 'contact_whatsapp', 'contact_email', 'contact_address', 'business_hours',
  'social_facebook', 'social_instagram', 'social_youtube',
  'shipping_fee', 'free_shipping_min', 'cod_enabled', 'footer_note',
  'story_title', 'story_text', 'story_stat', 'story_stat_text', 'about_tagline',
  'delivery_short', 'returns_short', 'delivery_info', 'returns_info', 'newsletter_title', 'newsletter_text',
  'allow_cancellation', 'allow_returns',
];

/** Settings stored as JSON lists. */
const JSON_SETTINGS = {
  faqs: z.array(z.object({ q: z.string().trim().min(3).max(300), a: z.string().trim().min(3).max(2000) })).max(40),
  promises: z.array(z.object({ title: z.string().trim().min(2).max(60), text: z.string().trim().max(120) })).max(4),
  hero_slides: z
    .array(
      z.object({
        image: z.string().default(''),
        eyebrow: z.string().trim().max(80).default(''),
        title: z.string().trim().min(2, 'Every banner needs a headline').max(120),
        subtitle: z.string().trim().max(300).default(''),
        button_label: z.string().trim().max(40).default(''),
        button_link: z.string().trim().max(200).default(''),
        showcase_image: z.string().optional().default(''),
        showcase_badge: z.string().optional().default(''),
        showcase_category: z.string().optional().default(''),
        showcase_title: z.string().optional().default(''),
        showcase_rating: z.string().optional().default(''),
        showcase_price: z.string().optional().default(''),
        showcase_link: z.string().optional().default(''),
      })
    )
    .max(8, 'You can have up to 8 banners'),
  about_values: z.array(z.object({ title: z.string().trim().min(2).max(60), text: z.string().trim().max(240) })).max(6),
  promo_cards: z.any().optional(),
  promo_banners: z.any().optional(),
  promo_banner: z.any().optional(),
};
const parseSettings = (s) => ({ ...s, ...Object.fromEntries(Object.keys(JSON_SETTINGS).map((key) => [key, parseJSON(s[key], key === 'promo_banner' ? null : [])])) });

async function settings(req, res) {
  const s = await getSettings();
  res.json({ settings: parseSettings(s) });
}

async function saveSettings(req, res) {
  const body = req.body || {};
  const updates = [];
  for (const key of SETTING_KEYS) {
    if (body[key] === undefined) continue;
    let value = String(body[key] ?? '').trim().slice(0, 2000);
    if (key === 'shipping_fee' || key === 'free_shipping_min') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(422, 'Delivery amounts must be zero or more');
      value = String(n);
    }
    if (key === 'cod_enabled' || key === 'allow_cancellation' || key === 'allow_returns') {
      value = body[key] === true || body[key] === '1' || body[key] === 1 ? '1' : '0';
    }
    updates.push([key, value]);
  }
  for (const [key, schema] of Object.entries(JSON_SETTINGS)) {
    if (body[key] !== undefined) updates.push([key, JSON.stringify(validate(schema, body[key]))]);
  }
  await tx(async (run) => {
    for (const [key, value] of updates) {
      await run('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [key, value]);
    }
  });
  await settings(req, res);
}

async function pages(req, res) {
  res.json({ pages: await q('SELECT slug, title, content, updated_at FROM pages ORDER BY title') });
}

async function savePage(req, res) {
  const d = validate(z.object({ title: z.string().trim().min(2).max(160), content: z.string().max(100000) }), req.body);
  const result = await q('UPDATE pages SET title = ?, content = ? WHERE slug = ?', [d.title, cleanHtml(d.content), req.params.slug]);
  if (!result.affectedRows) throw new HttpError(404, 'Page not found');
  const [page] = await q('SELECT slug, title, content, updated_at FROM pages WHERE slug = ?', [req.params.slug]);
  res.json({ page });
}

async function messages(req, res) {
  const { page, limit, offset } = paging(req.query, 20, 100);
  const [{ total }] = await q('SELECT COUNT(*) AS total FROM contact_messages');
  const rows = await q('SELECT * FROM contact_messages ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function markMessage(req, res) {
  await q('UPDATE contact_messages SET is_read = ? WHERE id = ?', [req.body.is_read === false ? 0 : 1, req.params.id]);
  res.json({ message: 'Updated' });
}

async function deleteMessage(req, res) {
  await q('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
  res.json({ message: 'Message deleted' });
}

async function subscribers(req, res) {
  res.json({ items: await q('SELECT id, email, created_at FROM newsletter_subscribers ORDER BY id DESC LIMIT 1000') });
}


module.exports = { settings, saveSettings, pages, savePage, messages, markMessage, deleteMessage, subscribers };
