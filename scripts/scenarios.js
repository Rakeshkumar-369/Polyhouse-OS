// Scenario tests: edits, deletes, permissions, module toggles, cross-organisation access, bad input.
// Run against a server with demo data:   npm run scenarios
const BASE = (process.env.BASE || 'http://localhost:4000').replace(/\/$/, '') + '/api';
let pass = 0; let fail = 0;
const today = new Date().toISOString().slice(0, 10);
const check = (ok, name, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL', name, extra); } };

async function call(token, method, url, body) {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const login = async (l, p) => (await call(null, 'POST', '/auth/login', { login: l, password: p })).data.token;

(async () => {
  const owner = await login('xyz', 'xyz123');
  const del = await login('delivery1', 'demo123');
  const sup = await login('super1', 'demo123');
  const ven = await login('vendor1', 'demo123');
  const lab = await login('labour1', 'demo123');
  const sa = await login('superadmin', process.env.SUPERADMIN_PASSWORD || 'admin123');
  const crops = (await call(owner, 'GET', '/r/crops')).data;
  const vendors = (await call(owner, 'GET', '/r/parties?type=buyer')).data;
  const crop = crops[0]; const vendor = vendors.find((v) => v.name === 'FreshMart Retail') || vendors[0];

  // --- sales: price, edits, validation ---
  let r = await call(del, 'POST', '/r/sales', { party_id: vendor.id, crop_id: crop.id, grade: 'A', quantity: 10, rate: 1 });
  check(r.status === 200 && r.data.rate > 1, 'delivery cannot override the vendor price', JSON.stringify(r.data).slice(0, 120));
  const sale = r.data;
  r = await call(owner, 'PUT', `/r/sales/${sale.id}`, { quantity: 20 });
  check(r.data.amount === Math.round(20 * sale.rate * 100) / 100, 'editing quantity recalculates amount with the same rate', `${r.data.amount}`);
  r = await call(owner, 'PUT', `/r/sales/${sale.id}`, { rejected_qty: 50 });
  check(r.status === 400, 'rejected more than delivered is refused', r.status);
  r = await call(owner, 'POST', '/r/sales', { party_id: vendor.id, crop_id: crop.id, quantity: -5 });
  check(r.status === 400, 'negative quantity refused', r.status);
  r = await call(owner, 'POST', '/r/sales', { party_id: vendor.id, crop_id: crop.id, quantity: 5, date: '2026-13-45' });
  check(r.status === 400, 'invalid date refused', r.status);
  r = await call(owner, 'GET', '/r/sales?from=bad-date');
  check(r.status === 400, 'invalid filter date refused', r.status);
  const ord = (await call(ven, 'POST', '/portal/vendor/orders', { crop_id: crop.id, quantity: 7, date: today })).status;
  const orders = (await call(owner, 'GET', '/r/orders?status=open')).data;
  const o = orders.find((x) => x.party_id === vendor.id);
  r = await call(del, 'POST', '/r/sales', { party_id: vendor.id, crop_id: crop.id, quantity: 7, order_id: o.id });
  const o2 = (await call(owner, 'GET', `/r/orders/${o.id}`)).data;
  check(ord === 200 && o2.status === 'fulfilled', 'sale against an order fulfils it');

  // --- vendor confirmations ---
  r = await call(ven, 'PUT', `/portal/vendor/sales/${sale.id}`, { rejected_qty: 999, vendor_note: 'soft' });
  const s2 = (await call(owner, 'GET', `/r/sales/${sale.id}`)).data;
  check(r.status === 200 && s2.rejected_qty === s2.quantity && s2.amount === 0 && s2.status === 'disputed', 'vendor rejection is capped at delivered qty');
  r = await call(ven, 'PUT', `/portal/vendor/sales/${sale.id}`, { rejected_qty: 0 });
  check(r.status === 400, 'cannot confirm twice', r.status);
  const other = vendors.find((v) => v.id !== vendor.id);
  const otherSale = (await call(owner, 'POST', '/r/sales', { party_id: other.id, crop_id: crop.id, quantity: 3 })).data;
  r = await call(ven, 'PUT', `/portal/vendor/sales/${otherSale.id}`, { rejected_qty: 0 });
  check(r.status === 404, "vendor cannot touch another vendor's delivery", r.status);

  // --- expenses & stock ---
  const items = (await call(owner, 'GET', '/r/inventory_items')).data;
  const item = items[0]; const before = item.current_stock;
  const cats = (await call(owner, 'GET', '/r/expense_categories/options')).data;
  r = await call(owner, 'POST', '/r/expenses', { category_id: cats[0].id, item_id: item.id, quantity: 10, rate: 50 });
  check(r.data.amount === 500, 'expense amount = qty x rate');
  const exp = r.data;
  let st = (await call(owner, 'GET', `/r/inventory_items/${item.id}`)).data.current_stock;
  check(st === before + 10, 'purchase adds stock', `${before} -> ${st}`);
  await call(owner, 'PUT', `/r/expenses/${exp.id}`, { quantity: 4, rate: 50, amount: 200 });
  st = (await call(owner, 'GET', `/r/inventory_items/${item.id}`)).data.current_stock;
  check(st === before + 4, 'editing purchase quantity updates stock', `${st}`);
  await call(owner, 'DELETE', `/r/expenses/${exp.id}`);
  st = (await call(owner, 'GET', `/r/inventory_items/${item.id}`)).data.current_stock;
  check(st === before, 'deleting purchase removes the stock', `${st}`);
  r = await call(owner, 'POST', '/r/expenses', { category_id: cats[0].id, amount: 100, paid_amount: 150 });
  check(r.status === 400, 'paid more than the bill is refused', r.status);

  // --- wages & loans linked expenses ---
  const workers = (await call(owner, 'GET', '/r/workers')).data;
  r = await call(owner, 'POST', '/r/wage_payments', { worker_id: workers[0].id, period_start: today, period_end: today, gross: 500, deductions: 0 });
  const wp = r.data;
  let linked = (await call(owner, 'GET', '/r/expenses?limit=5000')).data.filter((e) => e.wage_payment_id === wp.id);
  check(linked.length === 1 && linked[0].amount === 500, 'wage payment books a labour expense');
  r = await call(owner, 'POST', '/r/wage_payments', { worker_id: workers[0].id, period_start: today, period_end: today, gross: 100, deductions: 300 });
  check(r.status === 400, 'deductions larger than pay refused', r.status);
  await call(owner, 'DELETE', `/r/wage_payments/${wp.id}`);
  linked = (await call(owner, 'GET', '/r/expenses?limit=5000')).data.filter((e) => e.wage_payment_id === wp.id);
  check(linked.length === 0, 'deleting wage payment removes its expense');

  // --- delete protection ---
  r = await call(owner, 'DELETE', `/r/crops/${crop.id}`);
  check(r.status === 409, 'crop in use cannot be deleted (409)', `${r.status} ${r.data.error}`);
  r = await call(owner, 'DELETE', `/r/parties/${vendor.id}`);
  check(r.status === 409, 'vendor in use cannot be deleted', r.status);
  const fresh = (await call(owner, 'POST', '/r/crops', { name: 'Test crop ' + Date.now() })).data;
  r = await call(owner, 'DELETE', `/r/crops/${fresh.id}`);
  check(r.status === 200, 'unused crop can be deleted', r.status);

  // --- harvest lock ---
  const locks = (await call(owner, 'GET', '/ops/locks')).data;
  if (locks.length) {
    const l = locks[0];
    r = await call(sup, 'POST', '/r/harvests', { crop_id: crop.id, quantity: 5, farm_id: l.farm_id, bay_id: l.bay_id, override_lock: 1 });
    check(r.status === 409, 'supervisor cannot override a spray lock', r.status);
    r = await call(owner, 'POST', '/r/harvests', { crop_id: crop.id, quantity: 5, farm_id: l.farm_id, bay_id: l.bay_id, override_lock: 1 });
    check(r.status === 200, 'owner can override a spray lock', r.status);
  }

  // --- labour check-in sequence ---
  const c1 = (await call(lab, 'POST', '/portal/labour/checkin')).status;
  const c2 = (await call(lab, 'POST', '/portal/labour/checkin')).status;
  check(c1 === 200 && [200, 400].includes(c2), 'labour check-in / check-out sequence');

  // --- permissions ---
  check((await call(del, 'GET', '/r/expenses')).status === 403, 'delivery cannot see expenses');
  check((await call(sup, 'GET', '/reports/pnl')).status === 403, 'supervisor cannot see P&L');
  check((await call(ven, 'GET', '/r/parties/options')).status === 403, 'vendor cannot list other vendors');
  check((await call(lab, 'GET', '/r/workers')).status === 403, 'labour cannot list workers');
  check((await call(owner, 'GET', '/super/orgs')).status === 403, 'owner cannot reach super admin');
  check((await call(null, 'GET', '/dashboard')).status === 401, 'no token -> 401');

  // --- module toggles ---
  await call(owner, 'PUT', '/settings', { settings: { modules: { labour: false } } });
  check((await call(owner, 'GET', '/r/workers')).status === 403, 'module off blocks its API');
  const meta = (await call(owner, 'GET', '/meta')).data;
  check(!meta.resources.workers, 'module off hides its screens');
  await call(owner, 'PUT', '/settings', { settings: { modules: { labour: true } } });
  check((await call(owner, 'GET', '/r/workers')).status === 200, 'module back on restores access');

  // --- users ---
  check((await call(owner, 'POST', '/users', { name: 'X', login: 'xyz', password: 'abcdef', role: 'delivery' })).status === 400, 'duplicate login refused');
  check((await call(owner, 'POST', '/users', { name: 'X', login: 'lab' + Date.now(), password: 'abcdef', role: 'labour' })).status === 400, 'labour login needs a worker');
  const me = meta.user;
  check((await call(owner, 'PUT', `/users/${me.id}`, { active: false })).status === 400, 'owner cannot disable themselves');

  // --- cross-organisation isolation ---
  const stamp = Date.now();
  const org = await call(sa, 'POST', '/super/orgs', { name: 'Iso ' + stamp, admin_login: 'iso' + stamp, admin_password: 'iso12345' });
  const iso = await login('iso' + stamp, 'iso12345');
  check((await call(iso, 'GET', `/r/sales/${sale.id}`)).status === 404, "another org's sale is invisible");
  check((await call(iso, 'POST', '/r/sales', { party_id: vendor.id, crop_id: crop.id, quantity: 1 })).status === 400, "another org's vendor/crop cannot be used");
  check((await call(iso, 'PUT', `/r/crops/${crop.id}`, { name: 'hack' })).status === 404, "another org's crop cannot be edited");
  r = await call(iso, 'GET', '/dashboard');
  check(r.status === 200 && r.data.summary.totals.revenue === 0, 'empty org dashboard works');
  check((await call(iso, 'GET', '/suggestions')).status === 200, 'empty org suggestions work');
  for (const u of ['/reports/summary', '/reports/pnl', `/reports/balance?date=${today}`, '/alerts']) check((await call(iso, 'GET', u)).status === 200, `empty org ${u}`);

  // --- suspend / reset ---
  await call(sa, 'PUT', `/super/orgs/${org.data.id}`, { status: 'suspended' });
  check((await call(null, 'POST', '/auth/login', { login: 'iso' + stamp, password: 'iso12345' })).status === 403, 'suspended org cannot log in');
  check((await call(iso, 'GET', '/meta')).status === 403, 'suspended org session is blocked');
  await call(sa, 'PUT', `/super/orgs/${org.data.id}`, { status: 'active' });
  await call(sa, 'POST', `/super/orgs/${org.data.id}/reset-admin`, { password: 'newpass99' });
  check(!!(await login('iso' + stamp, 'newpass99')), 'reset password works');

  // --- recurring payments are posted once ---
  const rec = (await call(owner, 'POST', '/r/recurring_expenses', { name: 'Test bill ' + stamp, category_id: cats[0].id, amount: 111, frequency: 'monthly', next_due: today })).data;
  await call(owner, 'GET', '/dashboard'); await call(owner, 'GET', '/dashboard');
  const posted = (await call(owner, 'GET', '/r/expenses?limit=5000')).data.filter((e) => e.recurring_id === rec.id);
  check(posted.length === 1, 'recurring payment posted exactly once', posted.length);

  // --- attendance sheet ---
  await call(owner, 'POST', '/ops/attendance-sheet', { date: today, entries: [{ worker_id: workers[1].id, status: 'half' }] });
  let sheet = (await call(owner, 'GET', `/ops/attendance-sheet?date=${today}`)).data;
  check(sheet.find((x) => x.worker_id === workers[1].id).status === 'half', 'attendance saved');
  await call(owner, 'POST', '/ops/attendance-sheet', { date: today, entries: [{ worker_id: workers[1].id, status: null }] });
  sheet = (await call(owner, 'GET', `/ops/attendance-sheet?date=${today}`)).data;
  check(!sheet.find((x) => x.worker_id === workers[1].id).status, 'attendance can be cleared');

  // --- smart suggestions ---
  r = await call(owner, 'GET', '/suggestions');
  check(r.status === 200 && r.data.suggestions.length > 0, 'suggestions are produced from history', r.data.suggestions?.length);
  check(r.data.suggestions.some((s) => /Lettuce/i.test(s.title + s.detail)), 'lettuce season is learned');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Scenario test crashed:', e); process.exit(1); });
