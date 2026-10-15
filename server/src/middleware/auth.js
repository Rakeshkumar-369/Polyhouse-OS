// JWT authentication + role / module guards.
const jwt = require('jsonwebtoken');
const { one } = require('../db');
const { DEFAULT_SETTINGS } = require('../config');

const SECRET = require('../env').JWT_SECRET;

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
    const user = await one('SELECT id, org_id, name, login, role, worker_id, party_id, lang, active FROM users WHERE id=?', [id]);
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

// Simple in-memory rate limiter per IP: limit(10, 300) -> max 10 requests per 5 minutes.
// failuresOnly: count only requests that failed (wrong password), so a busy farm office on one IP is never blocked.
function limit(max, seconds, { failuresOnly = false } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now(); const key = req.ip;
    const arr = (hits.get(key) || []).filter((t) => now - t < seconds * 1000);
    hits.set(key, arr);
    if (arr.length >= max) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    if (failuresOnly) res.on('finish', () => { if (res.statusCode >= 400) arr.push(Date.now()); });
    else arr.push(now);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

module.exports = { limit, sign, auth, allow, moduleOn, isOn, mergeSettings };
