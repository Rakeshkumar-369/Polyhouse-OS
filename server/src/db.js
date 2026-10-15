// MySQL connection pool + tiny query helpers used by every route.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'polyhouse_os',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,          // DATE columns come back as 'YYYY-MM-DD' strings (no timezone shifts)
  decimalNumbers: true,       // DECIMAL columns come back as JS numbers
  multipleStatements: false,
});

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

module.exports = { pool, q, one };
