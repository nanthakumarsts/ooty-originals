const mysql = require('mysql2/promise');
const config = require('./env');

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  // MySQL silently drops connections that sit unused (and all of them when the computer sleeps).
  // Keep them alive, and close spare ones after a minute so a dead one is never handed out.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 4,
  idleTimeout: 60000,
  charset: 'utf8mb4',
  decimalNumbers: true,
  dateStrings: false,
});

const LOST_CONNECTION = new Set(['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR']);

/** Run a query on the pool and return the rows (or the result header for writes). */
async function q(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    // A connection that died while idle fails on its first use. Reading is safe to repeat, so try once more.
    if (!LOST_CONNECTION.has(err.code) || !/^\s*(select|show)\b/i.test(sql)) throw err;
    const [rows] = await pool.query(sql, params);
    return rows;
  }
}

/** Run `work` inside a transaction. `work` receives a `q`-style function bound to the connection. */
async function tx(work) {
  const conn = await pool.getConnection();
  const run = async (sql, params = []) => (await conn.query(sql, params))[0];
  try {
    await conn.beginTransaction();
    const result = await work(run);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, q, tx };
