/**
 * Helper to import the database dump into TiDB Cloud.
 * Reads TIDB_* (or DB_*) environment variables from backend/.env.
 * No credentials hardcoded.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function importDatabase() {
  const host = process.env.TIDB_HOST || process.env.DB_HOST;
  const port = Number(process.env.TIDB_PORT || process.env.DB_PORT || 4000);
  const user = process.env.TIDB_USER || process.env.DB_USER;
  const password = process.env.TIDB_PASSWORD || process.env.DB_PASSWORD || '';
  const database = process.env.TIDB_NAME || process.env.DB_NAME || 'ooty_originals';

  console.log(`\nConnecting to TiDB Cloud at ${host}:${port}...`);
  console.log(`User: ${user}`);
  console.log(`Target database: ${database}\n`);

  // Connect to cluster with TLS
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    multipleStatements: true,
  });

  console.log('Connected to TiDB successfully!');

  // Create database if it does not exist and select it
  console.log(`Ensuring database "${database}" exists...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`USE \`${database}\`;`);
  console.log(`Using database "${database}".`);

  const dumpPath = path.join(__dirname, 'tidb_dump.sql');
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at: ${dumpPath}`);
  }

  console.log('Reading database dump (tidb_dump.sql)...');
  const sql = fs.readFileSync(dumpPath, 'utf8');

  console.log('Importing tables, products, categories, coupons, orders and users into TiDB...');
  await conn.query(sql);

  // Verification check
  const [tables] = await conn.query('SHOW TABLES;');
  console.log(`\nVerification: ${tables.length} tables found in "${database}":`);
  console.log(tables.map((t) => Object.values(t)[0]).join(', '));

  const [products] = await conn.query('SELECT COUNT(*) AS count FROM products;');
  const [users] = await conn.query('SELECT COUNT(*) AS count FROM users;');
  console.log(`\nProducts in TiDB: ${products[0].count}`);
  console.log(`Users in TiDB: ${users[0].count}`);

  console.log('\nImport completed successfully! TiDB Cloud is 100% ready.\n');
  await conn.end();
}

importDatabase().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
