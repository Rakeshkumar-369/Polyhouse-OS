// Org admin: company profile, module toggles, thresholds; user (login) management
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../db');
const { auth, allow } = require('../middleware/auth');
const { MODULES, DEFAULT_SETTINGS } = require('../config');
const { wrap } = require('./crud');

router.use(auth);

router.get('/settings', allow('admin', 'manager'), wrap(async (req, res) => {
  res.json({ org: req.org, modules: MODULES, defaults: DEFAULT_SETTINGS });
}));

router.put('/settings', allow('admin'), wrap(async (req, res) => {
  const b = req.body || {};
  const profile = ['name', 'company_name', 'owner_name', 'phone', 'email', 'address', 'district', 'state', 'gstin'];
  const d = Object.fromEntries(Object.entries(b).filter(([k]) => profile.includes(k)));
  if (b.settings) {
    const cur = req.org.settings; const s = b.settings;
    const merged = {
      ...cur, ...s,
      thresholds: { ...cur.thresholds, ...(s.thresholds || {}) },
      modules: { ...cur.modules, ...(s.modules || {}) },
    };
    if (s.thresholds) for (const k of Object.keys(merged.thresholds)) merged.thresholds[k] = Number(merged.thresholds[k]);
    if (s.opening_cash !== undefined) merged.opening_cash = Number(s.opening_cash) || 0;
    d.settings = JSON.stringify(merged);
  }
  if (Object.keys(d).length) await q('UPDATE organizations SET ? WHERE id=?', [d, req.org.id]);
  res.json({ ok: true });
}));

// ---- users (logins) of this org ----
const ROLE_OK = ['admin', 'manager', 'supervisor', 'delivery', 'labour', 'vendor'];

router.get('/users', allow('admin'), wrap(async (req, res) => {
  res.json(await q(`SELECT u.id, u.name, u.login, u.role, u.worker_id, u.party_id, u.active, u.last_login, w.name worker_name, p.name party_name
    FROM users u LEFT JOIN workers w ON w.id=u.worker_id LEFT JOIN parties p ON p.id=u.party_id WHERE u.org_id=? ORDER BY u.role, u.name`, [req.org.id]));
}));

async function checkLinks(req, b) {
  if (b.role === 'labour' && !b.worker_id) throw Object.assign(new Error('Pick the worker for this labour login'), { status: 400 });
  if (b.role === 'vendor' && !b.party_id) throw Object.assign(new Error('Pick the vendor for this vendor login'), { status: 400 });
  if (b.worker_id && !(await one('SELECT id FROM workers WHERE id=? AND org_id=?', [b.worker_id, req.org.id]))) throw Object.assign(new Error('Worker not found'), { status: 400 });
  if (b.party_id && !(await one('SELECT id FROM parties WHERE id=? AND org_id=?', [b.party_id, req.org.id]))) throw Object.assign(new Error('Vendor not found'), { status: 400 });
}

router.post('/users', allow('admin'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.login || !b.password) return res.status(400).json({ error: 'Name, login and password are required' });
  if (String(b.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!ROLE_OK.includes(b.role)) return res.status(400).json({ error: 'Invalid role' });
  if (await one('SELECT id FROM users WHERE login=?', [b.login.trim()])) return res.status(400).json({ error: 'Login already taken' });
  await checkLinks(req, b);
  const r = await q('INSERT INTO users (org_id,name,login,password_hash,role,worker_id,party_id) VALUES (?,?,?,?,?,?,?)',
    [req.org.id, b.name, b.login.trim(), await bcrypt.hash(b.password, 10), b.role, b.role === 'labour' ? b.worker_id : null, b.role === 'vendor' ? b.party_id : null]);
  res.json({ id: r.insertId });
}));

router.put('/users/:id', allow('admin'), wrap(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=? AND org_id=?', [req.params.id, req.org.id]);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const d = {};
  if (b.name) d.name = b.name;
  if (b.role && ROLE_OK.includes(b.role)) d.role = b.role;
  if (b.active !== undefined) d.active = b.active ? 1 : 0;
  if (u.id === req.user.id && (d.active === 0 || (d.role && d.role !== 'admin'))) return res.status(400).json({ error: "You can't disable or demote yourself" });
  const role = d.role || u.role;
  await checkLinks(req, { role, worker_id: b.worker_id ?? u.worker_id, party_id: b.party_id ?? u.party_id });
  d.worker_id = role === 'labour' ? (b.worker_id ?? u.worker_id) : null;
  d.party_id = role === 'vendor' ? (b.party_id ?? u.party_id) : null;
  if (b.password) {
    if (String(b.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    d.password_hash = await bcrypt.hash(b.password, 10);
  }
  await q('UPDATE users SET ? WHERE id=?', [d, u.id]);
  res.json({ ok: true });
}));

router.delete('/users/:id', allow('admin'), wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: "You can't delete yourself" });
  await q('DELETE FROM users WHERE id=? AND org_id=?', [req.params.id, req.org.id]);
  res.json({ ok: true });
}));

module.exports = router;
