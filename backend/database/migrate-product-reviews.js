const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/config/db');

pool.query(fs.readFileSync(path.join(__dirname, 'product-reviews.sql'), 'utf8'))
  .then(() => console.log('Product reviews table ready'))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
