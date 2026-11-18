const { z } = require('zod');
const { q, tx } = require('../../config/db');
const { HttpError, validate } = require('../../middleware/error');
const { saveImage } = require('../../middleware/upload');
const { uniqueSlug, cleanHtml, parseJSON, paging } = require('../../utils/helpers');

const money = z.coerce.number().min(0, 'Price cannot be negative').max(999999);
const optionalMoney = z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().min(0).max(999999).nullable());

const productSchema = z.object({
  name: z.string().trim().min(2, 'Enter a product name').max(190),
  sku: z.string().trim().max(60).optional().default(''),
  category_id: z.coerce.number().int().positive('Choose a category'),
  subcategory_id: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
  short_description: z.string().trim().max(700).optional().default(''),
  description: z.string().max(60000).optional().default(''),
  tags: z.string().trim().max(500).optional().default(''),
  price: money,
  compare_price: optionalMoney,
  stock: z.coerce.number().int().min(0).max(1000000).default(0),
  is_active: z.coerce.boolean().default(true),
  is_featured: z.coerce.boolean().default(false),
  is_bestseller: z.coerce.boolean().default(false),
  is_new: z.coerce.boolean().default(false),
  images: z.array(z.string().regex(/^\/uploads\/[\w./-]+$/, 'Invalid image path')).max(8).default([]),
  specifications: z
    .array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) }))
    .max(30)
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.coerce.number().int().positive().optional(),
        label: z.string().trim().min(1, 'Every option needs a name').max(80),
        price: money,
        compare_price: optionalMoney,
        stock: z.coerce.number().int().min(0).max(1000000).default(0),
      })
    )
    .max(30)
    .default([]),
});

async function list(req, res) {
  const { page, limit, offset } = paging(req.query, 20, 100);
  const where = ['1 = 1'];
  const params = [];
  if (req.query.q) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  if (req.query.category) {
    where.push('(p.category_id = ? OR p.subcategory_id = ?)');
    params.push(req.query.category, req.query.category);
  }
  if (req.query.status === 'active') where.push('p.is_active = 1');
  if (req.query.status === 'hidden') where.push('p.is_active = 0');
  if (req.query.status === 'out') where.push('p.stock <= 0');
  if (req.query.status === 'low') where.push('p.stock BETWEEN 1 AND 5');

  const [{ total }] = await q(`SELECT COUNT(*) AS total FROM products p WHERE ${where.join(' AND ')}`, params);
  const rows = await q(
    `SELECT p.id, p.name, p.slug, p.sku, p.price, p.compare_price, p.stock, p.is_active, p.is_bestseller, p.is_new, p.is_featured,
            c.name AS category_name, sc.name AS sub_name,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
            (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variant_count
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories sc ON sc.id = p.subcategory_id
      WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function detail(req, res) {
  const [product] = await q('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) throw new HttpError(404, 'Product not found');
  const [images, variants] = await Promise.all([
    q('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [product.id]),
    q('SELECT id, label, price, compare_price, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order, id', [product.id]),
  ]);
  res.json({
    product: { ...product, specifications: parseJSON(product.specifications, []), images: images.map((i) => i.url), variants },
  });
}

/** Insert or update a product together with its images, options and specifications. */
async function save(req, res) {
  const d = validate(productSchema, req.body);
  const id = req.params.id ? Number(req.params.id) : null;
  if (id) {
    const [existing] = await q('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) throw new HttpError(404, 'Product not found');
  }
  const slug = await uniqueSlug('products', d.name, id || 0);

  // With options, the product itself shows the lowest option price and the combined stock.
  const hasVariants = d.variants.length > 0;
  const cheapest = hasVariants ? [...d.variants].sort((a, b) => a.price - b.price)[0] : null;
  const price = hasVariants ? cheapest.price : d.price;
  const comparePrice = hasVariants ? cheapest.compare_price : d.compare_price;
  const stock = hasVariants ? d.variants.reduce((sum, v) => sum + v.stock, 0) : d.stock;

  const fields = [
    d.category_id, d.subcategory_id, d.name, slug, d.sku || null, d.short_description || null, cleanHtml(d.description) || null,
    JSON.stringify(d.specifications), d.tags || null, price, comparePrice, stock,
    d.is_active ? 1 : 0, d.is_featured ? 1 : 0, d.is_bestseller ? 1 : 0, d.is_new ? 1 : 0,
  ];

  const productId = await tx(async (run) => {
    let pid = id;
    if (pid) {
      await run(
        `UPDATE products SET category_id = ?, subcategory_id = ?, name = ?, slug = ?, sku = ?, short_description = ?, description = ?,
            specifications = ?, tags = ?, price = ?, compare_price = ?, stock = ?, is_active = ?, is_featured = ?, is_bestseller = ?, is_new = ?
          WHERE id = ?`,
        [...fields, pid]
      );
    } else {
      const result = await run(
        `INSERT INTO products (category_id, subcategory_id, name, slug, sku, short_description, description, specifications, tags,
            price, compare_price, stock, is_active, is_featured, is_bestseller, is_new) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        fields
      );
      pid = result.insertId;
    }

    await run('DELETE FROM product_images WHERE product_id = ?', [pid]);
    for (const [index, url] of d.images.entries()) {
      await run('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)', [pid, url, index]);
    }

    // Keep existing option ids stable so carts and past orders keep pointing at the right option.
    const keep = d.variants.filter((v) => v.id).map((v) => v.id);
    await run(`DELETE FROM product_variants WHERE product_id = ?${keep.length ? ' AND id NOT IN (?)' : ''}`, keep.length ? [pid, keep] : [pid]);
    for (const [index, v] of d.variants.entries()) {
      if (v.id) {
        await run('UPDATE product_variants SET label = ?, price = ?, compare_price = ?, stock = ?, sort_order = ? WHERE id = ? AND product_id = ?', [v.label, v.price, v.compare_price, v.stock, index, v.id, pid]);
      } else {
        await run('INSERT INTO product_variants (product_id, label, price, compare_price, stock, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [pid, v.label, v.price, v.compare_price, v.stock, index]);
      }
    }
    return pid;
  });

  res.status(id ? 200 : 201).json({ id: productId, slug });
}

async function remove(req, res) {
  const result = await q('DELETE FROM products WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'Product not found');
  res.json({ message: 'Product deleted' });
}

/** Quick toggles from the product table (visible / stock) without opening the full form. */
async function patch(req, res) {
  const d = validate(z.object({ is_active: z.boolean().optional(), stock: z.coerce.number().int().min(0).optional() }), req.body);
  const [product] = await q('SELECT id, (SELECT COUNT(*) FROM product_variants WHERE product_id = products.id) AS variants FROM products WHERE id = ?', [req.params.id]);
  if (!product) throw new HttpError(404, 'Product not found');
  if (d.is_active !== undefined) await q('UPDATE products SET is_active = ? WHERE id = ?', [d.is_active ? 1 : 0, product.id]);
  if (d.stock !== undefined) {
    if (product.variants) throw new HttpError(422, 'This product has options — edit stock per option');
    await q('UPDATE products SET stock = ? WHERE id = ?', [d.stock, product.id]);
  }
  res.json({ message: 'Updated' });
}

async function uploadImages(req, res) {
  if (!req.files || !req.files.length) throw new HttpError(422, 'Choose at least one image');
  const folder = req.query.folder === 'content' ? 'content' : 'products';
  const urls = [];
  for (const file of req.files) urls.push(await saveImage(file, folder));
  res.status(201).json({ urls });
}

module.exports = { list, detail, save, remove, patch, uploadImages };
