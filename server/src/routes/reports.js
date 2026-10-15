// Dashboards & reports (all read-only, computed by reportService.js)
const router = require('express').Router();
const { q, one } = require('../db');
const { auth, allow, moduleOn, isOn } = require('../middleware/auth');
const { MANAGERS, FIELD } = require('../config');
const S = require('../reportService');
const { today, addDays, activeLocks } = require('../resources');
const { postDueRecurring, produceStock } = require('./ops');
const { wrap } = require('./crud');

router.use(auth);

const range = (req) => {
  const to = req.query.to || today();
  const from = req.query.from || addDays(to, -29);
  return { from, to, farm: req.query.farm_id || null, group: ['day', 'week', 'month'].includes(req.query.group) ? req.query.group : 'day' };
};

// Home dashboard. Owner/manager get money + decisions; supervisor gets today's field view.
router.get('/dashboard', allow(FIELD), wrap(async (req, res) => {
  const { from, to, farm, group } = range(req);
  const o = req.org; const t = today();
  const todayBox = {
    harvest: await q('SELECT h.crop_id, c.name crop, c.unit, c.color, SUM(h.quantity) qty FROM harvests h JOIN crops c ON c.id=h.crop_id WHERE h.org_id=? AND h.date=? GROUP BY h.crop_id, c.name, c.unit, c.color', [o.id, t]),
    produce: await produceStock(o.id, t, 1),
    tasks: isOn(o, 'tasks') ? await q(`SELECT k.*, f.name farm, w.name worker FROM tasks k LEFT JOIN farms f ON f.id=k.farm_id LEFT JOIN workers w ON w.id=k.worker_id
        WHERE k.org_id=? AND k.date=? ORDER BY k.status DESC, k.id`, [o.id, t]) : [],
    attendance: isOn(o, 'labour') ? await one(`SELECT SUM(status='present') present, SUM(status='half') half, SUM(status='absent') absent,
        (SELECT COUNT(*) FROM workers WHERE org_id=? AND active=1) workers FROM attendance WHERE org_id=? AND date=?`, [o.id, o.id, t]) : null,
    openOrders: isOn(o, 'orders') ? await q(`SELECT r.*, p.name party, c.name crop FROM orders r JOIN parties p ON p.id=r.party_id JOIN crops c ON c.id=r.crop_id
        WHERE r.org_id=? AND r.status='open' ORDER BY r.date LIMIT 20`, [o.id]) : [],
    locks: isOn(o, 'scouting') ? await activeLocks(o.id, t) : [],
  };
  if (!MANAGERS.includes(req.user.role)) {
    const alerts = (await S.alerts(o)).filter((a) => !['sales', 'finance', 'recurring', 'documents', 'assets'].includes(a.module));
    return res.json({ role: 'field', today: todayBox, alerts });
  }
  await postDueRecurring(o);
  const cur = await S.summary(o, from, to, farm, group);
  const len = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  const prev = await S.summary(o, addDays(from, -len), addDays(from, -1), farm, group);
  const setup = {
    farms: (await one('SELECT COUNT(*) n FROM farms WHERE org_id=?', [o.id])).n,
    crops: (await one('SELECT COUNT(*) n FROM crops WHERE org_id=?', [o.id])).n,
    vendors: (await one('SELECT COUNT(*) n FROM parties WHERE org_id=?', [o.id])).n,
    prices: (await one('SELECT COUNT(*) n FROM price_list WHERE org_id=?', [o.id])).n,
    workers: (await one('SELECT COUNT(*) n FROM workers WHERE org_id=?', [o.id])).n,
    users: (await one('SELECT COUNT(*) n FROM users WHERE org_id=?', [o.id])).n,
  };
  res.json({
    role: 'owner', summary: cur, prev: prev.totals, insights: await S.insights(o, cur), finding: S.finding(cur, prev, o.settings.currency),
    alerts: isOn(o, 'alerts') ? await S.alerts(o) : [], today: todayBox, setup,
  });
}));

router.get('/reports/summary', allow(MANAGERS), wrap(async (req, res) => {
  const { from, to, farm, group } = range(req);
  const s = await S.summary(req.org, from, to, farm, group);
  s.finding = S.finding(s, null, req.org.settings.currency);
  res.json(s);
}));

router.get('/reports/pnl', allow(MANAGERS), moduleOn('finance'), wrap(async (req, res) => {
  const { from, to, farm } = range(req);
  res.json(await S.pnl(req.org, from, to, farm));
}));

router.get('/reports/balance', allow(MANAGERS), moduleOn('finance'), wrap(async (req, res) => {
  res.json(await S.balance(req.org, req.query.date || today()));
}));

router.get('/reports/receivables', allow(MANAGERS), wrap(async (req, res) => {
  res.json(await S.receivables(req.org.id, req.query.date || today()));
}));

// Vendor statement with running balance
router.get('/reports/vendor/:id', allow(MANAGERS), wrap(async (req, res) => {
  const { from, to } = range(req);
  const p = await one('SELECT * FROM parties WHERE id=? AND org_id=?', [req.params.id, req.org.id]);
  if (!p) return res.status(404).json({ error: 'Vendor not found' });
  res.json(await vendorStatement(p, from, to));
}));

async function vendorStatement(p, from, to) {
  const before = await one(`SELECT
      COALESCE((SELECT SUM(amount) FROM sales WHERE party_id=? AND date<?),0) s,
      COALESCE((SELECT SUM(amount) FROM payments_received WHERE party_id=? AND date<?),0) r`, [p.id, from, p.id, from]);
  const opening = Number(p.opening_balance) + Number(before.s) - Number(before.r);
  const sales = await q(`SELECT s.id, s.date, 'sale' kind, c.name crop, c.unit, s.grade, s.quantity, s.rejected_qty, s.rate, s.amount, s.status, s.invoice_no, s.vendor_note
      FROM sales s JOIN crops c ON c.id=s.crop_id WHERE s.party_id=? AND s.date BETWEEN ? AND ?`, [p.id, from, to]);
  const pays = await q("SELECT id, date, 'payment' kind, amount, mode, reference FROM payments_received WHERE party_id=? AND date BETWEEN ? AND ?", [p.id, from, to]);
  const lines = [...sales, ...pays].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'sale' ? -1 : 1));
  let bal = opening;
  for (const l of lines) { bal += l.kind === 'sale' ? Number(l.amount) : -Number(l.amount); l.balance = Math.round(bal * 100) / 100; }
  const rec = (await S.receivables(p.org_id)).find((r) => r.party_id === p.id) || {};
  return { party: p, from, to, opening: Math.round(opening * 100) / 100, closing: Math.round(bal * 100) / 100, lines,
    total_sales: sales.reduce((a, b) => a + Number(b.amount), 0), total_paid: pays.reduce((a, b) => a + Number(b.amount), 0), overdue: rec.overdue || 0 };
}

// Everything entered on one day
router.get('/reports/daybook', allow(MANAGERS), wrap(async (req, res) => {
  const d = req.query.date || today(); const o = req.org.id;
  res.json({
    date: d,
    harvests: await q('SELECT h.*, c.name crop, c.unit, f.name farm FROM harvests h JOIN crops c ON c.id=h.crop_id LEFT JOIN farms f ON f.id=h.farm_id WHERE h.org_id=? AND h.date=?', [o, d]),
    sales: await q('SELECT s.*, c.name crop, c.unit, p.name party, u.name delivered_by_name FROM sales s JOIN crops c ON c.id=s.crop_id JOIN parties p ON p.id=s.party_id LEFT JOIN users u ON u.id=s.delivered_by WHERE s.org_id=? AND s.date=?', [o, d]),
    expenses: await q('SELECT e.*, c.name category, p.name party FROM expenses e JOIN expense_categories c ON c.id=e.category_id LEFT JOIN parties p ON p.id=e.party_id WHERE e.org_id=? AND e.date=?', [o, d]),
    payments: await q('SELECT r.*, p.name party FROM payments_received r JOIN parties p ON p.id=r.party_id WHERE r.org_id=? AND r.date=?', [o, d]),
  });
}));

router.get('/alerts', allow(FIELD), wrap(async (req, res) => {
  let a = await S.alerts(req.org);
  if (!MANAGERS.includes(req.user.role)) a = a.filter((x) => !['sales', 'finance', 'recurring', 'documents', 'assets'].includes(x.module));
  res.json(a);
}));

module.exports = router;
module.exports.vendorStatement = vendorStatement;
