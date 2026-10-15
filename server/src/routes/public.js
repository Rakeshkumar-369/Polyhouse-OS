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

module.exports = router;
