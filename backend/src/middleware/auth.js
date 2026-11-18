const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { q } = require('../config/db');
const { HttpError } = require('./error');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expires });
}

async function loadUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
  const [user] = await q('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.status !== 'active') return null;
  return user;
}

/** Attaches req.user when a valid token is present; never rejects. */
async function optionalAuth(req, res, next) {
  req.user = await loadUser(req);
  next();
}

async function requireAuth(req, res, next) {
  req.user = await loadUser(req);
  if (!req.user) throw new HttpError(401, 'Please sign in to continue');
  next();
}

async function requireAdmin(req, res, next) {
  req.user = await loadUser(req);
  if (!req.user) throw new HttpError(401, 'Please sign in to continue');
  if (req.user.role !== 'admin') throw new HttpError(403, 'Administrator access required');
  next();
}

module.exports = { signToken, optionalAuth, requireAuth, requireAdmin };
