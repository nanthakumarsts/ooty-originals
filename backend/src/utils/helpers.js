const sanitizeHtml = require('sanitize-html');
const { q } = require('../config/db');

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

/** Returns a slug that is unique in `table`, ignoring the row with id `ignoreId`. */
async function uniqueSlug(table, text, ignoreId = 0) {
  const base = slugify(text) || 'item';
  let slug = base;
  for (let i = 2; ; i++) {
    const rows = await q(`SELECT id FROM ${table} WHERE slug = ? AND id <> ? LIMIT 1`, [slug, ignoreId]);
    if (!rows.length) return slug;
    slug = `${base}-${i}`;
  }
}

function parseJSON(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Rich text written in the admin panel is cleaned before it is stored. */
const cleanHtml = (html) =>
  sanitizeHtml(html || '', {
    allowedTags: ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'br', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: { h1: 'h2' },
  }).trim();

const inr = (amount) =>
  '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Reads page & limit from a query string with sane bounds. */
function paging(query, defaultLimit = 12, maxLimit = 60) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

async function getSettings() {
  const rows = await q('SELECT `key`, `value` FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

module.exports = { slugify, uniqueSlug, parseJSON, cleanHtml, inr, round2, paging, getSettings };
