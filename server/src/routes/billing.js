// Bills & receipts API (logged-in staff). Public read-only links are in routes/public.js.
//   GET  /api/bills                 list (?from&to&party_id&status&q)
//   GET  /api/bills/unbilled        vendors with sales not yet on a bill
//   POST /api/bills                 new bill from items  {party_id, date, farm_id, notes, lines:[{crop_id, grade, quantity, rate?}]}
//   POST /api/bills/from-sales      bill unbilled sales  {party_id?, from, to}  (one bill per vendor)
//   GET  /api/bills/:id             bill + WhatsApp share text/link
//   POST /api/bills/:id/sent        remember that it was sent
//   POST /api/bills/:id/cancel      cancel (its sales stay, unbilled)
//   GET  /api/receipts/:paymentId   payment receipt + share
//   GET  /api/statement-link/:partyId   vendor statement link + share
//   GET  /api/share/today           today's summary for the owner to forward on WhatsApp
const router = require('express').Router();
const { q, one } = require('../db');
const { auth, allow, moduleOn } = require('../middleware/auth');
const { STAFF, MANAGERS } = require('../config');
const { wrap, isDate } = require('./crud');
const B = require('../billService');

router.use(auth);
const baseUrl = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const billing = [allow(STAFF), moduleOn('sales'), moduleOn('billing')];
const today = () => new Date().toISOString().slice(0, 10);
const checkDate = (k, v) => { if (v && !isDate(v)) throw Object.assign(new Error(`${k}: invalid date`), { status: 400 }); };

router.get('/bills', billing, wrap(async (req, res) => {
  const { from, to, party_id: partyId, status, q: text } = req.query;
  checkDate('from', from); checkDate('to', to);
  const where = ['b.org_id=?']; const p = [req.org.id];
  if (from) { where.push('b.date>=?'); p.push(from); }
  if (to) { where.push('b.date<=?'); p.push(to); }
  if (partyId) { where.push('b.party_id=?'); p.push(partyId); }
  if (status) { where.push('b.status=?'); p.push(status); }
  if (text) { where.push('(b.bill_no LIKE ? OR pa.name LIKE ?)'); p.push(`%${text}%`, `%${text}%`); }
  res.json(await q(`SELECT b.id, b.bill_no, b.date, b.status, b.sent_count, b.sent_at, b.party_id, pa.name party, pa.phone,
      COUNT(s.id) line_count, COALESCE(SUM(s.quantity),0) quantity, COALESCE(SUM(s.amount),0) amount
    FROM bills b JOIN parties pa ON pa.id=b.party_id LEFT JOIN sales s ON s.bill_id=b.id
    WHERE ${where.join(' AND ')} GROUP BY b.id ORDER BY b.date DESC, b.id DESC LIMIT ${Math.min(Number(req.query.limit) || 300, 2000)}`, p));
}));

router.get('/bills/unbilled', billing, wrap(async (req, res) => {
  res.json(await q(`SELECT s.party_id, pa.name party, pa.phone, COUNT(*) line_count, ROUND(SUM(s.amount),2) amount, MIN(s.date) first_date, MAX(s.date) last_date
    FROM sales s JOIN parties pa ON pa.id=s.party_id WHERE s.org_id=? AND s.bill_id IS NULL GROUP BY s.party_id, pa.name, pa.phone ORDER BY amount DESC`, [req.org.id]));
}));

router.post('/bills', billing, wrap(async (req, res) => {
  const b = req.body || {};
  checkDate('date', b.date);
  const bill = await B.createBill(req.org, req.user, b);
  res.json(await B.billData(bill, baseUrl(req)));
}));

router.post('/bills/from-sales', billing, allow(MANAGERS), wrap(async (req, res) => {
  const b = req.body || {};
  if (!isDate(b.from || '') || !isDate(b.to || '')) return res.status(400).json({ error: 'Pick the period (from and to dates)' });
  const bills = await B.billUnbilled(req.org, req.user, b);
  res.json({ created: bills.length, bills: await Promise.all(bills.map((x) => B.billData(x, baseUrl(req)))) });
}));

router.get('/bills/:id', billing, wrap(async (req, res) => {
  res.json(await B.billData(await B.getBill(req.org.id, req.params.id), baseUrl(req)));
}));

router.post('/bills/:id/sent', billing, wrap(async (req, res) => {
  await B.getBill(req.org.id, req.params.id);
  await q('UPDATE bills SET sent_count=sent_count+1, sent_at=NOW() WHERE org_id=? AND id=?', [req.org.id, req.params.id]);
  res.json({ ok: true });
}));

router.post('/bills/:id/cancel', billing, allow(MANAGERS), wrap(async (req, res) => {
  await B.getBill(req.org.id, req.params.id);
  await q("UPDATE bills SET status='cancelled' WHERE org_id=? AND id=?", [req.org.id, req.params.id]);
  await q('UPDATE sales SET bill_id=NULL WHERE org_id=? AND bill_id=?', [req.org.id, req.params.id]);
  res.json({ ok: true });
}));

router.get('/receipts/:paymentId', allow(MANAGERS), moduleOn('sales'), wrap(async (req, res) => {
  res.json(await B.receiptData(await B.ensureReceipt(req.org, req.params.paymentId), baseUrl(req)));
}));

router.get('/statement-link/:partyId', allow(MANAGERS), moduleOn('sales'), wrap(async (req, res) => {
  const p = await B.ensurePartyToken(req.org.id, req.params.partyId);
  const to = req.query.to && isDate(req.query.to) ? req.query.to : today();
  const from = req.query.from && isDate(req.query.from) ? req.query.from : new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10);
  res.json(await B.statementData(p, baseUrl(req), from, to));
}));

// A short day summary the owner can forward to a partner / family group
router.get('/share/today', allow(MANAGERS), wrap(async (req, res) => {
  const d = req.query.date && isDate(req.query.date) ? req.query.date : today(); const o = req.org.id;
  const harvest = await q('SELECT c.name, c.unit, SUM(h.quantity) qty FROM harvests h JOIN crops c ON c.id=h.crop_id WHERE h.org_id=? AND h.date=? GROUP BY c.id, c.name, c.unit ORDER BY qty DESC', [o, d]);
  const sales = await one('SELECT COUNT(DISTINCT party_id) vendors, COUNT(*) n, COALESCE(SUM(amount),0) amt FROM sales WHERE org_id=? AND date=?', [o, d]);
  const paid = await one('SELECT COALESCE(SUM(amount),0) amt FROM payments_received WHERE org_id=? AND date=?', [o, d]);
  const exp = await one('SELECT COALESCE(SUM(amount),0) amt FROM expenses WHERE org_id=? AND date=?', [o, d]);
  const att = await one("SELECT SUM(status='present') p, SUM(status='half') h FROM attendance WHERE org_id=? AND date=?", [o, d]);
  const { receivables } = require('../reportService');
  const due = (await receivables(o)).reduce((a, r) => ({ bal: a.bal + Math.max(0, r.balance), over: a.over + r.overdue }), { bal: 0, over: 0 });
  const text = [
    `*${req.org.name} — ${B.fdate(d)}*`,
    `🧺 Harvest: ${harvest.length ? harvest.map((h) => `${h.name} ${Number(h.qty).toLocaleString('en-IN')} ${h.unit}`).join(', ') : 'none recorded'}`,
    `🚚 Sales: ${B.rupees(sales.amt)} (${sales.n} lines to ${sales.vendors} vendors)`,
    `💰 Collected: ${B.rupees(paid.amt)} · Spent: ${B.rupees(exp.amt)}`,
    ...(att && (att.p || att.h) ? [`👷 Present: ${Number(att.p || 0)}${att.h ? ` + ${att.h} half day` : ''}`] : []),
    `📒 Due from vendors: ${B.rupees(due.bal)}${due.over > 0 ? ` (overdue ${B.rupees(due.over)})` : ''}`,
  ].join('\n');
  res.json({ text, whatsapp: B.waLink('', text) });
}));

module.exports = router;
