// =====================================================================
// RESOURCE REGISTRY - the single source of truth for every simple
// "list / add / edit / delete" screen in the app.
//
// Each resource describes:
//   table   - MySQL table
//   module  - module key (config.js) that must be ON, null = always on
//   read / write - roles allowed
//   dateField - column used by ?from=&to= period filter
//   label   - SQL expression ({a} = table alias) used for dropdown options
//   fields  - columns the API accepts + UI metadata the React client uses
//             to build forms & tables automatically (see client/src/components/ResourcePage.jsx)
//   hooks   - before(data, ctx) / after(id, data, ctx, op) business rules
//
// Field types: text | number | date | time | select | ref | textarea | bool | file | color
//   ref: 'farms'  -> dropdown of another resource, list shows its label
//   list: true    -> shown as a column / on the mobile card
//   default: 'today' -> pre-filled with today's date
// To add a new field: add the column in schema.sql (ALTER TABLE on live DB) and a line here.
// =====================================================================
const { q, one } = require('./db');
const { STAFF, MANAGERS, FIELD } = require('./config');

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const GRADES = ['A', 'B', 'C', 'Mixed'];
const PAY_MODES = ['cash', 'upi', 'bank', 'cheque', 'credit'];

// ---------- business rule helpers used by hooks ----------

// Price for vendor+crop+grade on a date (latest effective_from <= date). Falls back to crop default price.
async function lookupPrice(orgId, partyId, cropId, grade, date) {
  const p = await one(
    `SELECT price FROM price_list WHERE org_id=? AND party_id=? AND crop_id=? AND (grade=? OR grade='Mixed')
     AND effective_from<=? ORDER BY (grade=?) DESC, effective_from DESC LIMIT 1`,
    [orgId, partyId, cropId, grade || 'A', date || today(), grade || 'A']);
  if (p) return { price: p.price, source: 'vendor price list' };
  const c = await one('SELECT default_price FROM crops WHERE org_id=? AND id=?', [orgId, cropId]);
  return { price: c ? c.default_price : 0, source: 'crop default price' };
}

// Active spray locks (bay/farm still inside pre-harvest interval) on a date
async function activeLocks(orgId, date) {
  return q(
    `SELECT s.*, f.name farm_name, b.name bay_name, DATE_ADD(s.date, INTERVAL s.phi_days DAY) AS lock_until
     FROM spray_logs s LEFT JOIN farms f ON f.id=s.farm_id LEFT JOIN bays b ON b.id=s.bay_id
     WHERE s.org_id=? AND s.phi_days>0 AND s.date<=? AND DATE_ADD(s.date, INTERVAL s.phi_days DAY) > ?`,
    [orgId, date, date]);
}

async function categoryId(orgId, kind, fallbackName) {
  let c = await one('SELECT id FROM expense_categories WHERE org_id=? AND kind=? ORDER BY id LIMIT 1', [orgId, kind]);
  if (!c) {
    const r = await q('INSERT INTO expense_categories (org_id,name,kind) VALUES (?,?,?)', [orgId, fallbackName, kind]);
    return r.insertId;
  }
  return c.id;
}

// Keeps one linked row in `expenses` in sync with a source row (wage payment, loan repayment)
async function syncLinkedExpense(orgId, linkCol, linkId, exp) {
  await q(`DELETE FROM expenses WHERE org_id=? AND ${linkCol}=?`, [orgId, linkId]);
  if (exp && exp.amount > 0) {
    await q(`INSERT INTO expenses (org_id,date,category_id,description,farm_id,amount,payment_mode,${linkCol}) VALUES (?,?,?,?,?,?,?,?)`,
      [orgId, exp.date, exp.category_id, exp.description, exp.farm_id || null, exp.amount, exp.mode || 'cash', linkId]);
  }
}

// ---------- the registry ----------
const R = {
  farms: {
    title: 'Farms / Polyhouses', table: 'farms', module: null, read: STAFF, write: MANAGERS,
    label: '{a}.name', order: 'name',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, list: true },
      { name: 'type', label: 'Type', type: 'select', options: ['polyhouse', 'net_house', 'open_field', 'nursery', 'other'], default: 'polyhouse', list: true },
      { name: 'member_name', label: 'Member / land owner (FPO)', type: 'text' },
      { name: 'location', label: 'Location / village', type: 'text', list: true },
      { name: 'district', label: 'District', type: 'text' },
      { name: 'area_acres', label: 'Area (acres)', type: 'number', list: true },
      { name: 'length_m', label: 'Length (m)', type: 'number' },
      { name: 'width_m', label: 'Width (m)', type: 'number' },
      { name: 'height_m', label: 'Height (m)', type: 'number' },
      { name: 'ownership', label: 'Ownership', type: 'select', options: ['owned', 'leased'], default: 'owned' },
      { name: 'monthly_rent', label: 'Monthly rent', type: 'number', list: true },
      { name: 'lease_end', label: 'Lease ends on', type: 'date' },
      { name: 'structure_date', label: 'Structure built on', type: 'date' },
      { name: 'polyfilm_date', label: 'Polyfilm installed on', type: 'date' },
      { name: 'water_source', label: 'Water source', type: 'text' },
      { name: 'power_connection', label: 'Power connection', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      { name: 'active', label: 'Active', type: 'bool', default: 1 },
    ],
  },
  bays: {
    title: 'Bays / Plots', table: 'bays', module: null, read: STAFF, write: MANAGERS,
    label: "CONCAT({a}.name)", order: 'farm_id, name', filters: ['farm_id'],
    fields: [
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', required: true, list: true },
      { name: 'name', label: 'Bay / plot name', type: 'text', required: true, list: true },
      { name: 'area_sqm', label: 'Area (sq m)', type: 'number', list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  crops: {
    title: 'Crops', table: 'crops', module: null, read: STAFF.concat(['vendor']), write: MANAGERS,
    label: "CONCAT({a}.name, IF({a}.variety IS NULL OR {a}.variety='', '', CONCAT(' (', {a}.variety, ')')))", order: 'name',
    fields: [
      { name: 'name', label: 'Crop', type: 'text', required: true, list: true },
      { name: 'variety', label: 'Variety', type: 'text', list: true },
      { name: 'unit', label: 'Unit', type: 'select', options: ['kg', 'bunch', 'piece', 'crate', 'dozen', 'quintal', 'tonne'], default: 'kg', list: true },
      { name: 'default_price', label: 'Default price / unit', type: 'number', list: true, help: 'Used when a vendor has no special price' },
      { name: 'target_yield_per_sqm', label: 'Target yield / sq m (season)', type: 'number' },
      { name: 'color', label: 'Colour in charts', type: 'color', default: '#16a34a' },
      { name: 'active', label: 'Active', type: 'bool', default: 1 },
    ],
  },
  crop_cycles: {
    title: 'Crop cycles', table: 'crop_cycles', module: 'crop_cycles', read: STAFF, write: FIELD,
    label: "CONCAT(COALESCE({a}.name, CONCAT('Cycle #', {a}.id)), ' - ', {a}.status)", order: 'transplant_date DESC', dateField: 'transplant_date',
    filters: ['farm_id', 'crop_id', 'status'],
    fields: [
      { name: 'name', label: 'Cycle name', type: 'text', list: true, help: 'e.g. Capsicum Kharif 2026' },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', required: true, list: true },
      { name: 'bay_id', label: 'Bay', type: 'ref', ref: 'bays', dependsOn: 'farm_id' },
      { name: 'crop_id', label: 'Crop', type: 'ref', ref: 'crops', required: true, list: true },
      { name: 'seed_lot', label: 'Seed lot', type: 'text' },
      { name: 'nursery_date', label: 'Nursery date', type: 'date' },
      { name: 'transplant_date', label: 'Transplant date', type: 'date', list: true },
      { name: 'plants', label: 'No. of plants', type: 'number' },
      { name: 'area_sqm', label: 'Area (sq m)', type: 'number', help: 'Used to split shared costs (area x days)' },
      { name: 'harvest_start', label: 'Harvest from', type: 'date' },
      { name: 'harvest_end', label: 'Harvest to', type: 'date' },
      { name: 'target_yield_kg', label: 'Target yield (kg)', type: 'number', list: true },
      { name: 'budget', label: 'Budget', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['planned', 'growing', 'harvesting', 'closed'], default: 'growing', list: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  parties: {
    title: 'Vendors', table: 'parties', module: null, read: STAFF, write: MANAGERS,
    label: '{a}.name', order: 'name', filters: ['type'],
    fields: [
      { name: 'name', label: 'Vendor name', type: 'text', required: true, list: true },
      { name: 'type', label: 'Vendor type', type: 'select', options: ['buyer', 'supplier', 'both'], default: 'buyer', list: true, help: 'Buyer = buys produce, Supplier = sells inputs' },
      { name: 'buyer_kind', label: 'Business kind', type: 'select', options: ['retail chain', 'hotel / caterer', 'aggregator', 'exporter', 'wholesaler / mandi', 'local shop', 'input dealer', 'nursery', 'other'] },
      { name: 'contact_person', label: 'Contact person', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text', list: true },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'address', label: 'Address', type: 'text' },
      { name: 'gstin', label: 'GSTIN', type: 'text' },
      { name: 'credit_days', label: 'Credit days', type: 'number', default: 0, list: true },
      { name: 'opening_balance', label: 'Opening balance (they owe us)', type: 'number', default: 0 },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      { name: 'active', label: 'Active', type: 'bool', default: 1 },
    ],
  },
  price_list: {
    title: 'Vendor price list', table: 'price_list', module: 'sales', read: STAFF, write: MANAGERS,
    label: "CONCAT({a}.grade, ' @ ', {a}.price)", order: 'party_id, crop_id, effective_from DESC', dateField: 'effective_from',
    filters: ['party_id', 'crop_id'],
    fields: [
      { name: 'party_id', label: 'Vendor', type: 'ref', ref: 'parties', required: true, list: true },
      { name: 'crop_id', label: 'Crop', type: 'ref', ref: 'crops', required: true, list: true },
      { name: 'grade', label: 'Grade', type: 'select', options: GRADES, default: 'A', list: true },
      { name: 'price', label: 'Price / unit', type: 'number', required: true, list: true },
      { name: 'effective_from', label: 'Effective from', type: 'date', default: 'today', required: true, list: true },
    ],
  },
  harvests: {
    title: 'Harvest', table: 'harvests', module: 'harvest', read: STAFF, write: FIELD.concat(['delivery']),
    label: "CONCAT({a}.date, ' ', {a}.quantity)", order: 'date DESC, id DESC', dateField: 'date',
    filters: ['farm_id', 'crop_id', 'bay_id', 'crop_cycle_id'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'crop_id', label: 'Crop', type: 'ref', ref: 'crops', required: true, list: true },
      { name: 'grade', label: 'Grade', type: 'select', options: GRADES, default: 'A', list: true },
      { name: 'quantity', label: 'Quantity plucked', type: 'number', required: true, list: true },
      { name: 'culls', label: 'Culls / wastage', type: 'number', default: 0 },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', list: true },
      { name: 'bay_id', label: 'Bay', type: 'ref', ref: 'bays', dependsOn: 'farm_id' },
      { name: 'crop_cycle_id', label: 'Crop cycle', type: 'ref', ref: 'crop_cycles', module: 'crop_cycles' },
      { name: 'worker_id', label: 'Picked by', type: 'ref', ref: 'workers', module: 'labour', help: 'Needed for piece-rate wages' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
    hooks: {
      async before(d, ctx) {
        if (ctx.op === 'create') d.created_by = ctx.user.id;
        if (ctx.org.settings.modules.scouting === false || !d.farm_id) return;
        const locks = (await activeLocks(ctx.org.id, d.date)).filter((l) => l.farm_id == d.farm_id && (!l.bay_id || !d.bay_id || l.bay_id == d.bay_id));
        if (locks.length && !(ctx.body.override_lock && MANAGERS.includes(ctx.user.role))) {
          const l = locks[0];
          throw Object.assign(new Error(`Harvest locked: ${l.farm_name}${l.bay_name ? ' / ' + l.bay_name : ''} sprayed with ${l.product} on ${l.date}, safe after ${l.lock_until}`), { status: 409 });
        }
      },
    },
  },
  orders: {
    title: 'Vendor orders', table: 'orders', module: 'orders', read: STAFF, write: STAFF,
    label: "CONCAT('#', {a}.id, ' ', {a}.quantity, ' ', {a}.grade)", order: 'date DESC, id DESC', dateField: 'date',
    filters: ['party_id', 'crop_id', 'status'],
    fields: [
      { name: 'date', label: 'Needed on', type: 'date', default: 'today', required: true, list: true },
      { name: 'party_id', label: 'Vendor', type: 'ref', ref: 'parties', required: true, list: true },
      { name: 'crop_id', label: 'Crop', type: 'ref', ref: 'crops', required: true, list: true },
      { name: 'grade', label: 'Grade', type: 'select', options: GRADES, default: 'A', list: true },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, list: true },
      { name: 'status', label: 'Status', type: 'select', options: ['open', 'fulfilled', 'cancelled'], default: 'open', list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
    hooks: { async before(d, ctx) { if (ctx.op === 'create') d.created_by = ctx.user.id; } },
  },
  sales: {
    title: 'Sales / deliveries', table: 'sales', module: 'sales', read: STAFF, write: STAFF,
    label: "CONCAT('Sale #', {a}.id)", order: 'date DESC, id DESC', dateField: 'date',
    filters: ['party_id', 'crop_id', 'farm_id', 'status', 'delivered_by'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'party_id', label: 'Vendor', type: 'ref', ref: 'parties', required: true, list: true },
      { name: 'crop_id', label: 'Crop', type: 'ref', ref: 'crops', required: true, list: true },
      { name: 'grade', label: 'Grade', type: 'select', options: GRADES, default: 'A', list: true },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, list: true },
      { name: 'rate', label: 'Rate / unit', type: 'number', list: true, help: 'Leave blank to use the vendor price list' },
      { name: 'rejected_qty', label: 'Rejected qty', type: 'number', default: 0 },
      { name: 'amount', label: 'Amount', type: 'number', readonly: true, list: true },
      { name: 'farm_id', label: 'From farm', type: 'ref', ref: 'farms' },
      { name: 'order_id', label: 'Against order', type: 'ref', ref: 'orders', module: 'orders' },
      { name: 'invoice_no', label: 'Invoice / slip no.', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['delivered', 'accepted', 'disputed'], default: 'delivered', list: true },
      { name: 'vendor_note', label: 'Vendor remark', type: 'text', readonly: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
    hooks: {
      async before(d, ctx) {
        if (ctx.op === 'create') d.delivered_by = ctx.user.id;
        if (d.rate === undefined && ctx.existing) d.rate = ctx.existing.rate;
        if (d.rate === null || d.rate === undefined || d.rate === '' || Number(d.rate) === 0) {
          const cur = ctx.existing || {};
          const p = await lookupPrice(ctx.org.id, d.party_id ?? cur.party_id, d.crop_id ?? cur.crop_id, d.grade ?? cur.grade, d.date ?? cur.date);
          d.rate = p.price;
        }
        const qty = Number(d.quantity ?? ctx.existing?.quantity ?? 0);
        const rej = Number(d.rejected_qty ?? ctx.existing?.rejected_qty ?? 0);
        d.amount = Math.round((qty - rej) * Number(d.rate) * 100) / 100;
      },
      async after(id, d, ctx) {
        if (d.order_id) await q("UPDATE orders SET status='fulfilled' WHERE org_id=? AND id=?", [ctx.org.id, d.order_id]);
      },
    },
  },
  payments_received: {
    title: 'Payments received', table: 'payments_received', module: 'sales', read: MANAGERS, write: MANAGERS,
    label: "CONCAT({a}.date, ' ', {a}.amount)", order: 'date DESC, id DESC', dateField: 'date', filters: ['party_id', 'mode'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'party_id', label: 'Vendor', type: 'ref', ref: 'parties', required: true, list: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true, list: true },
      { name: 'mode', label: 'Mode', type: 'select', options: PAY_MODES.filter((m) => m !== 'credit'), default: 'cash', list: true },
      { name: 'reference', label: 'Reference / UTR', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  other_income: {
    title: 'Other income', table: 'other_income', module: 'other_income', read: MANAGERS, write: MANAGERS,
    label: '{a}.source', order: 'date DESC', dateField: 'date', filters: ['farm_id'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'source', label: 'Source', type: 'text', required: true, list: true, help: 'Subsidy, scrap sale, nursery plants ...' },
      { name: 'amount', label: 'Amount', type: 'number', required: true, list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  expense_categories: {
    title: 'Expense categories', table: 'expense_categories', module: null, read: STAFF, write: MANAGERS,
    label: '{a}.name', order: 'name',
    fields: [
      { name: 'name', label: 'Category', type: 'text', required: true, list: true },
      { name: 'kind', label: 'Kind', type: 'select', options: ['input', 'labour', 'rent', 'utility', 'transport', 'packaging', 'repair', 'interest', 'other'], default: 'other', list: true },
    ],
  },
  inventory_items: {
    title: 'Input items', table: 'inventory_items', module: 'inventory', read: STAFF, write: FIELD,
    label: "CONCAT({a}.name, ' (', {a}.unit, ')')", order: 'name',
    select: `(SELECT {a}.opening_stock + COALESCE(SUM(CASE WHEN m.type='out' THEN -m.quantity ELSE m.quantity END),0) FROM stock_moves m WHERE m.item_id={a}.id) AS current_stock`,
    fields: [
      { name: 'name', label: 'Item', type: 'text', required: true, list: true, help: 'Seeds, trays, grow bags, calcium nitrate ...' },
      { name: 'category_id', label: 'Category', type: 'ref', ref: 'expense_categories', list: true },
      { name: 'unit', label: 'Unit', type: 'select', options: ['nos', 'kg', 'g', 'litre', 'ml', 'packet', 'bag', 'roll', 'metre', 'bundle'], default: 'nos', list: true },
      { name: 'opening_stock', label: 'Opening stock', type: 'number', default: 0 },
      { name: 'reorder_level', label: 'Alert when stock below', type: 'number', default: 0, list: true },
      { name: 'current_stock', label: 'In stock now', type: 'number', readonly: true, virtual: true, list: true },
    ],
  },
  stock_moves: {
    title: 'Stock in / out', table: 'stock_moves', module: 'inventory', read: STAFF, write: FIELD,
    label: "CONCAT({a}.type, ' ', {a}.quantity)", order: 'date DESC, id DESC', dateField: 'date', filters: ['item_id', 'type', 'farm_id'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'item_id', label: 'Item', type: 'ref', ref: 'inventory_items', required: true, list: true },
      { name: 'type', label: 'Movement', type: 'select', options: ['out', 'in', 'adjust'], default: 'out', list: true, help: 'Purchases come in automatically from Expenses' },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, list: true },
      { name: 'farm_id', label: 'Used at farm', type: 'ref', ref: 'farms', list: true },
      { name: 'crop_cycle_id', label: 'Crop cycle', type: 'ref', ref: 'crop_cycles', module: 'crop_cycles' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  expenses: {
    title: 'Expenses & purchases', table: 'expenses', module: 'expenses', read: MANAGERS, write: MANAGERS.concat(['supervisor']),
    label: "CONCAT({a}.date, ' ', {a}.amount)", order: 'date DESC, id DESC', dateField: 'date',
    filters: ['category_id', 'farm_id', 'party_id', 'crop_cycle_id'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'category_id', label: 'Category', type: 'ref', ref: 'expense_categories', required: true, list: true },
      { name: 'description', label: 'What for', type: 'text', list: true },
      { name: 'item_id', label: 'Stock item (adds to stock)', type: 'ref', ref: 'inventory_items', module: 'inventory' },
      { name: 'quantity', label: 'Quantity', type: 'number' },
      { name: 'rate', label: 'Rate', type: 'number' },
      { name: 'amount', label: 'Amount', type: 'number', list: true, help: 'Auto = quantity x rate when blank' },
      { name: 'paid_amount', label: 'Paid now (blank = fully paid)', type: 'number' },
      { name: 'payment_mode', label: 'Paid by', type: 'select', options: PAY_MODES, default: 'cash' },
      { name: 'party_id', label: 'Supplier / paid to', type: 'ref', ref: 'parties', list: true },
      { name: 'farm_id', label: 'Farm (blank = shared)', type: 'ref', ref: 'farms', list: true },
      { name: 'crop_cycle_id', label: 'Crop cycle (direct cost)', type: 'ref', ref: 'crop_cycles', module: 'crop_cycles' },
      { name: 'bill_no', label: 'Bill no.', type: 'text' },
      { name: 'bill_file', label: 'Bill photo', type: 'file' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
    hooks: {
      async before(d, ctx) {
        if (ctx.op === 'create') d.created_by = ctx.user.id;
        if ((d.amount === null || d.amount === undefined || d.amount === '') && d.quantity && d.rate) d.amount = Number(d.quantity) * Number(d.rate);
        if (ctx.op === 'create' && (d.amount === null || d.amount === undefined || d.amount === '')) throw Object.assign(new Error('Enter amount (or quantity and rate)'), { status: 400 });
      },
      async after(id, d, ctx, op) {
        await q('DELETE FROM stock_moves WHERE org_id=? AND expense_id=?', [ctx.org.id, id]);
        if (op === 'delete') return;
        const e = await one('SELECT * FROM expenses WHERE id=?', [id]);
        if (e.item_id && e.quantity > 0) {
          await q("INSERT INTO stock_moves (org_id,item_id,date,type,quantity,rate,farm_id,crop_cycle_id,expense_id,notes) VALUES (?,?,?,'in',?,?,?,?,?,?)",
            [ctx.org.id, e.item_id, e.date, e.quantity, e.rate || (e.amount / e.quantity), e.farm_id, e.crop_cycle_id, id, 'Purchase']);
        }
      },
    },
  },
  recurring_expenses: {
    title: 'Recurring payments', table: 'recurring_expenses', module: 'recurring', read: MANAGERS, write: MANAGERS,
    label: '{a}.name', order: 'next_due',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, list: true, help: 'Land rent, Current bill, Supervisor salary, EMI ...' },
      { name: 'category_id', label: 'Category', type: 'ref', ref: 'expense_categories', required: true, list: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true, list: true },
      { name: 'frequency', label: 'Repeats', type: 'select', options: ['weekly', 'monthly', 'quarterly', 'yearly'], default: 'monthly', list: true },
      { name: 'next_due', label: 'Next due on', type: 'date', default: 'today', required: true, list: true },
      { name: 'farm_id', label: 'Farm (blank = shared)', type: 'ref', ref: 'farms' },
      { name: 'party_id', label: 'Paid to', type: 'ref', ref: 'parties' },
      { name: 'auto_post', label: 'Post to expenses automatically when due', type: 'bool', default: 1 },
      { name: 'active', label: 'Active', type: 'bool', default: 1 },
    ],
  },
  workers: {
    title: 'Workers', table: 'workers', module: 'labour', read: FIELD, write: MANAGERS,
    label: '{a}.name', order: 'name', filters: ['farm_id', 'pay_type'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, list: true },
      { name: 'phone', label: 'Phone', type: 'text', list: true },
      { name: 'skill', label: 'Role / skill', type: 'select', options: ['helper', 'skilled', 'picker', 'sprayer', 'supervisor', 'driver', 'delivery', 'watchman'], default: 'helper', list: true },
      { name: 'farm_id', label: 'Works at', type: 'ref', ref: 'farms' },
      { name: 'pay_type', label: 'Paid by', type: 'select', options: ['daily', 'monthly', 'piece'], default: 'daily', list: true },
      { name: 'daily_wage', label: 'Daily wage', type: 'number', list: true },
      { name: 'monthly_salary', label: 'Monthly salary', type: 'number' },
      { name: 'piece_rate', label: 'Piece rate per kg harvested', type: 'number' },
      { name: 'joining_date', label: 'Joined on', type: 'date' },
      { name: 'active', label: 'Active', type: 'bool', default: 1 },
    ],
  },
  attendance: {
    title: 'Attendance', table: 'attendance', module: 'labour', read: FIELD, write: FIELD,
    label: "CONCAT({a}.date, ' ', {a}.status)", order: 'date DESC, worker_id', dateField: 'date', filters: ['worker_id', 'farm_id', 'status'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'worker_id', label: 'Worker', type: 'ref', ref: 'workers', required: true, list: true },
      { name: 'status', label: 'Status', type: 'select', options: ['present', 'half', 'absent', 'leave'], default: 'present', list: true },
      { name: 'check_in', label: 'Check in', type: 'time' },
      { name: 'check_out', label: 'Check out', type: 'time' },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms' },
      { name: 'task', label: 'Work done', type: 'text', list: true },
      { name: 'overtime_hours', label: 'Overtime hours', type: 'number', default: 0 },
    ],
  },
  advances: {
    title: 'Advances / bonus / deductions', table: 'advances', module: 'labour', read: MANAGERS, write: MANAGERS,
    label: "CONCAT({a}.type, ' ', {a}.amount)", order: 'date DESC', dateField: 'date', filters: ['worker_id', 'type'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'worker_id', label: 'Worker', type: 'ref', ref: 'workers', required: true, list: true },
      { name: 'type', label: 'Type', type: 'select', options: ['advance', 'bonus', 'deduction'], default: 'advance', list: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true, list: true },
      { name: 'notes', label: 'Notes', type: 'text', list: true },
    ],
  },
  wage_payments: {
    title: 'Wage payments', table: 'wage_payments', module: 'labour', read: MANAGERS, write: MANAGERS,
    label: "CONCAT({a}.date, ' ', {a}.net_paid)", order: 'date DESC', dateField: 'date', filters: ['worker_id'],
    fields: [
      { name: 'date', label: 'Paid on', type: 'date', default: 'today', required: true, list: true },
      { name: 'worker_id', label: 'Worker', type: 'ref', ref: 'workers', required: true, list: true },
      { name: 'period_start', label: 'Period from', type: 'date', required: true },
      { name: 'period_end', label: 'Period to', type: 'date', required: true },
      { name: 'days_worked', label: 'Days worked', type: 'number', list: true },
      { name: 'gross', label: 'Gross earned', type: 'number', required: true },
      { name: 'bonus', label: 'Bonus', type: 'number', default: 0 },
      { name: 'deductions', label: 'Advance recovered + deductions', type: 'number', default: 0 },
      { name: 'net_paid', label: 'Net paid', type: 'number', readonly: true, list: true },
      { name: 'mode', label: 'Mode', type: 'select', options: PAY_MODES, default: 'cash' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
    hooks: {
      async before(d, ctx) {
        const c = { ...(ctx.existing || {}), ...d };
        d.net_paid = Number(c.gross || 0) + Number(c.bonus || 0) - Number(c.deductions || 0);
      },
      async after(id, d, ctx, op) {
        if (op === 'delete') return syncLinkedExpense(ctx.org.id, 'wage_payment_id', id, null);
        const w = await one('SELECT w.name, w.farm_id, p.* FROM wage_payments p JOIN workers w ON w.id=p.worker_id WHERE p.id=?', [id]);
        // Labour cost booked = gross + bonus (advances were already cash out, recovered here)
        await syncLinkedExpense(ctx.org.id, 'wage_payment_id', id, {
          date: w.date, category_id: await categoryId(ctx.org.id, 'labour', 'Labour wages'),
          description: `Wages: ${w.name} (${w.period_start} to ${w.period_end})`, farm_id: w.farm_id,
          amount: Number(w.gross) + Number(w.bonus || 0), mode: w.mode,
        });
      },
    },
  },
  tasks: {
    title: 'Tasks', table: 'tasks', module: 'tasks', read: FIELD, write: FIELD,
    label: '{a}.title', order: 'date DESC, status', dateField: 'date', filters: ['farm_id', 'worker_id', 'status', 'task_type'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'title', label: 'Task', type: 'text', required: true, list: true },
      { name: 'task_type', label: 'Type', type: 'select', options: ['pruning', 'trellising', 'de-leafing', 'fertigation', 'spraying', 'harvesting', 'grading', 'cleaning', 'repair', 'other'], default: 'other', list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', list: true },
      { name: 'bay_id', label: 'Bay', type: 'ref', ref: 'bays', dependsOn: 'farm_id' },
      { name: 'worker_id', label: 'Assigned to', type: 'ref', ref: 'workers', module: 'labour', list: true },
      { name: 'status', label: 'Status', type: 'select', options: ['todo', 'done'], default: 'todo', list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  fertigation_recipes: {
    title: 'Fertigation recipes', table: 'fertigation_recipes', module: 'fertigation', read: FIELD, write: MANAGERS,
    label: '{a}.stage', order: 'crop_id, id', filters: ['crop_id'],
    fields: [
      { name: 'crop_id', label: 'Crop', type: 'ref', ref: 'crops', required: true, list: true },
      { name: 'stage', label: 'Stage', type: 'text', required: true, list: true, help: 'Vegetative, flowering, fruiting ...' },
      { name: 'ec_min', label: 'EC min', type: 'number', list: true },
      { name: 'ec_max', label: 'EC max', type: 'number', list: true },
      { name: 'ph_min', label: 'pH min', type: 'number' },
      { name: 'ph_max', label: 'pH max', type: 'number' },
      { name: 'recipe', label: 'Recipe (fertiliser per 1000 L etc.)', type: 'textarea' },
    ],
  },
  fertigation_logs: {
    title: 'EC / pH log', table: 'fertigation_logs', module: 'fertigation', read: FIELD, write: FIELD,
    label: "CONCAT({a}.date)", order: 'date DESC, id DESC', dateField: 'date', filters: ['farm_id', 'bay_id'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', required: true, list: true },
      { name: 'bay_id', label: 'Bay', type: 'ref', ref: 'bays', dependsOn: 'farm_id' },
      { name: 'crop_cycle_id', label: 'Crop cycle', type: 'ref', ref: 'crop_cycles', module: 'crop_cycles' },
      { name: 'feed_ec', label: 'Feed EC', type: 'number', list: true },
      { name: 'feed_ph', label: 'Feed pH', type: 'number', list: true },
      { name: 'drain_ec', label: 'Drain EC', type: 'number', list: true },
      { name: 'drain_ph', label: 'Drain pH', type: 'number' },
      { name: 'water_litres', label: 'Water used (L)', type: 'number' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  climate_logs: {
    title: 'Climate log', table: 'climate_logs', module: 'climate', read: FIELD, write: FIELD,
    label: "CONCAT({a}.date)", order: 'date DESC, time DESC', dateField: 'date', filters: ['farm_id'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'time', label: 'Time', type: 'time', list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', required: true, list: true },
      { name: 'temperature', label: 'Temperature (°C)', type: 'number', list: true },
      { name: 'humidity', label: 'Humidity (%)', type: 'number', list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  scouting_logs: {
    title: 'Scouting', table: 'scouting_logs', module: 'scouting', read: FIELD, write: FIELD,
    label: '{a}.pest', order: 'date DESC', dateField: 'date', filters: ['farm_id', 'bay_id', 'severity'],
    fields: [
      { name: 'date', label: 'Date', type: 'date', default: 'today', required: true, list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', required: true, list: true },
      { name: 'bay_id', label: 'Bay', type: 'ref', ref: 'bays', dependsOn: 'farm_id', list: true },
      { name: 'pest', label: 'Pest / disease', type: 'text', list: true, help: 'Thrips, whitefly, mites, nematode, powdery mildew ...' },
      { name: 'trap_count', label: 'Sticky trap count', type: 'number', list: true },
      { name: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high'], default: 'low', list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  spray_logs: {
    title: 'Spray log', table: 'spray_logs', module: 'scouting', read: FIELD, write: FIELD,
    label: '{a}.product', order: 'date DESC', dateField: 'date', filters: ['farm_id', 'bay_id'],
    select: "DATE_ADD({a}.date, INTERVAL {a}.phi_days DAY) AS safe_from",
    fields: [
      { name: 'date', label: 'Sprayed on', type: 'date', default: 'today', required: true, list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms', required: true, list: true },
      { name: 'bay_id', label: 'Bay (blank = whole farm)', type: 'ref', ref: 'bays', dependsOn: 'farm_id', list: true },
      { name: 'product', label: 'Product', type: 'text', required: true, list: true },
      { name: 'dose', label: 'Dose', type: 'text' },
      { name: 'target_pest', label: 'Target pest', type: 'text' },
      { name: 'phi_days', label: 'Pre-harvest interval (days)', type: 'number', default: 0, help: 'Harvest is locked for these many days' },
      { name: 'safe_from', label: 'Harvest safe from', type: 'date', readonly: true, virtual: true, list: true },
      { name: 'worker_id', label: 'Sprayed by', type: 'ref', ref: 'workers', module: 'labour' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  assets: {
    title: 'Assets', table: 'assets', module: 'assets', read: MANAGERS, write: MANAGERS,
    label: '{a}.name', order: 'purchase_date DESC', filters: ['farm_id', 'type'],
    select: "ROUND(GREATEST({a}.salvage_value, {a}.cost - ({a}.cost - {a}.salvage_value) * LEAST(1, DATEDIFF(CURDATE(), {a}.purchase_date) / (365 * {a}.life_years))), 2) AS book_value, DATE_ADD({a}.purchase_date, INTERVAL ROUND({a}.life_years*12) MONTH) AS replace_on",
    fields: [
      { name: 'name', label: 'Asset', type: 'text', required: true, list: true },
      { name: 'type', label: 'Type', type: 'select', options: ['structure', 'polyfilm', 'insect net', 'drip system', 'pump', 'sensor', 'vehicle', 'tools', 'other'], default: 'other', list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms' },
      { name: 'purchase_date', label: 'Bought / installed on', type: 'date', required: true },
      { name: 'cost', label: 'Cost', type: 'number', required: true, list: true },
      { name: 'life_years', label: 'Useful life (years)', type: 'number', default: 5 },
      { name: 'salvage_value', label: 'Salvage value', type: 'number', default: 0 },
      { name: 'book_value', label: 'Book value today', type: 'number', readonly: true, virtual: true, list: true },
      { name: 'replace_on', label: 'Replace on', type: 'date', readonly: true, virtual: true, list: true },
      { name: 'next_service', label: 'Next service', type: 'date', list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  loans: {
    title: 'Loans', table: 'loans', module: 'loans', read: MANAGERS, write: MANAGERS,
    label: '{a}.lender', order: 'start_date DESC',
    select: "(SELECT {a}.principal - COALESCE(SUM(r.amount - r.interest_part),0) FROM loan_repayments r WHERE r.loan_id={a}.id) AS outstanding",
    fields: [
      { name: 'lender', label: 'Lender', type: 'text', required: true, list: true },
      { name: 'principal', label: 'Loan amount', type: 'number', required: true, list: true },
      { name: 'interest_rate', label: 'Interest % / year', type: 'number' },
      { name: 'start_date', label: 'Taken on', type: 'date', required: true },
      { name: 'tenure_months', label: 'Tenure (months)', type: 'number' },
      { name: 'emi', label: 'EMI', type: 'number', list: true },
      { name: 'outstanding', label: 'Outstanding', type: 'number', readonly: true, virtual: true, list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  loan_repayments: {
    title: 'Loan repayments', table: 'loan_repayments', module: 'loans', read: MANAGERS, write: MANAGERS,
    label: "CONCAT({a}.date, ' ', {a}.amount)", order: 'date DESC', dateField: 'date', filters: ['loan_id'],
    fields: [
      { name: 'date', label: 'Paid on', type: 'date', default: 'today', required: true, list: true },
      { name: 'loan_id', label: 'Loan', type: 'ref', ref: 'loans', required: true, list: true },
      { name: 'amount', label: 'Amount paid', type: 'number', required: true, list: true },
      { name: 'interest_part', label: 'Of which interest', type: 'number', default: 0, list: true, help: 'Interest is booked as an expense' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
    hooks: {
      async after(id, d, ctx, op) {
        if (op === 'delete') return syncLinkedExpense(ctx.org.id, 'loan_repayment_id', id, null);
        const r = await one('SELECT r.*, l.lender FROM loan_repayments r JOIN loans l ON l.id=r.loan_id WHERE r.id=?', [id]);
        await syncLinkedExpense(ctx.org.id, 'loan_repayment_id', id, {
          date: r.date, category_id: await categoryId(ctx.org.id, 'interest', 'Loan interest'),
          description: `Interest: ${r.lender}`, amount: Number(r.interest_part || 0), mode: 'bank',
        });
      },
    },
  },
  documents: {
    title: 'Documents', table: 'documents', module: 'documents', read: MANAGERS, write: MANAGERS,
    label: '{a}.title', order: 'created_at DESC', filters: ['doc_type', 'farm_id'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, list: true },
      { name: 'doc_type', label: 'Type', type: 'select', options: ['land', 'lease', 'subsidy', 'loan', 'insurance', 'licence', 'photo', 'bill', 'report', 'other'], default: 'other', list: true },
      { name: 'farm_id', label: 'Farm', type: 'ref', ref: 'farms' },
      { name: 'doc_date', label: 'Document date', type: 'date', list: true },
      { name: 'expiry_date', label: 'Expires on', type: 'date', list: true },
      { name: 'file_path', label: 'File', type: 'file', list: true },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
};

// Fill in keys & make sure each resource has defaults
for (const [key, r] of Object.entries(R)) { r.key = key; r.filters = r.filters || []; r.hooks = r.hooks || {}; }

module.exports = { R, lookupPrice, activeLocks, today, addDays, categoryId };
