// Day-to-day operation helpers that are more than plain CRUD:
//   price lookup for a sale, produce stock, harvest locks, attendance sheet,
//   wage calculator, recurring-payment posting, file upload
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { q, one } = require('../db');
const { auth, allow, moduleOn } = require('../middleware/auth');
const { lookupPrice, activeLocks, today, addDays } = require('../resources');
const { STAFF, FIELD, MANAGERS } = require('../config');
const { wrap } = require('./crud');

router.use(auth);

// ---------- selling ----------
router.get('/price', allow(STAFF), wrap(async (req, res) => {
  const { party_id, crop_id, grade, date } = req.query;
  if (!party_id || !crop_id) return res.json({ price: 0, source: '' });
  res.json(await lookupPrice(req.org.id, party_id, crop_id, grade, date));
}));

// Produce available to sell by crop & grade: harvested - culls - sold (last N days, default 3: produce is perishable)
async function produceStock(orgId, date, days = 3) {
  const from = addDays(date, -(days - 1));
  const h = await q(`SELECT h.crop_id, h.grade, SUM(h.quantity - COALESCE(h.culls,0)) qty, SUM(CASE WHEN h.date=? THEN h.quantity ELSE 0 END) today_qty
    FROM harvests h WHERE h.org_id=? AND h.date BETWEEN ? AND ? GROUP BY h.crop_id, h.grade`, [date, orgId, from, date]);
  const s = await q(`SELECT s.crop_id, s.grade, SUM(s.quantity) qty, SUM(CASE WHEN s.date=? THEN s.quantity ELSE 0 END) today_qty
    FROM sales s WHERE s.org_id=? AND s.date BETWEEN ? AND ? GROUP BY s.crop_id, s.grade`, [date, orgId, from, date]);
  const crops = await q('SELECT id, name, unit, color FROM crops WHERE org_id=?', [orgId]);
  const map = {};
  const key = (r) => `${r.crop_id}|${r.grade}`;
  for (const r of h) map[key(r)] = { crop_id: r.crop_id, grade: r.grade, harvested: r.qty, harvested_today: r.today_qty, sold: 0, sold_today: 0 };
  for (const r of s) {
    map[key(r)] = map[key(r)] || { crop_id: r.crop_id, grade: r.grade, harvested: 0, harvested_today: 0, sold: 0, sold_today: 0 };
    map[key(r)].sold = r.qty; map[key(r)].sold_today = r.today_qty;
  }
  return Object.values(map).map((r) => {
    const c = crops.find((x) => x.id === r.crop_id) || {};
    return { ...r, crop: c.name, unit: c.unit, color: c.color, available: Math.max(0, Math.round((r.harvested - r.sold) * 100) / 100) };
  }).sort((a, b) => (a.crop || '').localeCompare(b.crop || '') || a.grade.localeCompare(b.grade));
}

router.get('/produce-stock', allow(STAFF), wrap(async (req, res) => {
  res.json(await produceStock(req.org.id, req.query.date || today(), Number(req.query.days) || 3));
}));

router.get('/locks', allow(STAFF), wrap(async (req, res) => {
  res.json(await activeLocks(req.org.id, req.query.date || today()));
}));

// ---------- attendance sheet (mark everyone in one screen) ----------
router.get('/attendance-sheet', allow(FIELD), moduleOn('labour'), wrap(async (req, res) => {
  const date = req.query.date || today();
  const where = req.query.farm_id ? 'AND w.farm_id=?' : '';
  const p = [date, req.org.id]; if (req.query.farm_id) p.push(req.query.farm_id);
  res.json(await q(`SELECT w.id worker_id, w.name, w.skill, w.pay_type, a.id attendance_id, a.status, a.check_in, a.check_out, a.task, a.overtime_hours
    FROM workers w LEFT JOIN attendance a ON a.worker_id=w.id AND a.date=?
    WHERE w.org_id=? AND w.active=1 ${where} ORDER BY w.name`, p));
}));

router.post('/attendance-sheet', allow(FIELD), moduleOn('labour'), wrap(async (req, res) => {
  const { date, entries } = req.body || {};
  if (!date || !Array.isArray(entries)) return res.status(400).json({ error: 'date and entries required' });
  for (const e of entries) {
    const w = await one('SELECT id, farm_id FROM workers WHERE id=? AND org_id=?', [e.worker_id, req.org.id]);
    if (!w) continue;
    if (!e.status) { await q('DELETE FROM attendance WHERE worker_id=? AND date=?', [w.id, date]); continue; }
    await q(`INSERT INTO attendance (org_id,worker_id,date,status,check_in,check_out,farm_id,task,overtime_hours) VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE status=VALUES(status), check_in=VALUES(check_in), check_out=VALUES(check_out), task=VALUES(task), overtime_hours=VALUES(overtime_hours)`,
      [req.org.id, w.id, date, e.status, e.check_in || null, e.check_out || null, w.farm_id, e.task || null, Number(e.overtime_hours) || 0]);
  }
  res.json({ ok: true });
}));

// ---------- wage calculator ----------
async function calcWages(orgId, workerId, from, to) {
  const w = await one('SELECT * FROM workers WHERE id=? AND org_id=?', [workerId, orgId]);
  if (!w) throw Object.assign(new Error('Worker not found'), { status: 404 });
  const att = await one(`SELECT SUM(status='present') present, SUM(status='half') half, SUM(status='absent') absent, SUM(status='leave') leaves,
    COALESCE(SUM(overtime_hours),0) ot FROM attendance WHERE worker_id=? AND date BETWEEN ? AND ?`, [workerId, from, to]);
  const days = Number(att.present || 0) + 0.5 * Number(att.half || 0);
  const kg = (await one('SELECT COALESCE(SUM(quantity),0) kg FROM harvests WHERE org_id=? AND worker_id=? AND date BETWEEN ? AND ?', [orgId, workerId, from, to])).kg;
  const periodDays = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  let gross = 0; let basis = '';
  if (w.pay_type === 'monthly') {
    const perDay = w.monthly_salary / 30;
    gross = perDay * periodDays - perDay * (Number(att.absent || 0) + 0.5 * Number(att.half || 0));
    basis = `Salary ${w.monthly_salary}/month x ${periodDays} days, minus ${att.absent || 0} absent & ${att.half || 0} half days`;
  } else if (w.pay_type === 'piece') {
    gross = kg * w.piece_rate + days * (w.daily_wage || 0);
    basis = `${kg} kg x ${w.piece_rate}/kg` + (w.daily_wage ? ` + ${days} days x ${w.daily_wage}` : '');
  } else {
    gross = days * w.daily_wage;
    basis = `${days} days x ${w.daily_wage}/day`;
  }
  const otRate = (w.pay_type === 'monthly' ? w.monthly_salary / 30 : w.daily_wage) / 8;
  const ot = Number(att.ot) * otRate;
  gross += ot;
  // Advances and deduction entries are amounts to recover; wage_payments.deductions = what was already recovered
  const adv = await one(`SELECT
      COALESCE(SUM(CASE WHEN type IN ('advance','deduction') THEN amount END),0) to_recover,
      COALESCE(SUM(CASE WHEN type='bonus' AND date BETWEEN ? AND ? THEN amount END),0) bonus
    FROM advances WHERE worker_id=?`, [from, to, workerId]);
  const recovered = (await one('SELECT COALESCE(SUM(deductions),0) d FROM wage_payments WHERE worker_id=?', [workerId])).d;
  const r2 = (x) => Math.round(x * 100) / 100;
  const advanceDue = r2(Math.max(0, adv.to_recover - recovered));
  const deductions = r2(Math.min(advanceDue, Math.max(0, gross + adv.bonus)));
  const paid = await q('SELECT * FROM wage_payments WHERE worker_id=? AND period_end>=? AND period_start<=? ORDER BY date', [workerId, from, to]);
  return {
    worker: w, from, to, days_present: Number(att.present || 0), half_days: Number(att.half || 0), absent: Number(att.absent || 0), leaves: Number(att.leaves || 0),
    days_worked: days, kg_harvested: kg, overtime_hours: Number(att.ot), overtime_pay: r2(ot), basis,
    gross: r2(gross), bonus: adv.bonus, advance_due: advanceDue, deductions, net: r2(gross + adv.bonus - deductions), already_paid: paid,
    paid: r2(paid.reduce((a, b) => a + Number(b.net_paid), 0)),
  };
}

router.get('/wage-calc', allow(MANAGERS), moduleOn('labour'), wrap(async (req, res) => {
  const { worker_id, from, to } = req.query;
  if (!worker_id || !from || !to) return res.status(400).json({ error: 'worker, from and to are required' });
  res.json(await calcWages(req.org.id, worker_id, from, to));
}));

// Wage summary for all active workers for a period (wage run)
router.get('/wage-run', allow(MANAGERS), moduleOn('labour'), wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  const ws = await q('SELECT id FROM workers WHERE org_id=? AND active=1 ORDER BY name', [req.org.id]);
  const out = [];
  for (const w of ws) { const c = await calcWages(req.org.id, w.id, from, to); delete c.worker.org_id; out.push(c); }
  res.json(out);
}));

// ---------- recurring payments ----------
function nextDate(d, freq) {
  const x = new Date(d + 'T00:00:00Z');
  if (freq === 'weekly') x.setUTCDate(x.getUTCDate() + 7);
  else if (freq === 'quarterly') x.setUTCMonth(x.getUTCMonth() + 3);
  else if (freq === 'yearly') x.setUTCFullYear(x.getUTCFullYear() + 1);
  else x.setUTCMonth(x.getUTCMonth() + 1);
  return x.toISOString().slice(0, 10);
}

async function postDueRecurring(org, onlyId) {
  if (org.settings.modules.recurring === false || org.settings.modules.expenses === false) return 0;
  const p = [org.id, today()]; let extra = 'AND auto_post=1';
  if (onlyId) { extra = 'AND id=?'; p.push(onlyId); }
  const due = await q(`SELECT * FROM recurring_expenses WHERE org_id=? AND active=1 AND next_due<=? ${extra}`, p);
  let n = 0;
  for (const r of due) {
    let d = r.next_due; let guard = 0;
    while (d <= today() && guard++ < 60) {
      await q(`INSERT INTO expenses (org_id,date,category_id,description,farm_id,party_id,amount,payment_mode,recurring_id) VALUES (?,?,?,?,?,?,?,?,?)`,
        [org.id, d, r.category_id, r.name, r.farm_id, r.party_id, r.amount, 'bank', r.id]);
      n++; d = nextDate(d, r.frequency);
      if (onlyId) break;
    }
    await q('UPDATE recurring_expenses SET next_due=? WHERE id=?', [d, r.id]);
  }
  return n;
}

router.post('/recurring/post', allow(MANAGERS), moduleOn('recurring'), wrap(async (req, res) => {
  const n = await postDueRecurring(req.org, req.body && req.body.id);
  res.json({ posted: n });
}));

// ---------- file upload (bill photos, documents) ----------
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${req.org.id}_${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/|application\/pdf)/.test(file.mimetype)),
});

router.post('/upload', allow(STAFF), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Only images or PDF up to 10 MB' });
  res.json({ path: req.file.filename, name: req.file.originalname });
}));

// Files are served only to users of the same org
router.get('/file/:name', wrap(async (req, res) => {
  const name = path.basename(req.params.name);
  if (!req.org || !name.startsWith(`${req.org.id}_`)) return res.status(403).end();
  res.sendFile(path.join(UPLOAD_DIR, name));
}));

module.exports = router;
module.exports.postDueRecurring = postDueRecurring;
module.exports.produceStock = produceStock;
module.exports.calcWages = calcWages;
