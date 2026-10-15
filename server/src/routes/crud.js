// Generic CRUD for every resource in resources.js:
//   GET    /api/meta                 -> modules + resource field definitions for the UI
//   GET    /api/r/:res               -> list  (?from=&to=&<filter>=&q=&limit=)
//   GET    /api/r/:res/options       -> [{id,label}] for dropdowns (?farm_id= for dependsOn)
//   GET    /api/r/:res/:id           -> one row
//   POST   /api/r/:res               -> create
//   PUT    /api/r/:res/:id           -> update
//   DELETE /api/r/:res/:id           -> delete
const router = require('express').Router();
const { q, one } = require('../db');
const { R, today } = require('../resources');
const { auth, isOn } = require('../middleware/auth');
const { MODULES, CUSTOMER_TYPES } = require('../config');

router.use(auth);

const sub = (expr, alias) => expr.replace(/\{a\}/g, alias);

function canRead(r, req) { return r.read.includes(req.user.role) && isOn(req.org, r.module); }
function canWrite(r, req) { return r.write.includes(req.user.role) && isOn(req.org, r.module); }

// Fields visible for this org (fields tied to a switched-off module are hidden)
const visibleFields = (r, org) => r.fields.filter((f) => isOn(org, f.module) && (!f.ref || isOn(org, R[f.ref].module)));

function buildSelect(r, org) {
  const joins = []; const cols = ['t.*'];
  for (const f of r.fields) {
    if (f.type !== 'ref') continue;
    const ref = R[f.ref]; const alias = `j_${f.name}`;
    joins.push(`LEFT JOIN ${ref.table} ${alias} ON ${alias}.id = t.${f.name}`);
    cols.push(`${sub(ref.label, alias)} AS ${f.name}_label`);
  }
  if (r.select) cols.push(sub(r.select, 't'));
  return `SELECT ${cols.join(', ')} FROM ${r.table} t ${joins.join(' ')}`;
}

function getRes(req, res, mode) {
  const r = R[req.params.res];
  if (!r || !req.org) { res.status(404).json({ error: 'Unknown resource' }); return null; }
  if (mode === 'read' ? !canRead(r, req) : !canWrite(r, req)) { res.status(403).json({ error: 'Not allowed' }); return null; }
  return r;
}

// Cleans the request body into column values (type coercion + whitelist)
async function clean(r, body, org, isCreate) {
  const d = {};
  for (const f of r.fields) {
    if (f.virtual || f.readonly) continue;
    if (!(f.name in body)) {
      if (isCreate && f.default !== undefined) d[f.name] = f.default === 'today' ? today() : f.default;
      continue;
    }
    let v = body[f.name];
    if (v === '' || v === undefined) v = null;
    if (v !== null) {
      if (f.type === 'number' || f.type === 'ref') { v = Number(v); if (Number.isNaN(v)) throw Object.assign(new Error(`${f.label} must be a number`), { status: 400 }); }
      if (f.type === 'bool') v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
      if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw Object.assign(new Error(`${f.label}: invalid date`), { status: 400 });
    }
    if (f.type === 'ref' && v !== null) {
      const ok = await one(`SELECT id FROM ${R[f.ref].table} WHERE id=? AND org_id=?`, [v, org.id]);
      if (!ok) throw Object.assign(new Error(`${f.label}: not found`), { status: 400 });
    }
    d[f.name] = v;
  }
  if (isCreate) for (const f of r.fields) {
    if (f.required && (d[f.name] === null || d[f.name] === undefined)) throw Object.assign(new Error(`${f.label} is required`), { status: 400 });
  }
  return d;
}

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  if (!e.status) console.error(e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error: ' + e.message });
});

router.get('/meta', wrap(async (req, res) => {
  const resources = {};
  for (const [k, r] of Object.entries(R)) {
    if (!req.org || !canRead(r, req)) continue;
    resources[k] = { key: k, title: r.title, module: r.module, dateField: r.dateField || null, filters: r.filters,
      canWrite: canWrite(r, req), fields: visibleFields(r, req.org) };
  }
  res.json({ user: req.user, org: req.org || null, modules: MODULES, customerTypes: CUSTOMER_TYPES, resources });
}));

router.get('/r/:res', wrap(async (req, res) => {
  const r = getRes(req, res, 'read'); if (!r) return;
  const where = ['t.org_id=?']; const p = [req.org.id];
  if (r.dateField && req.query.from) { where.push(`t.${r.dateField}>=?`); p.push(req.query.from); }
  if (r.dateField && req.query.to) { where.push(`t.${r.dateField}<=?`); p.push(req.query.to); }
  for (const f of r.filters) if (req.query[f] !== undefined && req.query[f] !== '') { where.push(`t.${f}=?`); p.push(req.query[f]); }
  if (req.query.q) { where.push(`${sub(r.label, 't')} LIKE ?`); p.push(`%${req.query.q}%`); }
  const limit = Math.min(Number(req.query.limit) || 500, 5000);
  const rows = await q(`${buildSelect(r, req.org)} WHERE ${where.join(' AND ')} ORDER BY ${r.order.split(',').map((o) => 't.' + o.trim()).join(', ')} LIMIT ${limit}`, p);
  res.json(rows);
}));

router.get('/r/:res/options', wrap(async (req, res) => {
  const r = R[req.params.res];
  // dropdown options are readable by any staff in the org (needed to fill forms)
  if (!r || !req.org || req.user.role === 'labour') return res.status(404).json({ error: 'Unknown resource' });
  if (req.user.role === 'vendor' && req.params.res !== 'crops') return res.status(403).json({ error: 'Not allowed' });
  const where = ['t.org_id=?']; const p = [req.org.id];
  if (r.fields.some((f) => f.name === 'active')) where.push('t.active=1');
  for (const f of r.filters) if (req.query[f]) { where.push(`t.${f}=?`); p.push(req.query[f]); }
  if (req.params.res === 'parties' && req.query.kind) { where.push("t.type IN (?, 'both')"); p.push(req.query.kind); }
  if (req.params.res === 'orders') where.push("t.status='open'");
  const rows = await q(`SELECT t.id, ${sub(r.label, 't')} AS label FROM ${r.table} t WHERE ${where.join(' AND ')} ORDER BY ${sub(r.label, 't')} LIMIT 2000`, p);
  res.json(rows);
}));

router.get('/r/:res/:id', wrap(async (req, res) => {
  const r = getRes(req, res, 'read'); if (!r) return;
  const row = await one(`${buildSelect(r, req.org)} WHERE t.org_id=? AND t.id=?`, [req.org.id, req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
}));

router.post('/r/:res', wrap(async (req, res) => {
  const r = getRes(req, res, 'write'); if (!r) return;
  const d = await clean(r, req.body, req.org, true);
  const ctx = { op: 'create', user: req.user, org: req.org, body: req.body };
  if (r.hooks.before) await r.hooks.before(d, ctx);
  d.org_id = req.org.id;
  const result = await q(`INSERT INTO ${r.table} SET ?`, [d]);
  if (r.hooks.after) await r.hooks.after(result.insertId, d, ctx, 'create');
  res.json(await one(`${buildSelect(r, req.org)} WHERE t.id=?`, [result.insertId]));
}));

router.put('/r/:res/:id', wrap(async (req, res) => {
  const r = getRes(req, res, 'write'); if (!r) return;
  const existing = await one(`SELECT * FROM ${r.table} WHERE org_id=? AND id=?`, [req.org.id, req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const d = await clean(r, req.body, req.org, false);
  const ctx = { op: 'update', user: req.user, org: req.org, body: req.body, existing };
  if (r.hooks.before) await r.hooks.before(d, ctx);
  if (Object.keys(d).length) await q(`UPDATE ${r.table} SET ? WHERE org_id=? AND id=?`, [d, req.org.id, req.params.id]);
  if (r.hooks.after) await r.hooks.after(Number(req.params.id), d, ctx, 'update');
  res.json(await one(`${buildSelect(r, req.org)} WHERE t.id=?`, [req.params.id]));
}));

router.delete('/r/:res/:id', wrap(async (req, res) => {
  const r = getRes(req, res, 'write'); if (!r) return;
  const existing = await one(`SELECT * FROM ${r.table} WHERE org_id=? AND id=?`, [req.org.id, req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await q(`DELETE FROM ${r.table} WHERE org_id=? AND id=?`, [req.org.id, req.params.id]);
  if (r.hooks.after) await r.hooks.after(Number(req.params.id), existing, { op: 'delete', user: req.user, org: req.org, existing }, 'delete');
  res.json({ ok: true });
}));

module.exports = router;
module.exports.wrap = wrap;
