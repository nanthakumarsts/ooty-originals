const { z } = require('zod');
const { q, tx } = require('../config/db');
const { HttpError, validate } = require('../middleware/error');
const { getValidator } = require('../utils/countryValidation');

const schema = z.object({
  label: z.string().trim().min(1).max(30).default('Home'),
  full_name: z.string().trim().min(2, 'Enter the recipient name').max(120),
  phone: z.string().trim().min(7, 'Enter phone number').max(30),
  country: z.string().trim().max(80).default('India'),
  line1: z.string().trim().min(5, 'Enter house / street details').max(190),
  line2: z.string().trim().max(190).optional().default(''),
  city: z.string().trim().min(2, 'Enter your city').max(80),
  state: z.string().trim().min(2, 'Select or enter your state / province').max(80),
  pincode: z.string().trim().max(20).optional().default(''),
  is_default: z.boolean().optional().default(false),
});

function validateAddressData(body) {
  const d = validate(schema, body);
  const country = d.country || 'India';
  const validator = getValidator(country);

  // Validate phone digits based on country
  const phoneDigits = d.phone.replace(/\D/g, '');
  if (!validator.validatePhone(phoneDigits)) {
    throw new HttpError(422, validator.phoneError, { phone: validator.phoneError });
  }

  // Validate postal/PIN code based on country
  if (!validator.validatePostal(d.pincode)) {
    throw new HttpError(422, validator.postalError, { pincode: validator.postalError });
  }

  return { ...d, country };
}

const listFor = (userId) => q('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [userId]);

async function list(req, res) {
  res.json({ addresses: await listFor(req.user.id) });
}

async function create(req, res) {
  const d = validateAddressData(req.body);
  const userId = req.user.id;
  await tx(async (run) => {
    const [{ count }] = await run('SELECT COUNT(*) AS count FROM addresses WHERE user_id = ?', [userId]);
    if (count >= 10) throw new HttpError(422, 'You can save up to 10 addresses');
    const makeDefault = d.is_default || count === 0;
    if (makeDefault) await run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    await run(
      'INSERT INTO addresses (user_id, label, full_name, phone, country, line1, line2, city, state, pincode, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, d.label, d.full_name, d.phone, d.country, d.line1, d.line2 || null, d.city, d.state, d.pincode, makeDefault ? 1 : 0]
    );
  });
  res.status(201).json({ addresses: await listFor(userId) });
}

async function update(req, res) {
  const d = validateAddressData(req.body);
  const userId = req.user.id;
  const [existing] = await q('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) throw new HttpError(404, 'Address not found');
  await tx(async (run) => {
    if (d.is_default) await run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    await run(
      `UPDATE addresses SET label = ?, full_name = ?, phone = ?, country = ?, line1 = ?, line2 = ?, city = ?, state = ?, pincode = ?${d.is_default ? ', is_default = 1' : ''} WHERE id = ?`,
      [d.label, d.full_name, d.phone, d.country, d.line1, d.line2 || null, d.city, d.state, d.pincode, existing.id]
    );
  });
  res.json({ addresses: await listFor(userId) });
}

async function setDefault(req, res) {
  const userId = req.user.id;
  const [existing] = await q('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) throw new HttpError(404, 'Address not found');
  await tx(async (run) => {
    await run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    await run('UPDATE addresses SET is_default = 1 WHERE id = ?', [existing.id]);
  });
  res.json({ addresses: await listFor(userId) });
}

async function remove(req, res) {
  const userId = req.user.id;
  const [existing] = await q('SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) throw new HttpError(404, 'Address not found');
  await q('DELETE FROM addresses WHERE id = ?', [existing.id]);
  if (existing.is_default) {
    await q('UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  }
  res.json({ addresses: await listFor(userId) });
}

module.exports = { list, create, update, setDefault, remove, schema };
