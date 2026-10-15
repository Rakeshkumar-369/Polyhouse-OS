// npm run seed        -> creates the super admin (from .env)
// npm run demo        -> also creates demo org "XYZ Polyhouse" with ~60 days of sample data
require('./env');
const bcrypt = require('bcryptjs');
const { q, one, pool } = require('./db');
const { createOrg } = require('./orgService');
const { ensureSchema } = require('./migrate');

const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 10) / 10;

async function ins(table, row) { const r = await q(`INSERT INTO ${table} SET ?`, [row]); return r.insertId; }

(async () => {
  await ensureSchema();
  if (!process.argv.includes('--demo')) return;
  if (await one("SELECT id FROM users WHERE login='xyz'")) { console.log('Demo org already exists (login xyz / xyz123)'); return; }

  const o = await createOrg({ name: 'XYZ Polyhouse', company_name: 'XYZ Agro Farms', customer_type: 'multi_polyhouse', owner_name: 'XYZ Owner',
    phone: '9000000001', district: 'Rangareddy', state: 'Telangana', admin_login: 'xyz', admin_password: 'xyz123' });
  await q('UPDATE organizations SET settings=JSON_SET(settings, "$.books_start", ?, "$.opening_cash", 200000, "$.setup_done", true) WHERE id=?', [day(70), o]);

  const f1 = await ins('farms', { org_id: o, name: 'Polyhouse 1 - Shankarpally', type: 'polyhouse', location: 'Shankarpally', district: 'Rangareddy', area_acres: 1, length_m: 80, width_m: 50, height_m: 6.5, ownership: 'leased', monthly_rent: 15000, structure_date: '2023-06-01', polyfilm_date: '2023-06-01', water_source: 'Borewell', power_connection: 'Agri 3-phase' });
  const f2 = await ins('farms', { org_id: o, name: 'Polyhouse 2 - Chevella', type: 'polyhouse', location: 'Chevella', district: 'Rangareddy', area_acres: 0.5, length_m: 50, width_m: 40, height_m: 6, ownership: 'owned', structure_date: '2024-01-15', polyfilm_date: '2024-01-15' });
  const bays = [];
  for (const [f, n] of [[f1, 4], [f2, 2]]) for (let i = 1; i <= n; i++) bays.push({ id: await ins('bays', { org_id: o, farm_id: f, name: `Bay ${i}`, area_sqm: 1000 }), farm: f });

  const crops = {};
  for (const [name, variety, price, color] of [['Capsicum', 'Red', 90, '#dc2626'], ['Capsicum', 'Yellow', 95, '#eab308'], ['Cucumber', 'English', 35, '#16a34a'], ['Tomato', 'Cherry', 70, '#f97316']]) {
    crops[`${name} ${variety}`] = await ins('crops', { org_id: o, name: name === 'Capsicum' ? `Capsicum ${variety}` : name, variety, unit: 'kg', default_price: price, color, target_yield_per_sqm: 10 });
  }
  const cIds = Object.values(crops);
  const cycles = [];
  for (let i = 0; i < 4; i++) cycles.push(await ins('crop_cycles', { org_id: o, farm_id: bays[i].farm, bay_id: bays[i].id, crop_id: cIds[i], name: `${Object.keys(crops)[i]} 2026`, transplant_date: day(140), plants: 2500, area_sqm: 1000, harvest_start: day(70), target_yield_kg: 9000, status: 'harvesting' }));

  const buyers = [];
  for (const [name, kind, cd] of [['FreshMart Retail', 'retail chain', 15], ['Hotel Grand Deccan', 'hotel / caterer', 30], ['Bowenpally Agent - Ramesh', 'wholesaler / mandi', 0], ['Green Basket B2B', 'aggregator', 7]]) {
    buyers.push(await ins('parties', { org_id: o, name, type: 'buyer', buyer_kind: kind, phone: '98' + Math.floor(10000000 + Math.random() * 89999999), credit_days: cd }));
  }
  const sup = await ins('parties', { org_id: o, name: 'Sri Sai Agro Inputs', type: 'supplier', buyer_kind: 'input dealer', phone: '9876500000' });
  const mult = [1.1, 1.2, 0.85, 1.0];
  for (const [bi, b] of buyers.entries()) for (const c of cIds) {
    const base = (await one('SELECT default_price p FROM crops WHERE id=?', [c])).p;
    await ins('price_list', { org_id: o, party_id: b, crop_id: c, grade: 'A', price: Math.round(base * mult[bi]), effective_from: day(90) });
    await ins('price_list', { org_id: o, party_id: b, crop_id: c, grade: 'B', price: Math.round(base * mult[bi] * 0.75), effective_from: day(90) });
  }
  const cat = async (kind, name) => (await one('SELECT id FROM expense_categories WHERE org_id=? AND name LIKE ?', [o, name + '%'])).id;

  const workers = [];
  for (const [name, pay, wage] of [['Lakshmi', 'daily', 450], ['Ramu', 'daily', 500], ['Saritha', 'piece', 0], ['Venkatesh', 'monthly', 0], ['Mallesh', 'daily', 450]]) {
    workers.push(await ins('workers', { org_id: o, name, pay_type: pay, daily_wage: wage, monthly_salary: pay === 'monthly' ? 18000 : 0, piece_rate: pay === 'piece' ? 4 : 0, skill: pay === 'monthly' ? 'supervisor' : 'picker', farm_id: f1, joining_date: day(200) }));
  }
  const items = {};
  for (const [name, unit, re, c] of [['Calcium nitrate', 'kg', 25, 'Fertiliser'], ['Grow bags', 'nos', 200, 'Grow bags'], ['Seedling trays', 'nos', 50, 'Trays'], ['Trellis thread', 'roll', 5, 'Threads']]) {
    items[name] = await ins('inventory_items', { org_id: o, name, unit, reorder_level: re, category_id: await cat('input', c) });
  }
  await ins('fertigation_recipes', { org_id: o, crop_id: cIds[0], stage: 'Fruiting', ec_min: 1.8, ec_max: 2.4, ph_min: 5.8, ph_max: 6.4, recipe: 'Calcium nitrate 60 kg, 13-0-45 40 kg, MgSO4 25 kg per 1000 L stock' });

  const loanId = await ins('loans', { org_id: o, lender: 'SBI Agri Term Loan', principal: 1500000, interest_rate: 9, start_date: '2023-06-01', tenure_months: 84, emi: 24100 });
  await ins('other_income', { org_id: o, date: day(40), source: 'MIDH subsidy instalment', farm_id: f1, amount: 150000 });
  for (let n = 60; n >= 0; n--) {
    const d = day(n);
    // harvest + sales
    for (const [i, c] of cIds.entries()) {
      const qty = rnd(40, 120) * (i === 2 ? 2 : 1);
      await ins('harvests', { org_id: o, date: d, farm_id: bays[i].farm, bay_id: bays[i].id, crop_cycle_id: cycles[i], crop_id: c, grade: 'A', quantity: qty, culls: rnd(1, 5), worker_id: workers[2] });
      const bq = rnd(10, 30);
      await ins('harvests', { org_id: o, date: d, farm_id: bays[i].farm, bay_id: bays[i].id, crop_cycle_id: cycles[i], crop_id: c, grade: 'B', quantity: bq, culls: 0 });
      const bRate = (await one("SELECT price FROM price_list WHERE party_id=? AND crop_id=? AND grade='B'", [buyers[2], c])).price;
      const bSold = Math.round(bq * 0.9 * 10) / 10;
      await ins('sales', { org_id: o, date: d, party_id: buyers[2], crop_id: c, grade: 'B', farm_id: bays[i].farm, quantity: bSold, rejected_qty: 0, rate: bRate, amount: Math.round(bSold * bRate * 100) / 100, status: 'accepted', delivered_by: 1 });
      let left = qty;
      for (const [bi, b] of buyers.entries()) {
        if (Math.random() < 0.15 || left < 5) continue;
        const sq = Math.min(left, bi === 3 ? left : rnd(15, 45)); left -= sq;
        const rate = (await one("SELECT price FROM price_list WHERE party_id=? AND crop_id=? AND grade='A'", [b, c])).price;
        const rej = bi === 0 && Math.random() < 0.3 ? rnd(0.5, 3) : 0;
        await ins('sales', { org_id: o, date: d, party_id: b, crop_id: c, grade: 'A', farm_id: bays[i].farm, quantity: sq, rejected_qty: rej, rate, amount: Math.round((sq - rej) * rate * 100) / 100, status: n > 2 ? 'accepted' : 'delivered', delivered_by: 1 });
      }
    }
    // attendance
    for (const w of workers) await ins('attendance', { org_id: o, worker_id: w, date: d, status: Math.random() < 0.9 ? 'present' : 'absent', farm_id: f1 });
    // logs
    await ins('fertigation_logs', { org_id: o, date: d, farm_id: f1, bay_id: bays[0].id, crop_cycle_id: cycles[0], feed_ec: rnd(1.7, 2.3), feed_ph: rnd(5.8, 6.4), drain_ec: rnd(2.0, 2.8), drain_ph: rnd(6, 6.8), water_litres: 4000 });
    await ins('climate_logs', { org_id: o, date: d, time: '13:00:00', farm_id: f1, temperature: rnd(24, 31), humidity: rnd(55, 85) });
    if (n % 3 === 0) await ins('scouting_logs', { org_id: o, date: d, farm_id: f1, bay_id: bays[n % 4].id, pest: ['Thrips', 'Whitefly', 'Mites'][n % 3], trap_count: Math.floor(rnd(10, 70)), severity: 'low' });
    if (n % 6 === 0) {
      const amt = rnd(8000, 20000);
      await ins('expenses', { org_id: o, date: d, category_id: await cat('input', 'Fertiliser'), description: 'Fertiliser purchase', farm_id: f1, party_id: sup, amount: amt, payment_mode: 'upi' });
    }
    if (n % 7 === 0) {
      // weekly payment from buyers
      for (const b of buyers) {
        const due = await one('SELECT COALESCE(SUM(amount),0) s FROM sales WHERE party_id=? AND date<=?', [b, d]);
        const paid = await one('SELECT COALESCE(SUM(amount),0) s FROM payments_received WHERE party_id=?', [b]);
        const bal = due.s - paid.s;
        if (bal > 1000 && b !== buyers[1]) await ins('payments_received', { org_id: o, date: d, party_id: b, amount: Math.round(bal * 0.8), mode: 'upi' });
      }
      await ins('expenses', { org_id: o, date: d, category_id: await cat('transport', 'Transport'), description: 'Tempo hire', amount: 3500, payment_mode: 'cash' });
      // weekly wage payment for daily / piece workers (also posted to Expenses as labour)
      if (n > 0) {
        const from = day(n + 6);
        for (const w of workers) {
          const wk = await one('SELECT * FROM workers WHERE id=?', [w]);
          if (wk.pay_type === 'monthly') continue;
          const days = (await one("SELECT COUNT(*) c FROM attendance WHERE worker_id=? AND date BETWEEN ? AND ? AND status='present'", [w, from, d])).c;
          const kg = (await one('SELECT COALESCE(SUM(quantity),0) k FROM harvests WHERE worker_id=? AND date BETWEEN ? AND ?', [w, from, d])).k;
          const gross = wk.pay_type === 'piece' ? Math.round(kg * wk.piece_rate) : days * wk.daily_wage;
          if (!gross) continue;
          const wp = await ins('wage_payments', { org_id: o, worker_id: w, date: d, period_start: from, period_end: d, days_worked: days, gross, bonus: 0, deductions: 0, net_paid: gross, mode: 'cash', notes: 'Weekly wages' });
          await ins('expenses', { org_id: o, date: d, category_id: await cat('labour', 'Labour wages'), description: `Wages: ${wk.name}`, farm_id: f1, amount: gross, payment_mode: 'cash', wage_payment_id: wp });
        }
      }
    }
    if (n % 30 === 5) {
      // monthly salary for the supervisor + loan EMI (interest part is an expense)
      await ins('expenses', { org_id: o, date: d, category_id: await cat('labour', 'Labour wages'), description: 'Salary: Venkatesh (supervisor)', farm_id: f1, amount: 18000, payment_mode: 'bank' });
      const lr = await ins('loan_repayments', { org_id: o, loan_id: loanId, date: d, amount: 24100, interest_part: 9800, notes: 'EMI' });
      await ins('expenses', { org_id: o, date: d, category_id: await cat('interest', 'Loan interest'), description: 'Interest: SBI Agri Term Loan', amount: 9800, payment_mode: 'bank', loan_repayment_id: lr });
    }
  }
  // purchases into stock
  const purchase = async (item, qty, rate, c) => {
    const e = await ins('expenses', { org_id: o, date: day(30), category_id: await cat('input', c), description: 'Purchase', item_id: items[item], quantity: qty, rate, amount: qty * rate, party_id: sup, payment_mode: 'credit', paid_amount: qty * rate * 0.5 });
    await ins('stock_moves', { org_id: o, item_id: items[item], date: day(30), type: 'in', quantity: qty, rate, expense_id: e, notes: 'Purchase' });
  };
  await purchase('Calcium nitrate', 100, 65, 'Fertiliser'); await purchase('Grow bags', 1000, 12, 'Grow bags'); await purchase('Seedling trays', 100, 30, 'Trays'); await purchase('Trellis thread', 10, 450, 'Threads');
  await ins('stock_moves', { org_id: o, item_id: items['Calcium nitrate'], date: day(5), type: 'out', quantity: 85, farm_id: f1 });

  await ins('recurring_expenses', { org_id: o, name: 'Land rent - Polyhouse 1', category_id: await cat('rent', 'Land rent'), farm_id: f1, amount: 15000, frequency: 'monthly', next_due: day(65) });
  await ins('recurring_expenses', { org_id: o, name: 'Electricity bill', category_id: await cat('utility', 'Electricity'), amount: 6500, frequency: 'monthly', next_due: day(55) });
  await ins('advances', { org_id: o, worker_id: workers[0], date: day(10), type: 'advance', amount: 2000, notes: 'Festival advance' });
  await ins('assets', { org_id: o, farm_id: f1, name: 'Polyhouse structure', type: 'structure', purchase_date: '2023-06-01', cost: 3000000, life_years: 15, salvage_value: 300000 });
  await ins('assets', { org_id: o, farm_id: f1, name: 'UV polyfilm 200 micron', type: 'polyfilm', purchase_date: '2023-06-01', cost: 600000, life_years: 3.5 });
  await ins('assets', { org_id: o, farm_id: f1, name: 'Drip & fertigation unit', type: 'drip system', purchase_date: '2023-06-01', cost: 350000, life_years: 7, next_service: day(-20) });
  await ins('spray_logs', { org_id: o, date: day(1), farm_id: f2, bay_id: bays[4].id, product: 'Spinosad 45% SC', dose: '0.3 ml/L', target_pest: 'Thrips', phi_days: 3 });
  await ins('orders', { org_id: o, date: day(-1), party_id: buyers[1], crop_id: cIds[0], grade: 'A', quantity: 40, status: 'open', notes: 'Wedding function' });
  await ins('tasks', { org_id: o, date: day(0), farm_id: f1, bay_id: bays[1].id, title: 'De-leafing in Bay 2', task_type: 'de-leafing', worker_id: workers[0] });
  await ins('tasks', { org_id: o, date: day(0), farm_id: f1, title: 'Clean disc filters', task_type: 'cleaning', worker_id: workers[1] });

  const hash = await bcrypt.hash('demo123', 10);
  await q("INSERT INTO users (org_id,name,login,password_hash,role) VALUES (?,?,?,?,'supervisor'),(?,?,?,?,'delivery')", [o, 'Venkatesh (Supervisor)', 'super1', hash, o, 'Raju (Delivery)', 'delivery1', hash]);
  await q("INSERT INTO users (org_id,name,login,password_hash,role,party_id) VALUES (?,?,?,?,'vendor',?)", [o, 'FreshMart Retail', 'vendor1', hash, buyers[0]]);
  await q("INSERT INTO users (org_id,name,login,password_hash,role,worker_id) VALUES (?,?,?,?,'labour',?)", [o, 'Lakshmi', 'labour1', hash, workers[0]]);
  await q("INSERT INTO demo_requests (name,phone,farm_type,acres,location,message) VALUES ('Srinivas Reddy','9849012345','single_polyhouse','1','Moinabad','Grow capsicum, want to track sales to 3 vendors'),('Kisan FPO Shadnagar','9000012345','fpo','120','Shadnagar','400 farmer members, need member-wise reports')");
  console.log('Demo org created. Logins: xyz/xyz123 (admin), super1, delivery1, vendor1, labour1 (password demo123)');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
