// MySQL connection pool + tiny query helpers used by every route.
require('./env');
const fs = require('fs');
const mysql = require('mysql2/promise');

// Cloud MySQL (TiDB Cloud, Aiven, PlanetScale-style) needs TLS: set DB_SSL=true
function sslOptions() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined;
  const o = { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_VERIFY !== 'false' };
  if (process.env.DB_SSL_CA && fs.existsSync(process.env.DB_SSL_CA)) o.ca = fs.readFileSync(process.env.DB_SSL_CA);
  return o;
}

const base = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ssl: sslOptions(),
  dateStrings: true,          // DATE columns come back as 'YYYY-MM-DD' strings (no timezone shifts)
  decimalNumbers: true,       // DECIMAL columns come back as JS numbers
};
const DB_NAME = process.env.DB_NAME || 'polyhouse_os';

const pool = mysql.createPool({ ...base, database: DB_NAME, waitForConnections: true, connectionLimit: Number(process.env.DB_POOL || 10) });

// rows = await q('SELECT ... WHERE id=?', [id])
async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
// first row or null
async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

module.exports = { pool, q, one, base, DB_NAME };
