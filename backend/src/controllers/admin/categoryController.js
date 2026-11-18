const { z } = require('zod');
const { q } = require('../../config/db');
const { HttpError, validate } = require('../../middleware/error');
const { uniqueSlug } = require('../../utils/helpers');

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a category name').max(120),
  parent_id: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  description: z.string().trim().max(500).optional().default(''),
  image: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().regex(/^\/uploads\/[\w./-]+$/).nullable()),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.coerce.boolean().default(true),
});

async function list(req, res) {
  const rows = await q(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id OR p.subcategory_id = c.id) AS product_count
       FROM categories c ORDER BY c.sort_order, c.name`
  );
  res.json({ categories: rows });
}

async function save(req, res) {
  const d = validate(schema, req.body);
  const id = req.params.id ? Number(req.params.id) : null;

  if (d.parent_id) {
    if (d.parent_id === id) throw new HttpError(422, 'A category cannot be its own parent');
    const [parent] = await q('SELECT id, parent_id FROM categories WHERE id = ?', [d.parent_id]);
    if (!parent) throw new HttpError(422, 'Parent category not found');
    if (parent.parent_id) throw new HttpError(422, 'Sub-categories can only be one level deep');
    if (id) {
      const [{ children }] = await q('SELECT COUNT(*) AS children FROM categories WHERE parent_id = ?', [id]);
      if (children) throw new HttpError(422, 'This category has sub-categories, so it cannot become a sub-category itself');
    }
  }

  const slug = await uniqueSlug('categories', d.name, id || 0);
  const values = [d.parent_id, d.name, slug, d.description || null, d.image, d.sort_order, d.is_active ? 1 : 0];
  if (id) {
    const result = await q('UPDATE categories SET parent_id = ?, name = ?, slug = ?, description = ?, image = ?, sort_order = ?, is_active = ? WHERE id = ?', [...values, id]);
    if (!result.affectedRows) throw new HttpError(404, 'Category not found');
    return res.json({ id });
  }
  const result = await q('INSERT INTO categories (parent_id, name, slug, description, image, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', values);
  res.status(201).json({ id: result.insertId });
}

async function remove(req, res) {
  const [{ products }] = await q(
    'SELECT COUNT(*) AS products FROM products WHERE category_id = ? OR subcategory_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?)',
    [req.params.id, req.params.id, req.params.id]
  );
  if (products) throw new HttpError(409, `Move or delete the ${products} product(s) in this category first`);
  const result = await q('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'Category not found');
  res.json({ message: 'Category deleted' });
}

module.exports = { list, save, remove };
