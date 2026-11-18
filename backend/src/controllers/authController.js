const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const config = require('../config/env');
const { q } = require('../config/db');
const { HttpError, validate } = require('../middleware/error');
const { signToken } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');
const name = z.string().trim().min(2, 'Please enter your name').max(120);
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(190);
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

const schemas = {
  register: z.object({ name, email, phone, password }),
  login: z.object({ email, password: z.string().min(1, 'Enter your password') }),
  profile: z.object({ name, phone }),
  password: z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: password }),
  forgot: z.object({ email }),
  reset: z.object({ token: z.string().min(20, 'Invalid reset link'), password }),
};

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, created_at: u.created_at });
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function register(req, res) {
  const data = validate(schemas.register, req.body);
  const existing = await q('SELECT id FROM users WHERE email = ?', [data.email]);
  if (existing.length) throw new HttpError(409, 'An account with this email already exists');
  const hash = await bcrypt.hash(data.password, 11);
  const result = await q('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)', [data.name, data.email, data.phone, hash]);
  const [user] = await q('SELECT * FROM users WHERE id = ?', [result.insertId]);
  sendMail('welcome', user.email, { user });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

/** Shared by the storefront and the admin panel; `adminOnly` restricts it to administrators. */
const login = (adminOnly) => async (req, res) => {
  const data = validate(schemas.login, req.body);
  const [user] = await q('SELECT * FROM users WHERE email = ?', [data.email]);
  if (!user) {
    if (adminOnly) {
      throw new HttpError(404, 'No admin account found with this email');
    }
    throw new HttpError(404, 'No account found with this email. Please create a new account.', {
      notFound: true,
      email: data.email,
    });
  }
  if (adminOnly && user.role !== 'admin') {
    throw new HttpError(403, 'Access denied. You do not have administrative permissions.');
  }
  if (user.status !== 'active') {
    throw new HttpError(403, 'This account has been disabled. Please contact support.');
  }
  let ok = await bcrypt.compare(data.password, user.password_hash);
  if (!ok && adminOnly && config.admin.password && data.password === config.admin.password) {
    // Direct match with .env ADMIN_PASSWORD: sync database hash immediately
    const newHash = await bcrypt.hash(config.admin.password, 11);
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    ok = true;
  }
  if (!ok) {
    throw new HttpError(401, adminOnly ? 'Incorrect password. Please verify ADMIN_PASSWORD in your server .env file.' : 'Incorrect password. Please try again or use forgot password.');
  }
  await q('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  sendMail('loginAlert', user.email, {
    user,
    when: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST',
    ip: req.ip,
  });
  res.json({ token: signToken(user), user: publicUser(user) });
};

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function updateProfile(req, res) {
  const data = validate(schemas.profile, req.body);
  await q('UPDATE users SET name = ?, phone = ? WHERE id = ?', [data.name, data.phone, req.user.id]);
  res.json({ user: publicUser({ ...req.user, ...data }) });
}

async function changePassword(req, res) {
  const data = validate(schemas.password, req.body);
  const [user] = await q('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(data.currentPassword, user.password_hash))) {
    throw new HttpError(422, 'Current password is incorrect', undefined);
  }
  await q('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(data.newPassword, 11), user.id]);
  sendMail('passwordChanged', user.email, { user });
  res.json({ message: 'Password updated' });
}

async function forgotPassword(req, res) {
  const data = validate(schemas.forgot, req.body);
  const [user] = await q("SELECT * FROM users WHERE email = ? AND status = 'active'", [data.email]);
  if (!user) {
    throw new HttpError(404, 'No account found with this email address. Please create a new account.');
  }
  if (req.body.from === 'admin' || user.role === 'admin') {
    throw new HttpError(400, 'Admin password resets via email are disabled. Update ADMIN_PASSWORD in your server .env file.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  await q('UPDATE users SET reset_token_hash = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = ?', [sha256(token), user.id]);
  const base = user.role === 'admin' && req.body.from === 'admin' ? config.adminUrl : config.clientUrl;
  sendMail('passwordReset', user.email, { user, url: `${base}/reset-password?token=${token}` });

  res.json({ message: 'A reset link has been sent to your email.' });
}

async function resetPassword(req, res) {
  const data = validate(schemas.reset, req.body);
  const [user] = await q('SELECT * FROM users WHERE reset_token_hash = ? AND reset_expires > NOW()', [sha256(data.token)]);
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  await q('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires = NULL WHERE id = ?', [await bcrypt.hash(data.password, 11), user.id]);
  sendMail('passwordChanged', user.email, { user });
  res.json({ message: 'Password updated. You can now sign in.' });
}

module.exports = { register, login, me, updateProfile, changePassword, forgotPassword, resetPassword };
