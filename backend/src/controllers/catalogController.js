const { q } = require('../config/db');
const { HttpError } = require('../middleware/error');
const { parseJSON, paging } = require('../utils/helpers');

/** Columns every product card needs. */
const CARD_FIELDS = `p.id, p.name, p.slug, p.price, p.compare_price, p.stock, p.short_description,
  p.is_bestseller, p.is_new, p.is_featured, p.created_at,
  c.name AS category_name, c.slug AS category_slug,
  (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
  (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variant_count`;

const toCard = (p) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  price: Number(p.price),
  comparePrice: p.compare_price && Number(p.compare_price) > Number(p.price) ? Number(p.compare_price) : null,
  inStock: p.stock > 0,
  shortDescription: p.short_description,
  isBestseller: !!p.is_bestseller,
  isNew: !!p.is_new,
  category: p.category_name ? { name: p.category_name, slug: p.category_slug } : null,
  image: p.image,
  hasVariants: p.variant_count > 0,
});

async function categories(req, res) {
  const rows = await q(
    `SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.image,
            (SELECT COUNT(*) FROM products p WHERE p.is_active = 1 AND (p.category_id = c.id OR p.subcategory_id = c.id)) AS product_count
       FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.name`
  );
  const top = rows.filter((c) => !c.parent_id).map((c) => ({ ...c, children: rows.filter((s) => s.parent_id === c.id) }));
  res.json({ categories: top });
}

async function products(req, res) {
  const { page, limit, offset } = paging(req.query, 12, 48);
  const where = ['p.is_active = 1'];
  const params = [];
  const orderParams = [];

  const search = String(req.query.q || '').trim().slice(0, 80);
  if (search) {
    // every word must appear somewhere in the name, tags, summary or category
    for (const word of search.split(/\s+/).slice(0, 6)) {
      const like = `%${word.replace(/[%_\\]/g, '\\$&')}%`;
      where.push('(p.name LIKE ? OR p.tags LIKE ? OR p.short_description LIKE ? OR c.name LIKE ?)');
      params.push(like, like, like, like);
    }
  }
  if (req.query.category) {
    where.push('(c.slug = ? OR sc.slug = ?)');
    params.push(req.query.category, req.query.category);
  }
  if (req.query.sub) {
    where.push('sc.slug = ?');
    params.push(req.query.sub);
  }
  const min = Number(req.query.min);
  const max = Number(req.query.max);
  if (Number.isFinite(min) && min > 0) { where.push('p.price >= ?'); params.push(min); }
  if (Number.isFinite(max) && max > 0) { where.push('p.price <= ?'); params.push(max); }
  if (req.query.stock === 'in') where.push('p.stock > 0');
  if (req.query.stock === 'out') where.push('p.stock <= 0');
  if (req.query.tag === 'bestseller') where.push('p.is_bestseller = 1');
  if (req.query.tag === 'new') where.push('p.is_new = 1');
  if (req.query.tag === 'sale') where.push('p.compare_price > p.price');
  if (req.query.ids) {
    const ids = String(req.query.ids).split(',').map(Number).filter((n) => n > 0).slice(0, 40);
    where.push('p.id IN (?)');
    params.push(ids.length ? ids : [0]);
  }

  let orderBy;
  switch (req.query.sort) {
    case 'price_asc': orderBy = 'p.price ASC, p.id DESC'; break;
    case 'price_desc': orderBy = 'p.price DESC, p.id DESC'; break;
    case 'latest': orderBy = 'p.created_at DESC, p.id DESC'; break;
    default:
      if (search) {
        orderBy = '(p.name LIKE ?) DESC, (p.name LIKE ?) DESC, p.is_bestseller DESC, p.id DESC';
        orderParams.push(`${search}%`, `%${search}%`);
      } else {
        orderBy = '(p.stock > 0) DESC, p.is_bestseller DESC, p.is_featured DESC, p.is_new DESC, p.id DESC';
      }
  }

  const from = `FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN categories sc ON sc.id = p.subcategory_id
    WHERE ${where.join(' AND ')}`;
  const [{ total }] = await q(`SELECT COUNT(*) AS total ${from}`, params);
  const rows = await q(`SELECT ${CARD_FIELDS} ${from} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, ...orderParams, limit, offset]);
  const [bounds] = await q('SELECT MIN(price) AS min, MAX(price) AS max FROM products WHERE is_active = 1');

  res.json({
    items: rows.map(toCard),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    priceRange: { min: Math.floor(bounds.min || 0), max: Math.ceil(bounds.max || 0) },
  });
}

async function productDetail(req, res) {
  const [p] = await q(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug, sc.name AS sub_name, sc.slug AS sub_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories sc ON sc.id = p.subcategory_id
      WHERE p.slug = ? AND p.is_active = 1`,
    [req.params.slug]
  );
  if (!p) throw new HttpError(404, 'Product not found');
  const [images, variants, related] = await Promise.all([
    q('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [p.id]),
    q('SELECT id, label, price, compare_price, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order, id', [p.id]),
    q(
      `SELECT ${CARD_FIELDS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = 1 AND p.id <> ? AND p.category_id <=> ?
        ORDER BY (p.subcategory_id <=> ?) DESC, (p.stock > 0) DESC, p.is_bestseller DESC, p.id DESC LIMIT 4`,
      [p.id, p.category_id, p.subcategory_id]
    ),
  ]);
  res.json({
    product: {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: Number(p.price),
      comparePrice: p.compare_price && Number(p.compare_price) > Number(p.price) ? Number(p.compare_price) : null,
      stock: Math.max(0, p.stock),
      inStock: p.stock > 0,
      shortDescription: p.short_description,
      description: p.description,
      specifications: parseJSON(p.specifications, []),
      isBestseller: !!p.is_bestseller,
      isNew: !!p.is_new,
      category: p.category_name ? { name: p.category_name, slug: p.category_slug } : null,
      subcategory: p.sub_name ? { name: p.sub_name, slug: p.sub_slug } : null,
      images: images.map((i) => i.url),
      variants: variants.map((v) => ({
        id: v.id,
        label: v.label,
        price: Number(v.price),
        comparePrice: v.compare_price && Number(v.compare_price) > Number(v.price) ? Number(v.compare_price) : null,
        stock: Math.max(0, v.stock),
      })),
    },
    related: related.map(toCard),
  });
}

/** Full detail for several products at once — powers the compare page. */
async function compare(req, res) {
  const ids = String(req.query.ids || '').split(',').map(Number).filter((n) => n > 0).slice(0, 4);
  if (!ids.length) return res.json({ products: [] });
  const rows = await q(
    `SELECT ${CARD_FIELDS}, p.specifications FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1 AND p.id IN (?)`,
    [ids]
  );
  const variants = await q('SELECT product_id, label, price FROM product_variants WHERE product_id IN (?) ORDER BY sort_order, id', [ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  res.json({
    products: ids.filter((id) => byId.has(id)).map((id) => {
      const r = byId.get(id);
      return {
        ...toCard(r),
        specifications: parseJSON(r.specifications, []),
        variants: variants.filter((v) => v.product_id === id).map((v) => ({ label: v.label, price: Number(v.price) })),
      };
    }),
  });
}

module.exports = { categories, products, productDetail, compare, CARD_FIELDS, toCard };
