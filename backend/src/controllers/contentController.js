const { z } = require('zod');
const { q } = require('../config/db');
const { HttpError, validate } = require('../middleware/error');
const { getSettings, parseJSON } = require('../utils/helpers');
const { sendMail } = require('../utils/mailer');

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(190),
  phone: z.string().trim().max(20).optional().default(''),
  subject: z.string().trim().min(3, 'Please add a subject').max(160),
  message: z.string().trim().min(10, 'Please write a few more words').max(3000),
});

/** Public site settings: announcement, hero copy, contact details, FAQs… */
async function settings(req, res) {
  const s = await getSettings();
  const lists = Object.fromEntries(['faqs', 'promises', 'about_values', 'hero_slides', 'promo_cards', 'promo_banners'].map((key) => [key, parseJSON(s[key], [])]));
  const promo_banner = parseJSON(s.promo_banner, null);
  res.json({ settings: { ...s, ...lists, promo_banner } });
}

async function page(req, res) {
  const [row] = await q('SELECT slug, title, content, updated_at FROM pages WHERE slug = ?', [req.params.slug]);
  if (!row) throw new HttpError(404, 'Page not found');
  res.json({ page: row });
}

async function contact(req, res) {
  const d = validate(contactSchema, req.body);
  await q('INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)', [d.name, d.email, d.phone || null, d.subject, d.message]);
  sendMail('contactReceived', d.email, { name: d.name });
  res.status(201).json({ message: 'Thanks — we will get back to you within one business day.' });
}

async function newsletter(req, res) {
  const { email } = validate(z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address').max(190) }), req.body);
  await q('INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)', [email]);
  res.status(201).json({ message: 'You are subscribed. Welcome to the hills!' });
}

module.exports = { settings, page, contact, newsletter };
