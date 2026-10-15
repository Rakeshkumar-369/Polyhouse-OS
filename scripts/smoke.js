// API smoke test: logs in as every demo role and calls every screen's endpoints, plus write flows.
//   npm run smoke                 (API must be running, demo data loaded with npm run db:reset)
//   npm run smoke -- --read-only  (skip the write flows)
//   BASE=https://your-app.onrender.com npm run smoke -- --read-only   (check a deployed site)
const BASE = (process.env.BASE || 'http://localhost:4000').replace(/\/$/, '') + '/api';
const READ_ONLY = process.argv.includes('--read-only');
let pass = 0; let fail = 0;
const today = new Date().toISOString().slice(0, 10);
const monthStart = today.slice(0, 8) + '01';

async function call(token, method, url, body, expect = 200) {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  const ok = res.status === expect;
  if (ok) pass++; else { fail++; console.log(`FAIL ${method} ${url} -> ${res.status} (expected ${expect}) ${data.error || ''}`); }
  return data;
}
const login = async (l, p) => (await call(null, 'POST', '/auth/login', { login: l, password: p })).token;

(async () => {
  await call(null, 'GET', '/health');
  const owner = await login('xyz', 'xyz123');
  const meta = await call(owner, 'GET', '/meta');
  for (const r of Object.keys(meta.resources || {})) {
    await call(owner, 'GET', `/r/${r}`, null);
    await call(owner, 'GET', `/r/${r}/options`, null);
  }
  for (const u of ['/dashboard', '/alerts', '/reports/receivables', '/reports/daybook', '/settings', '/users', '/ops/produce-stock', '/ops/locks', '/ops/attendance-sheet'])
    await call(owner, 'GET', u);
  for (const g of ['day', 'week', 'month']) await call(owner, 'GET', `/reports/summary?from=2026-01-01&to=${today}&group=${g}`);
  await call(owner, 'GET', `/reports/pnl?from=${monthStart}&to=${today}`);
  await call(owner, 'GET', `/reports/balance?date=${today}`);
  await call(owner, 'GET', `/ops/wage-run?from=${monthStart}&to=${today}`);
  const vendors = await call(owner, 'GET', '/r/parties?type=buyer');
  await call(owner, 'GET', `/reports/vendor/${vendors[0].id}`);

  const sup = await login('super1', 'demo123');
  await call(sup, 'GET', '/dashboard'); await call(sup, 'GET', '/r/harvests'); await call(sup, 'GET', '/r/expenses', null, 403);
  const del = await login('delivery1', 'demo123');
  await call(del, 'GET', '/r/sales'); await call(del, 'GET', '/reports/summary', null, 403);
  const ven = await login('vendor1', 'demo123');
  const vp = await call(ven, 'GET', '/portal/vendor'); await call(ven, 'GET', '/r/sales', null, 403);
  const lab = await login('labour1', 'demo123');
  await call(lab, 'GET', '/portal/labour'); await call(lab, 'GET', '/dashboard', null, 403);
  const sa = await login('superadmin', process.env.SUPERADMIN_PASSWORD || 'admin123');
  await call(sa, 'GET', '/super/orgs'); await call(sa, 'GET', '/super/leads'); await call(owner, 'GET', '/super/orgs', null, 403);

  if (!READ_ONLY) {
    const crops = await call(owner, 'GET', '/r/crops');
    const sale = await call(del, 'POST', '/r/sales', { party_id: vendors[0].id, crop_id: crops[0].id, grade: 'A', quantity: 5 });
    if (!(sale.rate > 0)) { fail++; console.log('FAIL sale price not applied from price list'); } else pass++;
    await call(sup, 'POST', '/r/harvests', { crop_id: crops[0].id, quantity: 12, grade: 'A' });
    const cats = await call(owner, 'GET', '/r/expense_categories/options');
    await call(owner, 'POST', '/r/expenses', { category_id: cats[0].id, amount: 250, description: 'smoke test' });
    await call(owner, 'POST', '/r/payments_received', { party_id: vendors[0].id, amount: 100, mode: 'upi' });
    const mine = vp.lines.find((l) => l.kind === 'sale' && l.status === 'delivered');
    if (mine) await call(ven, 'PUT', `/portal/vendor/sales/${mine.id}`, { rejected_qty: 0 });
    await call(ven, 'POST', '/portal/vendor/orders', { crop_id: crops[0].id, quantity: 10, date: today });
    await call(lab, 'POST', '/portal/labour/checkin', null, 200);
    await call(null, 'POST', '/public/demo-request', { name: 'Smoke Test', phone: '9000000000' });
    await call(owner, 'POST', '/r/sales', { party_id: vendors[0].id, quantity: 1 }, 400); // missing crop -> validation
  }
  console.log(`\n${pass} passed, ${fail} failed${READ_ONLY ? ' (read-only)' : ''}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Smoke test crashed:', e.message, '\nIs the API running at', BASE, '?'); process.exit(1); });
