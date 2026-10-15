// Platform owner (super admin): create & manage customer organisations
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../db');
const { auth, allow, sign } = require('../middleware/auth');
const { createOrg } = require('../orgService');
const { CUSTOMER_TYPES } = require('../config');
const { wrap } = require('./crud');

router.use(auth, allow('superadmin'));

router.get('/orgs', wrap(async (req, res) => {
  const rows = await q(`SELECT o.id, o.name, o.company_name, o.customer_type, o.owner_name, o.phone, o.email, o.district, o.state, o.status, o.plan, o.created_at,
      (SELECT COUNT(*) FROM farms f WHERE f.org_id=o.id) farms,
      (SELECT COALESCE(SUM(area_acres),0) FROM farms f WHERE f.org_id=o.id) acres,
      (SELECT COUNT(*) FROM users u WHERE u.org_id=o.id) users,
      (SELECT login FROM users u WHERE u.org_id=o.id AND u.role='admin' ORDER BY id LIMIT 1) admin_login,
      (SELECT COALESCE(SUM(amount),0) FROM sales s WHERE s.org_id=o.id AND s.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) sales_30d,
      (SELECT MAX(last_login) FROM users u WHERE u.org_id=o.id) last_active
    FROM organizations o ORDER BY o.created_at DESC`);
  res.json({ orgs: rows, customerTypes: CUSTOMER_TYPES, newLeads: (await one("SELECT COUNT(*) n FROM demo_requests WHERE status='new'")).n });
}));

router.post('/orgs', wrap(async (req, res) => {
  const id = await createOrg(req.body || {});
  res.json({ id });
}));

router.put('/orgs/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const allowed = ['name', 'company_name', 'customer_type', 'owner_name', 'phone', 'email', 'address', 'district', 'state', 'status', 'plan'];
  const d = Object.fromEntries(Object.entries(b).filter(([k]) => allowed.includes(k)));
  if (Object.keys(d).length) await q('UPDATE organizations SET ? WHERE id=?', [d, req.params.id]);
  res.json({ ok: true });
}));

// Reset the org admin's password
router.post('/orgs/:id/reset-admin', wrap(async (req, res) => {
  const pw = String((req.body || {}).password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const u = await one("SELECT id FROM users WHERE org_id=? AND role='admin' ORDER BY id LIMIT 1", [req.params.id]);
  if (!u) return res.status(404).json({ error: 'No admin user' });
  await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(pw, 10), u.id]);
  res.json({ ok: true });
}));

// Open the org as its admin (support / setup on behalf of customer)
router.post('/orgs/:id/impersonate', wrap(async (req, res) => {
  const u = await one("SELECT * FROM users WHERE org_id=? AND role='admin' AND active=1 ORDER BY id LIMIT 1", [req.params.id]);
  if (!u) return res.status(404).json({ error: 'No active admin user' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, role: u.role, org_id: u.org_id } });
}));

router.delete('/orgs/:id', wrap(async (req, res) => {
  // Soft delete: suspend. Data is kept.
  await q("UPDATE organizations SET status='suspended' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
}));

// Leads from the landing page
router.get('/leads', wrap(async (req, res) => {
  res.json(await q('SELECT * FROM demo_requests ORDER BY created_at DESC LIMIT 500'));
}));
router.put('/leads/:id', wrap(async (req, res) => {
  const s = ['new', 'contacted', 'converted', 'closed'].includes(req.body?.status) ? req.body.status : 'contacted';
  await q('UPDATE demo_requests SET status=? WHERE id=?', [s, req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
