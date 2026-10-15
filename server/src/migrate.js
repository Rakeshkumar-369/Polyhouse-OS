// Creates / upgrades the database. Runs automatically every time the server starts (safe to repeat),
// and creates the super admin from SUPERADMIN_LOGIN / SUPERADMIN_PASSWORD if none exists.
//   node src/migrate.js   -> run by hand
require('./env');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { pool, q, one, base, DB_NAME } = require('./db');
const env = require('./env');

// Columns added after the first release: [table, column, definition]
const COLUMN_UPGRADES = [
  ['users', 'lang', "VARCHAR(5) DEFAULT 'en'"],
];

async function ensureSchema({ log = true } = {}) {
  // Create the database if the user is allowed to (on hosted MySQL it usually already exists)
  try {
    const c = await mysql.createConnection(base);
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await c.end();
  } catch { /* no permission - fine */ }

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').replace(/^\s*--.*$/gm, '');
  for (const stmt of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await q(stmt);

  for (const [t, c, def] of COLUMN_UPGRADES) {
    const has = await one('SELECT 1 x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [DB_NAME, t, c]);
    if (!has) await q(`ALTER TABLE \`${t}\` ADD COLUMN \`${c}\` ${def}`);
  }

  if (!(await one("SELECT id FROM users WHERE role='superadmin' LIMIT 1"))) {
    await q("INSERT INTO users (org_id,name,login,password_hash,role) VALUES (NULL,'Platform Owner',?,?,'superadmin')",
      [env.SUPERADMIN_LOGIN, await bcrypt.hash(env.SUPERADMIN_PASSWORD, 10)]);
    if (log) console.log(`Super admin created -> login: ${env.SUPERADMIN_LOGIN}`);
  }
  if (log) console.log(`Database ready (${DB_NAME})`);
}

module.exports = { ensureSchema };

if (require.main === module) ensureSchema().then(() => pool.end()).catch((e) => { console.error(e.message); process.exit(1); });
