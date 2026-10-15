// Creating a new customer organisation (used by super admin screen and by seed.js)
const bcrypt = require('bcryptjs');
const { q, one } = require('./db');
const { CUSTOMER_TYPES, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } = require('./config');

async function createOrg(data) {
  const type = CUSTOMER_TYPES[data.customer_type] ? data.customer_type : 'single_polyhouse';
  if (!data.name) throw Object.assign(new Error('Organisation name is required'), { status: 400 });
  if (!data.admin_login || !data.admin_password) throw Object.assign(new Error('Admin login and password are required'), { status: 400 });
  if (await one('SELECT id FROM users WHERE login=?', [data.admin_login])) throw Object.assign(new Error('That admin login is already taken'), { status: 400 });

  const settings = { ...DEFAULT_SETTINGS, modules: { ...CUSTOMER_TYPES[type].modules }, books_start: new Date().toISOString().slice(0, 10) };
  const r = await q(
    `INSERT INTO organizations (name, company_name, customer_type, owner_name, phone, email, address, district, state, plan, settings)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [data.name, data.company_name || data.name, type, data.owner_name || null, data.phone || null, data.email || null,
      data.address || null, data.district || null, data.state || null, data.plan || 'standard', JSON.stringify(settings)]);
  const orgId = r.insertId;
  for (const [name, kind] of DEFAULT_CATEGORIES) await q('INSERT INTO expense_categories (org_id,name,kind) VALUES (?,?,?)', [orgId, name, kind]);
  await q('INSERT INTO users (org_id,name,login,password_hash,role) VALUES (?,?,?,?,?)',
    [orgId, data.owner_name || data.name + ' Admin', data.admin_login, await bcrypt.hash(data.admin_password, 10), 'admin']);
  return orgId;
}

module.exports = { createOrg };
