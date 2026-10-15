// JWT authentication + role / module guards.
const jwt = require('jsonwebtoken');
const { one } = require('../db');
const { DEFAULT_SETTINGS } = require('../config');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

function sign(user) {
  return jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });
}

// Loads req.user and req.org (with merged settings) from the Bearer token.
async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
    if (!token) return res.status(401).json({ error: 'Login required' });
    const { id } = jwt.verify(token, SECRET);
    const user = await one('SELECT id, org_id, name, login, role, worker_id, party_id, active FROM users WHERE id=?', [id]);
    if (!user || !user.active) return res.status(401).json({ error: 'Account disabled' });
    req.user = user;
    if (user.org_id) {
      const org = await one('SELECT * FROM organizations WHERE id=?', [user.org_id]);
      if (!org || org.status !== 'active') return res.status(403).json({ error: 'Organisation is suspended. Contact platform admin.' });
      org.settings = mergeSettings(org.settings);
      req.org = org;
    }
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session expired, please login again' });
  }
}

function mergeSettings(raw) {
  const s = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
  return {
    ...DEFAULT_SETTINGS, ...s,
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(s.thresholds || {}) },
    modules: s.modules || {},
  };
}

// allow('admin','manager') -> 403 for any other role
const allow = (...roles) => (req, res, next) =>
  roles.flat().includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed for your role' });

const isOn = (org, key) => !key || !org || org.settings.modules[key] !== false;

// Blocks the route if the admin switched the module off
const moduleOn = (key) => (req, res, next) =>
  isOn(req.org, key) ? next() : res.status(403).json({ error: `Module "${key}" is turned off by admin` });

module.exports = { sign, auth, allow, moduleOn, isOn, mergeSettings };
