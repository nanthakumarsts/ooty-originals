/**
 * Creates the database, tables and starter data.
 *   npm run db:setup   → safe to run again; only fills in what is missing
 *   npm run db:fresh   → DROPS the database first, then rebuilds it (all data is lost)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const content = require('./seed/content');

const fresh = process.argv.includes('--fresh');
const DB = config.db.database;

async function main() {
  if (!/^[A-Za-z0-9_]+$/.test(DB)) throw new Error('DB_NAME may only contain letters, numbers and underscores');

  const { database, ...server } = config.db;
  const conn = await mysql.createConnection({ ...server, multipleStatements: true, charset: 'utf8mb4' });
  const run = async (sql, params = []) => (await conn.query(sql, params))[0];

  if (fresh) {
    await run(`DROP DATABASE IF EXISTS \`${DB}\``);
    console.log(`Dropped database ${DB}`);
  }
  await run(`CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await run(`USE \`${DB}\``);
  await run(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log(`Database "${DB}" and tables are ready`);

  // ---- Admin account ----
  const admins = await run("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admins.length) {
    await run("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')", [
      config.admin.name, config.admin.email.toLowerCase(), '9487654990', await bcrypt.hash(config.admin.password, 11),
    ]);
    console.log(`Admin account created: ${config.admin.email}`);
  }

  // ---- Site settings & pages (never overwrites edits made in the admin panel) ----
  for (const [key, value] of Object.entries(content.settings)) {
    await run('INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)', [key, value]);
  }
  for (const page of content.pages) {
    await run('INSERT IGNORE INTO pages (slug, title, content) VALUES (?, ?, ?)', [page.slug, page.title, page.content]);
  }
  await run(
    "INSERT IGNORE INTO coupons (code, description, type, value, min_order) VALUES ('EASY10', '10% off on orders above ₹1,200', 'percent', 10, 1200)"
  );

  // ---- Catalogue ----
  const [{ count }] = await run('SELECT COUNT(*) AS count FROM categories');
  if (count === 0) {
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'catalog.json'), 'utf8'));
    const categoryIds = {};
    for (const c of catalog.categories.filter((x) => !x.parent)) {
      // use the category's own photo when one ships in uploads/content, otherwise a product image
      const photo = `/uploads/content/category-${c.slug}.webp`;
      const image = fs.existsSync(path.join(__dirname, '..', photo)) ? photo : c.image;
      const r = await run('INSERT INTO categories (name, slug, description, image, sort_order) VALUES (?, ?, ?, ?, ?)', [
        c.name, c.slug, content.categoryDescriptions[c.slug] || null, image, c.sort,
      ]);
      categoryIds[c.slug] = r.insertId;
    }
    for (const c of catalog.categories.filter((x) => x.parent)) {
      const r = await run('INSERT INTO categories (parent_id, name, slug, description, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [
        categoryIds[c.parent], c.name, c.slug, content.categoryDescriptions[c.slug] || null, c.image, c.sort,
      ]);
      categoryIds[c.slug] = r.insertId;
    }

    for (const p of catalog.products) {
      const r = await run(
        `INSERT INTO products (category_id, subcategory_id, name, slug, short_description, description, specifications, tags,
            price, compare_price, stock, is_featured, is_bestseller, is_new) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          categoryIds[p.category] || null, p.subcategory ? categoryIds[p.subcategory] : null, p.name, p.slug,
          p.short_description || null, p.description || null, JSON.stringify(p.specifications || []), p.tags || null,
          p.price, p.compare_price, p.stock, p.is_bestseller, p.is_bestseller, p.is_new,
        ]
      );
      for (const [i, url] of p.images.entries()) {
        await run('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)', [r.insertId, url, i]);
      }
      for (const [i, v] of p.variants.entries()) {
        await run('INSERT INTO product_variants (product_id, label, price, compare_price, stock, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [
          r.insertId, v.label, v.price, v.compare, v.stock, i,
        ]);
      }
    }
    console.log(`Seeded ${catalog.categories.length} categories and ${catalog.products.length} products`);
  } else {
    console.log('Catalogue already present — left untouched');
  }

  await conn.end();
  console.log('\nDone. Start the API with:  npm run dev');
}

main().catch((err) => {
  if (err.code === 'ECONNREFUSED') {
    console.error('\nCould not connect to MySQL. Start MySQL from the XAMPP Control Panel and try again.');
  } else {
    console.error('\nSetup failed:', err.message);
  }
  process.exit(1);
});
