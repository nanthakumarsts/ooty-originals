const { tx, pool } = require('../src/config/db');
const { cleanProductDescription } = require('../src/utils/productDescription');

tx(async run => {
  const products = await run('SELECT id, description FROM products WHERE description LIKE ? FOR UPDATE', ['%sp-ea-%']);
  let changed = 0;
  for (const product of products) {
    const clean = cleanProductDescription(product.description);
    if (clean === product.description) continue;
    await run('UPDATE products SET description=? WHERE id=?', [clean, product.id]);
    changed++;
  }
  return changed;
}).then(count => console.log('Product descriptions cleaned:', count))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
