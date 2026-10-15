// Login / current user / change password
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../db');
const { sign, auth } = require('../middleware/auth');
const { wrap } = require('./crud');

router.post('/login', wrap(async (req, res) => {
  const { login, password } = req.body || {};
  const u = await one('SELECT * FROM users WHERE login=?', [String(login || '').trim()]);
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) return res.status(401).json({ error: 'Wrong login or password' });
  if (!u.active) return res.status(403).json({ error: 'Your account is disabled' });
  if (u.org_id) {
    const org = await one('SELECT status FROM organizations WHERE id=?', [u.org_id]);
    if (!org || org.status !== 'active') return res.status(403).json({ error: 'Your organisation is suspended' });
  }
  await q('UPDATE users SET last_login=NOW() WHERE id=?', [u.id]);
  res.json({ token: sign(u), user: { id: u.id, name: u.name, role: u.role, org_id: u.org_id } });
}));

router.post('/change-password', auth, wrap(async (req, res) => {
  const { current, next } = req.body || {};
  const u = await one('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(String(current || ''), u.password_hash))) return res.status(400).json({ error: 'Current password is wrong' });
  if (!next || String(next).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(next, 10), req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;
