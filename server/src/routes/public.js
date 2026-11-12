// No-login endpoints used by the landing page and login page
const router = require('express').Router();
const { q, one } = require('../db');
const { limit } = require('../middleware/auth');
const { wrap } = require('./crud');

// "Request a demo" form on the landing page -> Super admin > Leads
router.post('/demo-request', limit(5, 3600), wrap(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 150); const phone = String(b.phone || '').trim().slice(0, 30);
  if (!name || phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Please enter your name and a 10-digit phone number' });
  const cut = (v, n) => (v ? String(v).slice(0, n) : null);
  await q('INSERT INTO demo_requests (name,phone,email,farm_type,acres,location,message) VALUES (?,?,?,?,?,?,?)',
    [name, phone, cut(b.email, 150), cut(b.farm_type, 40), cut(b.acres, 30), cut(b.location, 150), cut(b.message, 500)]);
  res.json({ ok: true });
}));

// One-tap demo logins on the login page - only when DEMO_MODE=true and the demo org exists
router.get('/demo-accounts', wrap(async (req, res) => {
  if (String(process.env.DEMO_MODE).toLowerCase() !== 'true') return res.json([]);
  if (!(await one("SELECT id FROM users WHERE login='xyz'"))) return res.json([]);
  res.json([
    { login: 'superadmin', password: process.env.SUPERADMIN_PASSWORD || 'admin123', role: 'Super admin', name: 'Platform owner', hint: 'Create customers, see leads' },
    { login: 'xyz', password: 'xyz123', role: 'Owner', name: 'XYZ Polyhouse', hint: 'Dashboard, reports, settings' },
    { login: 'super1', password: 'demo123', role: 'Supervisor', name: 'Venkatesh', hint: 'Harvest, attendance, crop logs' },
    { login: 'delivery1', password: 'demo123', role: 'Delivery', name: 'Raju', hint: 'Sell to vendors' },
    { login: 'vendor1', password: 'demo123', role: 'Vendor', name: 'FreshMart Retail', hint: 'Deliveries, dues, orders' },
    { login: 'labour1', password: 'demo123', role: 'Labour', name: 'Lakshmi', hint: 'Check-in, earnings' },
  ]);
}));

// ---- public, read-only documents opened from WhatsApp (no login; the token is the secret) ----
const B = require('../billService');
const docLimit = limit(240, 600);
const base = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const validToken = (t) => /^[A-Za-z0-9_-]{16,40}$/.test(String(t || ''));

router.get('/bill/:token', docLimit, wrap(async (req, res) => {
  if (!validToken(req.params.token)) return res.status(404).json({ error: 'Bill not found' });
  const b = await one('SELECT * FROM bills WHERE token=?', [req.params.token]);
  if (!b) return res.status(404).json({ error: 'Bill not found' });
  const d = await B.billData(b, base(req));
  delete d.share.whatsapp; delete d.bill.sent_count; delete d.bill.sent_at;
  res.json(d);
}));

router.get('/receipt/:token', docLimit, wrap(async (req, res) => {
  if (!validToken(req.params.token)) return res.status(404).json({ error: 'Receipt not found' });
  const p = await one('SELECT * FROM payments_received WHERE token=?', [req.params.token]);
  if (!p) return res.status(404).json({ error: 'Receipt not found' });
  const d = await B.receiptData(p, base(req)); delete d.share.whatsapp;
  res.json(d);
}));

router.get('/statement/:token', docLimit, wrap(async (req, res) => {
  if (!validToken(req.params.token)) return res.status(404).json({ error: 'Statement not found' });
  const p = await one('SELECT * FROM parties WHERE share_token=?', [req.params.token]);
  if (!p) return res.status(404).json({ error: 'Statement not found' });
  const { isDate } = require('./crud');
  const to = isDate(req.query.to || '') ? req.query.to : new Date().toISOString().slice(0, 10);
  const from = isDate(req.query.from || '') ? req.query.from : new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10);
  const d = await B.statementData(p, base(req), from, to); delete d.share.whatsapp;
  res.json(d);
}));

module.exports = router;
