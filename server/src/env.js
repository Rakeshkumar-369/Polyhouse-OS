// Loads settings from the project-root .env (preferred) and server/.env (optional). Real environment variables win.
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

// DATABASE_URL=mysql://user:pass@host:3306/dbname  (what most hosts give you) -> DB_* variables
if (process.env.DATABASE_URL && !process.env.DB_HOST) {
  const u = new URL(process.env.DATABASE_URL);
  process.env.DB_HOST = u.hostname;
  process.env.DB_PORT = u.port || '3306';
  process.env.DB_USER = decodeURIComponent(u.username);
  process.env.DB_PASSWORD = decodeURIComponent(u.password);
  process.env.DB_NAME = u.pathname.replace(/^\//, '') || 'polyhouse_os';
  if (/ssl|sslaccept|ssl-mode/i.test(u.search) && !process.env.DB_SSL) process.env.DB_SSL = 'true';
}

module.exports = {
  PORT: Number(process.env.PORT || 4000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  SUPERADMIN_LOGIN: process.env.SUPERADMIN_LOGIN || 'superadmin',
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || 'admin123',
};
