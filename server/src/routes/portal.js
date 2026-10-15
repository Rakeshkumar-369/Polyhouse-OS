// Self-service logins:
//   Vendor portal  - deliveries, accept / report rejection, dues statement, price list, place orders
//   Labour portal  - attendance, self check-in/out, this week's earnings, advances, payslips, tasks
const router = require('express').Router();
const { q, one } = require('../db');
const { auth, allow, moduleOn } = require('../middleware/auth');
const { today, addDays, activeLocks } = require('../resources');
const { calcWages } = require('./ops');
const { vendorStatement } = require('./reports');
const { wrap } = require('./crud');

router.use(auth);

// ---------- vendor ----------
const vendor = [allow('vendor'), moduleOn('vendor_portal')];

router.get('/vendor', vendor, wrap(async (req, res) => {
  const p = await one('SELECT * FROM parties WHERE id=? AND org_id=?', [req.user.party_id, req.org.id]);
  if (!p) return res.status(404).json({ error: 'Vendor profile not linked' });
  const to = req.query.to || today(); const from = req.query.from || addDays(to, -29);
  const st = await vendorStatement(p, from, to);
  const prices = await q(`SELECT c.name crop, c.unit, pl.grade, pl.price, pl.effective_from FROM price_list pl JOIN crops c ON c.id=pl.crop_id
      WHERE pl.party_id=? AND pl.effective_from<=? AND pl.effective_from = (SELECT MAX(effective_from) FROM price_list x WHERE x.party_id=pl.party_id AND x.crop_id=pl.crop_id AND x.grade=pl.grade AND x.effective_from<=?)
      ORDER BY c.name, pl.grade`, [p.id, today(), today()]);
  const orders = await q('SELECT o.*, c.name crop, c.unit FROM orders o JOIN crops c ON c.id=o.crop_id WHERE o.party_id=? ORDER BY o.date DESC LIMIT 30', [p.id]);
  delete st.party.notes;
  res.json({ ...st, org: { name: req.org.name, phone: req.org.phone }, prices, orders, ordersOn: req.org.settings.modules.orders !== false });
}));

// Vendor confirms a delivery or reports rejected quantity
router.put('/vendor/sales/:id', vendor, wrap(async (req, res) => {
  const s = await one('SELECT * FROM sales WHERE id=? AND party_id=? AND org_id=?', [req.params.id, req.user.party_id, req.org.id]);
  if (!s) return res.status(404).json({ error: 'Delivery not found' });
  if (s.status !== 'delivered') return res.status(400).json({ error: 'Already confirmed' });
  if (s.date < addDays(today(), -7)) return res.status(400).json({ error: 'Deliveries older than 7 days cannot be changed. Contact the farm.' });
  const b = req.body || {};
  const rej = Math.max(0, Math.min(Number(b.rejected_qty) || 0, s.quantity));
  const status = rej > 0 || b.status === 'disputed' ? 'disputed' : 'accepted';
  await q('UPDATE sales SET status=?, rejected_qty=?, amount=?, vendor_note=? WHERE id=?',
    [status, rej, Math.round((s.quantity - rej) * s.rate * 100) / 100, String(b.vendor_note || '').slice(0, 300) || null, s.id]);
  res.json({ ok: true });
}));

router.post('/vendor/orders', vendor, moduleOn('orders'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.crop_id || !(Number(b.quantity) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Crop, quantity and date are required' });
  if (!(await one('SELECT id FROM crops WHERE id=? AND org_id=?', [b.crop_id, req.org.id]))) return res.status(400).json({ error: 'Crop not found' });
  await q('INSERT INTO orders (org_id,date,party_id,crop_id,grade,quantity,notes,created_by) VALUES (?,?,?,?,?,?,?,?)',
    [req.org.id, b.date, req.user.party_id, b.crop_id, b.grade || 'A', Number(b.quantity), String(b.notes || '').slice(0, 300) || null, req.user.id]);
  res.json({ ok: true });
}));

router.delete('/vendor/orders/:id', vendor, wrap(async (req, res) => {
  await q("UPDATE orders SET status='cancelled' WHERE id=? AND party_id=? AND org_id=? AND status='open'", [req.params.id, req.user.party_id, req.org.id]);
  res.json({ ok: true });
}));

// ---------- labour ----------
const labour = [allow('labour'), moduleOn('labour_portal'), moduleOn('labour')];

function weekStart(d) { const x = new Date(d + 'T00:00:00Z'); const wd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - wd); return x.toISOString().slice(0, 10); }

router.get('/labour', labour, wrap(async (req, res) => {
  const w = await one('SELECT * FROM workers WHERE id=? AND org_id=?', [req.user.worker_id, req.org.id]);
  if (!w) return res.status(404).json({ error: 'Worker profile not linked' });
  const t = today();
  const week = await calcWages(req.org.id, w.id, weekStart(t), t);
  const month = await calcWages(req.org.id, w.id, t.slice(0, 8) + '01', t);
  const attendance = await q('SELECT date, status, check_in, check_out, task FROM attendance WHERE worker_id=? ORDER BY date DESC LIMIT 31', [w.id]);
  const advances = await q('SELECT date, type, amount, notes FROM advances WHERE worker_id=? ORDER BY date DESC LIMIT 20', [w.id]);
  const payslips = await q('SELECT * FROM wage_payments WHERE worker_id=? ORDER BY date DESC LIMIT 12', [w.id]);
  const tasks = req.org.settings.modules.tasks !== false ? await q('SELECT k.*, f.name farm, b.name bay FROM tasks k LEFT JOIN farms f ON f.id=k.farm_id LEFT JOIN bays b ON b.id=k.bay_id WHERE k.worker_id=? AND k.date=?', [w.id, t]) : [];
  const locks = req.org.settings.modules.scouting !== false ? await activeLocks(req.org.id, t) : [];
  const todayAtt = attendance.find((a) => a.date === t) || null;
  const strip = (c) => ({ days_worked: c.days_worked, kg_harvested: c.kg_harvested, gross: c.gross, bonus: c.bonus, advance_due: c.advance_due, deductions: c.deductions, net: c.net, basis: c.basis, paid: c.paid });
  res.json({ worker: { name: w.name, skill: w.skill, pay_type: w.pay_type }, today: todayAtt, week: strip(week), month: strip(month), attendance, advances, payslips, tasks, locks });
}));

router.post('/labour/checkin', labour, wrap(async (req, res) => {
  const t = today(); const now = new Date().toTimeString().slice(0, 8);
  const w = await one('SELECT id, farm_id FROM workers WHERE id=? AND org_id=?', [req.user.worker_id, req.org.id]);
  if (!w) return res.status(404).json({ error: 'Worker profile not linked' });
  const a = await one('SELECT * FROM attendance WHERE worker_id=? AND date=?', [w.id, t]);
  if (!a) await q("INSERT INTO attendance (org_id,worker_id,date,status,check_in,farm_id) VALUES (?,?,?,'present',?,?)", [req.org.id, w.id, t, now, w.farm_id]);
  else if (!a.check_in) await q("UPDATE attendance SET check_in=?, status=IF(status IN ('absent','leave'),'present',status) WHERE id=?", [now, a.id]);
  else if (!a.check_out) await q('UPDATE attendance SET check_out=? WHERE id=?', [now, a.id]);
  else return res.status(400).json({ error: 'Already checked out today' });
  res.json({ ok: true });
}));

router.put('/labour/tasks/:id', labour, moduleOn('tasks'), wrap(async (req, res) => {
  await q("UPDATE tasks SET status='done' WHERE id=? AND worker_id=? AND org_id=?", [req.params.id, req.user.worker_id, req.org.id]);
  res.json({ ok: true });
}));

module.exports = router;
