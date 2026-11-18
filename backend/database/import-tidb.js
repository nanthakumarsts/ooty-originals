/**
 * Helper to import the database dump into a remote MySQL / TiDB Cloud instance.
 * Reads connection settings from backend/.env.
 * Usage:
 *   node database/import-tidb.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config/env');

async function importDatabase() {
  console.log(`Connecting to database at ${config.db.host}:${config.db.port}...`);
  console.log(`Target database: ${config.db.database}, User: ${config.db.user}`);

  const conn = await mysql.createConnection({
    ...config.db,
    multipleStatements: true,
  });

  console.log('Connected successfully!');

  const dumpPath = path.join(__dirname, 'tidb_dump.sql');
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at: ${dumpPath}`);
  }

  console.log('Reading tidb_dump.sql...');
  const sql = fs.readFileSync(dumpPath, 'utf8');

  console.log('Importing tables, products, categories, settings, and users into TiDB...');
  await conn.query(sql);

  console.log('✅ Import completed successfully! All tables and data are live in TiDB.');
  await conn.end();
}

importDatabase().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
