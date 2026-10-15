// =====================================================================
// Analytics engine - every dashboard and report number is computed here.
//   summary()  - crops, quantity, sold, revenue, cost/kg, vendors, categories, farms, trend
//   pnl()      - profit & loss for any date range (incl. depreciation)
//   balance()  - balance sheet as on a date
//   receivables() / payables()
//   alerts()   - exceptions that need action
//   finding()  - the one-sentence headline on the dashboard
// =====================================================================
const { q, one } = require('./db');
const { activeLocks, today, addDays } = require('./resources');

const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
const on = (org, k) => org.settings.modules[k] !== false;

function bucketExpr(col, group) {
  if (group === 'month') return `DATE_FORMAT(${col}, '%Y-%m')`;
  if (group === 'week') return `DATE_FORMAT(DATE_SUB(${col}, INTERVAL WEEKDAY(${col}) DAY), '%Y-%m-%d')`; // week starting Monday
  return `DATE_FORMAT(${col}, '%Y-%m-%d')`;
}

// Receivable per vendor as on a date: opening + sales - payments. Overdue = balance not covered by sales within credit days.
async function receivables(orgId, asOn = today()) {
  const rows = await q(`SELECT p.id party_id, p.name, p.phone, p.credit_days, p.opening_balance,
      COALESCE((SELECT SUM(amount) FROM sales s WHERE s.party_id=p.id AND s.date<=?),0) sales,
      COALESCE((SELECT SUM(amount) FROM payments_received r WHERE r.party_id=p.id AND r.date<=?),0) paid,
      COALESCE((SELECT SUM(amount) FROM sales s WHERE s.party_id=p.id AND s.date<=? AND s.date > DATE_SUB(?, INTERVAL p.credit_days DAY)),0) not_due,
      (SELECT MAX(date) FROM payments_received r WHERE r.party_id=p.id AND r.date<=?) last_payment,
      (SELECT MAX(date) FROM sales s WHERE s.party_id=p.id AND s.date<=?) last_sale
    FROM parties p WHERE p.org_id=? AND p.type IN ('buyer','both')`, [asOn, asOn, asOn, asOn, asOn, asOn, orgId]);
  return rows.map((r) => {
    const balance = r2(r.opening_balance + r.sales - r.paid);
    return { ...r, balance, overdue: r2(Math.max(0, balance - r.not_due)) };
  });
}

// Unpaid supplier bills (expenses with paid_amount set lower than amount, or paid by 'credit')
async function payables(orgId, asOn = today()) {
  return q(`SELECT e.party_id, COALESCE(p.name, 'Unknown supplier') name,
      ROUND(SUM(e.amount - CASE WHEN e.paid_amount IS NULL THEN (CASE WHEN e.payment_mode='credit' THEN 0 ELSE e.amount END) ELSE e.paid_amount END),2) due
    FROM expenses e LEFT JOIN parties p ON p.id=e.party_id
    WHERE e.org_id=? AND e.date<=? GROUP BY e.party_id, p.name HAVING due > 0 ORDER BY due DESC`, [orgId, asOn]);
}

// Straight-line depreciation of assets for the days of [from,to] they were in use
async function depreciation(orgId, from, to, farmId) {
  const assets = await q(`SELECT * FROM assets WHERE org_id=? ${farmId ? 'AND (farm_id=? OR farm_id IS NULL)' : ''}`, farmId ? [orgId, farmId] : [orgId]);
  let total = 0;
  for (const a of assets) {
    const lifeDays = 365 * (Number(a.life_years) || 1);
    const end = addDays(a.purchase_date, Math.round(lifeDays));
    const s = a.purchase_date > from ? a.purchase_date : from;
    const e = end < to ? end : to;
    if (s > e) continue;
    total += ((a.cost - (a.salvage_value || 0)) / lifeDays) * days(s, e);
  }
  return r2(total);
}

async function summary(org, from, to, farmId, group = 'day') {
  const o = org.id;
  const fSales = farmId ? 'AND s.farm_id=?' : ''; const fH = farmId ? 'AND h.farm_id=?' : ''; const fE = farmId ? 'AND e.farm_id=?' : '';
  const P = (extra = []) => (farmId ? [o, from, to, ...extra, farmId] : [o, from, to, ...extra]);

  const crops = await q('SELECT id, name, variety, unit, color FROM crops WHERE org_id=?', [o]);
  const cropName = (id) => (crops.find((c) => c.id === id) || {}).name || '—';

  // --- produce ---
  const harvest = await q(`SELECT crop_id, SUM(quantity) qty, SUM(COALESCE(culls,0)) culls,
      SUM(CASE WHEN grade='A' THEN quantity ELSE 0 END) a_qty FROM harvests h WHERE org_id=? AND date BETWEEN ? AND ? ${fH} GROUP BY crop_id`, P());
  const sales = await q(`SELECT crop_id, SUM(quantity) qty, SUM(COALESCE(rejected_qty,0)) rej, SUM(amount) amount FROM sales s
      WHERE org_id=? AND date BETWEEN ? AND ? ${fSales} GROUP BY crop_id`, P());

  // --- costs ---
  const expTotal = await one(`SELECT COALESCE(SUM(amount),0) t FROM expenses e WHERE org_id=? AND date BETWEEN ? AND ? ${fE}`, P());
  const direct = await q(`SELECT c.crop_id, SUM(e.amount) amt FROM expenses e JOIN crop_cycles c ON c.id=e.crop_cycle_id
      WHERE e.org_id=? AND e.date BETWEEN ? AND ? ${fE} GROUP BY c.crop_id`, P());
  const directSum = direct.reduce((s, r) => s + Number(r.amt), 0);
  const dep = on(org, 'assets') ? await depreciation(o, from, to, farmId) : 0;
  const shared = Number(expTotal.t) - directSum + dep;

  // Shared costs split by area x days of crop cycles running in the period (fallback: revenue share, then harvest share)
  const cycles = await q(`SELECT crop_id, COALESCE(NULLIF(area_sqm,0),1) area, COALESCE(transplant_date, nursery_date, ?) s, COALESCE(harvest_end, ?) e
      FROM crop_cycles WHERE org_id=? AND status<>'planned' ${farmId ? 'AND farm_id=?' : ''}
      AND COALESCE(transplant_date, nursery_date, ?) <= ? AND COALESCE(harvest_end, ?) >= ?`,
  farmId ? [from, to, o, farmId, from, to, to, from] : [from, to, o, from, to, to, from]);
  const weight = {};
  for (const c of cycles) {
    const s = c.s > from ? c.s : from; const e = c.e < to ? c.e : to;
    weight[c.crop_id] = (weight[c.crop_id] || 0) + c.area * Math.max(0, days(s, e));
  }
  if (!Object.keys(weight).length) for (const s of sales) weight[s.crop_id] = Number(s.amount);
  if (!Object.values(weight).some((x) => x > 0)) for (const h of harvest) weight[h.crop_id] = Number(h.qty);
  const wSum = Object.values(weight).reduce((a, b) => a + b, 0) || 1;

  const ids = new Set([...harvest.map((x) => x.crop_id), ...sales.map((x) => x.crop_id), ...direct.map((x) => x.crop_id)]);
  const byCrop = [...ids].map((id) => {
    const c = crops.find((x) => x.id === id) || {};
    const h = harvest.find((x) => x.crop_id === id) || {}; const s = sales.find((x) => x.crop_id === id) || {};
    const d = Number((direct.find((x) => x.crop_id === id) || {}).amt || 0);
    const sh = shared * ((weight[id] || 0) / wSum);
    const sold = Number(s.qty || 0); const accepted = sold - Number(s.rej || 0);
    const revenue = Number(s.amount || 0); const cost = d + sh;
    const harvested = Number(h.qty || 0);
    const basisQty = harvested || accepted;
    return {
      crop_id: id, crop: c.name, variety: c.variety, unit: c.unit, color: c.color,
      harvested: r2(harvested), culls: r2(h.culls), a_grade_pct: harvested ? r2((100 * Number(h.a_qty || 0)) / harvested) : 0,
      sold: r2(sold), rejected: r2(s.rej), revenue: r2(revenue),
      avg_price: accepted ? r2(revenue / accepted) : 0,
      direct_cost: r2(d), shared_cost: r2(sh), cost: r2(cost),
      cost_per_unit: basisQty ? r2(cost / basisQty) : 0,
      profit: r2(revenue - cost), margin: revenue ? r2((100 * (revenue - cost)) / revenue) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // --- vendors ---
  const vend = await q(`SELECT s.party_id, p.name, SUM(s.quantity) qty, SUM(COALESCE(s.rejected_qty,0)) rej, SUM(s.amount) revenue, COUNT(*) deliveries, MAX(s.date) last_sale
      FROM sales s JOIN parties p ON p.id=s.party_id WHERE s.org_id=? AND s.date BETWEEN ? AND ? ${fSales} GROUP BY s.party_id, p.name`, P());
  const vendCrop = await q(`SELECT s.party_id, s.crop_id, SUM(s.quantity) qty, SUM(s.amount) amount, SUM(s.quantity - COALESCE(s.rejected_qty,0)) acc
      FROM sales s WHERE s.org_id=? AND s.date BETWEEN ? AND ? ${fSales} GROUP BY s.party_id, s.crop_id`, P());
  const pays = await q('SELECT party_id, SUM(amount) amt FROM payments_received WHERE org_id=? AND date BETWEEN ? AND ? GROUP BY party_id', [o, from, to]);
  const rec = await receivables(o, to);
  const byVendor = vend.map((v) => {
    const r = rec.find((x) => x.party_id === v.party_id) || {};
    return {
      party_id: v.party_id, name: v.name, deliveries: v.deliveries, qty: r2(v.qty), rejected: r2(v.rej),
      rejection_pct: v.qty ? r2((100 * v.rej) / v.qty) : 0, revenue: r2(v.revenue),
      payments: r2((pays.find((p) => p.party_id === v.party_id) || {}).amt || 0),
      balance: r.balance || 0, overdue: r.overdue || 0, credit_days: r.credit_days || 0, last_sale: v.last_sale,
      crops: vendCrop.filter((x) => x.party_id === v.party_id).map((x) => ({ crop_id: x.crop_id, crop: cropName(x.crop_id), qty: r2(x.qty), amount: r2(x.amount), avg_rate: x.acc ? r2(x.amount / x.acc) : 0 })),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // price matrix: average realised rate of each crop at each vendor (helps pick the best vendor)
  const matrixCrops = byCrop.filter((c) => c.sold > 0).map((c) => ({ crop_id: c.crop_id, crop: c.crop, avg: c.avg_price }));
  const priceMatrix = { crops: matrixCrops, rows: byVendor.map((v) => ({ party_id: v.party_id, name: v.name, rates: Object.fromEntries(v.crops.map((c) => [c.crop_id, c.avg_rate])) })) };

  // --- expenses by category & by farm ---
  const byCategory = await q(`SELECT c.name category, c.kind, ROUND(SUM(e.amount),2) amount, COUNT(*) entries FROM expenses e JOIN expense_categories c ON c.id=e.category_id
      WHERE e.org_id=? AND e.date BETWEEN ? AND ? ${fE} GROUP BY c.id, c.name, c.kind ORDER BY amount DESC`, P());
  const farmsRows = await q('SELECT id, name, area_acres, member_name FROM farms WHERE org_id=?', [o]);
  const fRev = await q('SELECT farm_id, SUM(amount) amt FROM sales WHERE org_id=? AND date BETWEEN ? AND ? GROUP BY farm_id', [o, from, to]);
  const fExp = await q('SELECT farm_id, SUM(amount) amt FROM expenses WHERE org_id=? AND date BETWEEN ? AND ? GROUP BY farm_id', [o, from, to]);
  const fH2 = await q('SELECT farm_id, SUM(quantity) qty FROM harvests WHERE org_id=? AND date BETWEEN ? AND ? GROUP BY farm_id', [o, from, to]);
  const byFarm = [...farmsRows, { id: null, name: 'Shared / not tagged' }].map((f) => {
    const rev = Number((fRev.find((x) => x.farm_id === f.id) || {}).amt || 0);
    const exp = Number((fExp.find((x) => x.farm_id === f.id) || {}).amt || 0);
    return { farm_id: f.id, name: f.name, member: f.member_name, acres: f.area_acres, revenue: r2(rev), expenses: r2(exp), harvest: r2((fH2.find((x) => x.farm_id === f.id) || {}).qty), profit: r2(rev - exp) };
  }).filter((f) => f.revenue || f.expenses || f.harvest || f.farm_id);

  // --- trend ---
  const bS = await q(`SELECT ${bucketExpr('date', group)} b, SUM(amount) amt, SUM(quantity) qty FROM sales s WHERE org_id=? AND date BETWEEN ? AND ? ${fSales} GROUP BY b`, P());
  const bE = await q(`SELECT ${bucketExpr('date', group)} b, SUM(amount) amt FROM expenses e WHERE org_id=? AND date BETWEEN ? AND ? ${fE} GROUP BY b`, P());
  const bH = await q(`SELECT ${bucketExpr('date', group)} b, SUM(quantity) qty FROM harvests h WHERE org_id=? AND date BETWEEN ? AND ? ${fH} GROUP BY b`, P());
  const buckets = [...new Set([...bS, ...bE, ...bH].map((x) => x.b))].sort();
  const trend = buckets.map((b) => {
    const rev = Number((bS.find((x) => x.b === b) || {}).amt || 0); const exp = Number((bE.find((x) => x.b === b) || {}).amt || 0);
    return { bucket: b, revenue: r2(rev), expenses: r2(exp), profit: r2(rev - exp), harvest: r2((bH.find((x) => x.b === b) || {}).qty), sold: r2((bS.find((x) => x.b === b) || {}).qty) };
  });

  // crop x bucket quantity (stacked chart)
  const cropTrendRows = await q(`SELECT ${bucketExpr('date', group)} b, crop_id, SUM(quantity) qty FROM sales s WHERE org_id=? AND date BETWEEN ? AND ? ${fSales} GROUP BY b, crop_id`, P());
  const cropTrend = buckets.map((b) => {
    const row = { bucket: b };
    for (const r of cropTrendRows.filter((x) => x.b === b)) row[cropName(r.crop_id)] = r2(r.qty);
    return row;
  });

  // --- labour ---
  let labour = null;
  if (on(org, 'labour')) {
    const att = await one(`SELECT COALESCE(SUM(CASE status WHEN 'present' THEN 1 WHEN 'half' THEN 0.5 ELSE 0 END),0) mandays, COUNT(DISTINCT worker_id) workers
        FROM attendance a WHERE org_id=? AND date BETWEEN ? AND ? ${farmId ? 'AND farm_id=?' : ''}`, P());
    const lc = await one(`SELECT COALESCE(SUM(e.amount),0) amt FROM expenses e JOIN expense_categories c ON c.id=e.category_id
        WHERE e.org_id=? AND e.date BETWEEN ? AND ? ${fE} AND c.kind='labour'`, P());
    const totalH = harvest.reduce((s, x) => s + Number(x.qty), 0);
    labour = { mandays: r2(att.mandays), workers: att.workers, cost: r2(lc.amt), cost_per_unit: totalH ? r2(lc.amt / totalH) : 0 };
  }

  const otherIncome = on(org, 'other_income') ? Number((await one('SELECT COALESCE(SUM(amount),0) t FROM other_income WHERE org_id=? AND date BETWEEN ? AND ?', [o, from, to])).t) : 0;
  const revenue = byCrop.reduce((s, c) => s + c.revenue, 0);
  const totals = {
    harvested: r2(byCrop.reduce((s, c) => s + c.harvested, 0)),
    culls: r2(byCrop.reduce((s, c) => s + c.culls, 0)),
    sold: r2(byCrop.reduce((s, c) => s + c.sold, 0)),
    rejected: r2(byCrop.reduce((s, c) => s + c.rejected, 0)),
    revenue: r2(revenue), other_income: r2(otherIncome),
    expenses: r2(expTotal.t), depreciation: dep,
    profit: r2(revenue + otherIncome - Number(expTotal.t) - dep),
    collected: r2(pays.reduce((s, p) => s + Number(p.amt), 0)),
    receivable: r2(rec.reduce((s, r) => s + Math.max(0, r.balance), 0)),
    overdue: r2(rec.reduce((s, r) => s + r.overdue, 0)),
    vendors: byVendor.length,
  };
  totals.margin = totals.revenue ? r2((100 * totals.profit) / (totals.revenue + totals.other_income)) : 0;
  totals.sell_through = totals.harvested ? r2((100 * totals.sold) / totals.harvested) : 0;

  return { from, to, group, totals, byCrop, byVendor, priceMatrix, byCategory, byFarm, trend, cropTrend, labour };
}

async function pnl(org, from, to, farmId) {
  const s = await summary(org, from, to, farmId, 'month');
  const fE = farmId ? 'AND e.farm_id=?' : '';
  const expenses = await q(`SELECT c.kind, c.name, ROUND(SUM(e.amount),2) amount FROM expenses e JOIN expense_categories c ON c.id=e.category_id
      WHERE e.org_id=? AND e.date BETWEEN ? AND ? ${fE} GROUP BY c.kind, c.name ORDER BY c.kind, amount DESC`, farmId ? [org.id, from, to, farmId] : [org.id, from, to]);
  const other = on(org, 'other_income') ? await q('SELECT source, ROUND(SUM(amount),2) amount FROM other_income WHERE org_id=? AND date BETWEEN ? AND ? GROUP BY source', [org.id, from, to]) : [];
  const income = s.byCrop.filter((c) => c.revenue).map((c) => ({ name: `Sales - ${c.crop}`, amount: c.revenue, qty: c.sold, unit: c.unit }));
  const totalIncome = r2(income.reduce((a, b) => a + b.amount, 0) + other.reduce((a, b) => a + Number(b.amount), 0));
  const totalExp = r2(expenses.reduce((a, b) => a + Number(b.amount), 0) + s.totals.depreciation);
  return {
    from, to, income, other_income: other, expenses, depreciation: s.totals.depreciation,
    total_income: totalIncome, total_expenses: totalExp, net_profit: r2(totalIncome - totalExp),
    byCrop: s.byCrop, byFarm: s.byFarm,
  };
}

async function balance(org, asOn = today()) {
  const o = org.id; const start = org.settings.books_start || '1900-01-01';
  const sum = async (sql, p) => Number((await one(sql, p)).t || 0);
  const paidExpr = "CASE WHEN paid_amount IS NULL THEN (CASE WHEN payment_mode='credit' THEN 0 ELSE amount END) ELSE paid_amount END";
  const inflow = await sum('SELECT SUM(amount) t FROM payments_received WHERE org_id=? AND date BETWEEN ? AND ?', [o, start, asOn])
    + await sum('SELECT SUM(amount) t FROM other_income WHERE org_id=? AND date BETWEEN ? AND ?', [o, start, asOn])
    + await sum('SELECT SUM(principal) t FROM loans WHERE org_id=? AND start_date BETWEEN ? AND ?', [o, start, asOn])
    + await sum('SELECT SUM(deductions) t FROM wage_payments WHERE org_id=? AND date BETWEEN ? AND ?', [o, start, asOn]); // advances recovered (not paid out again)
  const outflow = await sum(`SELECT SUM(${paidExpr}) t FROM expenses WHERE org_id=? AND date BETWEEN ? AND ?`, [o, start, asOn])
    + await sum('SELECT SUM(amount - interest_part) t FROM loan_repayments WHERE org_id=? AND date BETWEEN ? AND ?', [o, start, asOn])
    + await sum('SELECT SUM(cost) t FROM assets WHERE org_id=? AND purchase_date BETWEEN ? AND ?', [o, start, asOn])
    + await sum("SELECT SUM(amount) t FROM advances WHERE org_id=? AND type='advance' AND date BETWEEN ? AND ?", [o, start, asOn]);
  const cash = r2(Number(org.settings.opening_cash || 0) + inflow - outflow);

  const rec = await receivables(o, asOn);
  const receivable = r2(rec.reduce((a, r) => a + Math.max(0, r.balance), 0));
  const stock = await one(`SELECT COALESCE(SUM(GREATEST(0, i.opening_stock + COALESCE(m.net,0)) * COALESCE(m.avg_rate,0)),0) t FROM inventory_items i
      LEFT JOIN (SELECT item_id, SUM(CASE WHEN type='out' THEN -quantity ELSE quantity END) net,
        SUM(CASE WHEN type='in' THEN quantity*COALESCE(rate,0) END)/NULLIF(SUM(CASE WHEN type='in' THEN quantity END),0) avg_rate
        FROM stock_moves WHERE date<=? GROUP BY item_id) m ON m.item_id=i.id WHERE i.org_id=?`, [asOn, o]);
  const advRec = await sum("SELECT SUM(amount) t FROM advances WHERE org_id=? AND type IN ('advance','deduction') AND date<=?", [o, asOn])
    - await sum('SELECT SUM(deductions) t FROM wage_payments WHERE org_id=? AND date<=?', [o, asOn]);
  const assets = await q('SELECT * FROM assets WHERE org_id=? AND purchase_date<=?', [o, asOn]);
  const fixed = r2(assets.reduce((a, x) => {
    const frac = Math.min(1, days(x.purchase_date, asOn) / (365 * (Number(x.life_years) || 1)));
    return a + Math.max(Number(x.salvage_value || 0), x.cost - (x.cost - (x.salvage_value || 0)) * frac);
  }, 0));
  const loans = await sum('SELECT SUM(principal) t FROM loans WHERE org_id=? AND start_date<=?', [o, asOn])
    - await sum('SELECT SUM(amount - interest_part) t FROM loan_repayments WHERE org_id=? AND date<=?', [o, asOn]);
  const pay = await payables(o, asOn);
  const payable = r2(pay.reduce((a, b) => a + Number(b.due), 0));

  const assetsList = [
    { name: 'Cash & bank (computed)', amount: cash },
    { name: 'Receivable from vendors', amount: receivable },
    { name: 'Input stock (at cost)', amount: r2(stock.t) },
    { name: 'Advances with workers', amount: r2(Math.max(0, advRec)) },
    { name: 'Fixed assets (book value)', amount: fixed },
  ];
  const liabilities = [
    { name: 'Loans outstanding', amount: r2(loans) },
    { name: 'Payable to suppliers', amount: payable },
  ];
  const ta = r2(assetsList.reduce((a, b) => a + b.amount, 0)); const tl = r2(liabilities.reduce((a, b) => a + b.amount, 0));
  return { as_on: asOn, books_start: org.settings.books_start, assets: assetsList, liabilities, total_assets: ta, total_liabilities: tl, net_worth: r2(ta - tl), receivables: rec.filter((r) => r.balance), payables: pay };
}

// ---------- alerts ----------
async function alerts(org) {
  const o = org.id; const t = org.settings.thresholds; const now = today(); const out = [];
  const push = (level, module, title, detail, link) => out.push({ level, module, title, detail, link });

  if (on(org, 'fertigation')) {
    const logs = await q(`SELECT l.*, f.name farm, b.name bay, r.ec_min, r.ec_max, r.ph_min, r.ph_max FROM fertigation_logs l
        JOIN farms f ON f.id=l.farm_id LEFT JOIN bays b ON b.id=l.bay_id
        LEFT JOIN crop_cycles c ON c.id=l.crop_cycle_id
        LEFT JOIN fertigation_recipes r ON r.id=(SELECT id FROM fertigation_recipes WHERE crop_id=c.crop_id ORDER BY id LIMIT 1)
        WHERE l.org_id=? AND l.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY l.date DESC, l.id DESC`, [o]);
    const groups = {};
    for (const l of logs) (groups[`${l.farm_id}|${l.bay_id}`] = groups[`${l.farm_id}|${l.bay_id}`] || []).push(l);
    for (const g of Object.values(groups)) {
      const [a, b, c] = g; const where = `${a.farm}${a.bay ? ' / ' + a.bay : ''}`;
      const ecMin = a.ec_min ?? t.ec_min; const ecMax = a.ec_max ?? t.ec_max; const phMin = a.ph_min ?? t.ph_min; const phMax = a.ph_max ?? t.ph_max;
      const bad = (x) => x && ((x.feed_ec != null && (x.feed_ec < ecMin || x.feed_ec > ecMax)) || (x.feed_ph != null && (x.feed_ph < phMin || x.feed_ph > phMax)));
      if (bad(a) && bad(b)) push('red', 'fertigation', `EC/pH out of band at ${where}`, `Last two readings: EC ${a.feed_ec}/${b.feed_ec}, pH ${a.feed_ph}/${b.feed_ph}. Target EC ${ecMin}-${ecMax}, pH ${phMin}-${phMax}.`, '/m/fertigation_logs');
      else if (bad(a)) push('amber', 'fertigation', `EC/pH reading off at ${where}`, `EC ${a.feed_ec}, pH ${a.feed_ph} on ${a.date}.`, '/m/fertigation_logs');
      const salt = (x) => x && x.drain_ec != null && x.feed_ec != null && x.drain_ec - x.feed_ec > t.drain_ec_margin;
      if (salt(a) && salt(b) && salt(c)) push('red', 'fertigation', `Salt build-up at ${where}`, `Drain EC above feed EC by more than ${t.drain_ec_margin} for 3 readings - flush with plain water.`, '/m/fertigation_logs');
    }
  }
  if (on(org, 'climate')) {
    const cl = await q(`SELECT l.*, f.name farm FROM climate_logs l JOIN farms f ON f.id=l.farm_id WHERE l.org_id=? AND l.id IN
        (SELECT MAX(id) FROM climate_logs WHERE org_id=? AND date >= DATE_SUB(CURDATE(), INTERVAL 2 DAY) GROUP BY farm_id)`, [o, o]);
    for (const c of cl) {
      if (c.temperature != null && (c.temperature < t.temp_min || c.temperature > t.temp_max)) push('amber', 'climate', `Temperature ${c.temperature}°C at ${c.farm}`, `Target ${t.temp_min}-${t.temp_max}°C. Check vents, curtains and foggers.`, '/m/climate_logs');
      if (c.humidity != null && (c.humidity < t.hum_min || c.humidity > t.hum_max)) push('amber', 'climate', `Humidity ${c.humidity}% at ${c.farm}`, `Target ${t.hum_min}-${t.hum_max}%. High humidity invites fungus.`, '/m/climate_logs');
    }
  }
  if (on(org, 'scouting')) {
    const sc = await q(`SELECT s.*, f.name farm, b.name bay FROM scouting_logs s JOIN farms f ON f.id=s.farm_id LEFT JOIN bays b ON b.id=s.bay_id
        WHERE s.org_id=? AND s.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND (s.trap_count > ? OR s.severity='high') ORDER BY s.date DESC`, [o, t.trap_count]);
    for (const s of sc.slice(0, 5)) push(s.severity === 'high' ? 'red' : 'amber', 'scouting', `Pest pressure: ${s.pest || 'pest'} at ${s.farm}${s.bay ? ' / ' + s.bay : ''}`, `Trap count ${s.trap_count} on ${s.date} (threshold ${t.trap_count}).`, '/m/scouting_logs');
    for (const l of await activeLocks(o, now)) push('info', 'scouting', `Harvest locked: ${l.farm_name}${l.bay_name ? ' / ' + l.bay_name : ''}`, `Sprayed ${l.product} on ${l.date}. Safe to pick from ${l.lock_until}.`, '/m/spray_logs');
  }
  if (on(org, 'sales')) {
    const rec = (await receivables(o)).filter((r) => r.overdue > 0).sort((a, b) => b.overdue - a.overdue);
    for (const r of rec.slice(0, 6)) push('red', 'sales', `${r.name} owes ₹${r.overdue.toLocaleString('en-IN')} overdue`, `Total due ₹${r.balance.toLocaleString('en-IN')}, credit ${r.credit_days} days, last paid ${r.last_payment || 'never'}.${r.phone ? ' Call ' + r.phone : ''}`, '/vendors');
    const rej = await q(`SELECT p.name, SUM(s.rejected_qty) rej, SUM(s.quantity) qty FROM sales s JOIN parties p ON p.id=s.party_id
        WHERE s.org_id=? AND s.date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) GROUP BY p.id, p.name HAVING qty>0 AND rej/qty > 0.05`, [o]);
    for (const r of rej) push('amber', 'sales', `High rejection by ${r.name}`, `${r2((100 * r.rej) / r.qty)}% rejected in last 14 days. Check grading or renegotiate.`, '/vendors');
  }
  if (on(org, 'orders')) {
    const od = await one("SELECT COUNT(*) n, SUM(quantity) qty FROM orders WHERE org_id=? AND status='open' AND date<=?", [o, now]);
    if (od.n) push('amber', 'orders', `${od.n} vendor order(s) pending`, 'Open orders due today or earlier. Fulfil them from the Sell screen.', '/sell');
  }
  if (on(org, 'inventory')) {
    const low = await q(`SELECT i.name, i.unit, i.reorder_level, i.opening_stock + COALESCE((SELECT SUM(CASE WHEN type='out' THEN -quantity ELSE quantity END) FROM stock_moves m WHERE m.item_id=i.id),0) stock
        FROM inventory_items i WHERE i.org_id=? AND i.reorder_level>0 HAVING stock < reorder_level`, [o]);
    for (const l of low) push('amber', 'inventory', `Low stock: ${l.name}`, `${r2(l.stock)} ${l.unit} left (alert below ${l.reorder_level}). Reorder now.`, '/m/inventory_items');
  }
  if (on(org, 'expenses')) {
    const s = await summary(org, addDays(now, -13), now, null);
    for (const c of s.byCrop.filter((c) => c.sold > 0 && c.cost_per_unit > c.avg_price)) push('red', 'finance', `${c.crop}: cost above price`, `Last 14 days cost ₹${c.cost_per_unit}/${c.unit} vs price ₹${c.avg_price}/${c.unit}.`, '/reports');
  }
  if (on(org, 'recurring')) {
    const due = await q("SELECT name, amount, next_due FROM recurring_expenses WHERE org_id=? AND active=1 AND auto_post=0 AND next_due <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)", [o]);
    for (const d of due) push('info', 'recurring', `${d.name} due ${d.next_due}`, `₹${d.amount} - mark as paid from Recurring payments.`, '/m/recurring_expenses');
  }
  if (on(org, 'assets')) {
    const a = await q(`SELECT name, next_service, DATE_ADD(purchase_date, INTERVAL ROUND(life_years*12) MONTH) replace_on FROM assets WHERE org_id=?
        AND (next_service <= DATE_ADD(CURDATE(), INTERVAL ? DAY) OR DATE_ADD(purchase_date, INTERVAL ROUND(life_years*12) MONTH) <= DATE_ADD(CURDATE(), INTERVAL 180 DAY))`, [o, t.asset_due_days]);
    for (const x of a) {
      if (x.next_service && x.next_service <= addDays(now, t.asset_due_days)) push('info', 'assets', `Service due: ${x.name}`, `Scheduled ${x.next_service}.`, '/m/assets');
      if (x.replace_on <= addDays(now, 180)) push('amber', 'assets', `Replacement due: ${x.name}`, `End of life on ${x.replace_on}. Keep funds ready.`, '/m/assets');
    }
  }
  if (on(org, 'documents')) {
    const d = await q('SELECT title, expiry_date FROM documents WHERE org_id=? AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)', [o, t.doc_expiry_days]);
    for (const x of d) push('amber', 'documents', `Document expiring: ${x.title}`, `Expires ${x.expiry_date}.`, '/m/documents');
  }
  const leases = await q("SELECT name, lease_end FROM farms WHERE org_id=? AND ownership='leased' AND lease_end IS NOT NULL AND lease_end <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)", [o]);
  for (const l of leases) push('amber', 'farms', `Lease ending: ${l.name}`, `Lease ends ${l.lease_end}. Renew or plan the move.`, '/m/farms');

  const rank = { red: 0, amber: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// One plain-language headline for the dashboard
function finding(s, prev, cur = '₹') {
  const T = s.totals; const fmt = (x) => cur + Math.round(x).toLocaleString('en-IN');
  if (!T.revenue && !T.expenses && !T.harvested) return 'No entries yet for this period. Start by recording today\'s harvest, sales or expenses.';
  const parts = [];
  parts.push(`${T.profit >= 0 ? 'Profit' : 'Loss'} of ${fmt(Math.abs(T.profit))} on sales of ${fmt(T.revenue)}`);
  if (prev && prev.totals.revenue) {
    const ch = Math.round((100 * (T.revenue - prev.totals.revenue)) / prev.totals.revenue);
    parts[0] += ` (sales ${ch >= 0 ? 'up' : 'down'} ${Math.abs(ch)}% vs previous period)`;
  }
  const best = [...s.byCrop].filter((c) => c.sold).sort((a, b) => b.profit - a.profit)[0];
  const worst = [...s.byCrop].filter((c) => c.sold).sort((a, b) => a.margin - b.margin)[0];
  if (best) parts.push(`${best.crop} earned most (${fmt(best.profit)} profit, ${cur}${best.avg_price}/${best.unit})`);
  if (worst && worst !== best && worst.margin < 0) parts.push(`${worst.crop} is losing money - cost ${cur}${worst.cost_per_unit} vs price ${cur}${worst.avg_price}`);
  const topV = s.byVendor[0];
  if (topV) parts.push(`top vendor ${topV.name}`);
  if (T.overdue > 0) parts.push(`${fmt(T.overdue)} is overdue from vendors`);
  return parts.join('; ') + '.';
}

module.exports = { summary, pnl, balance, receivables, payables, alerts, finding, depreciation };
