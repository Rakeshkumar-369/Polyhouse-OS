// =====================================================================
// Central product configuration:
//  - MODULES: every toggleable feature (admin turns them on/off in Settings)
//  - PRESETS: default modules per customer type (used when super admin creates an org)
//  - DEFAULT_CATEGORIES: expense categories created for each new org
//  - DEFAULT_SETTINGS: thresholds used by the alerts engine
//  - ROLES: who can do what
// =====================================================================

const MODULES = [
  { key: 'crop_cycles', label: 'Crop cycle planner', group: 'Grow', desc: 'Plan crop, variety, transplant & harvest window, target yield' },
  { key: 'fertigation', label: 'Fertigation & EC/pH', group: 'Grow', desc: 'Recipes by stage and daily feed/drain EC & pH log' },
  { key: 'climate', label: 'Climate log', group: 'Grow', desc: 'Temperature & humidity readings' },
  { key: 'scouting', label: 'Scouting & sprays', group: 'Grow', desc: 'Trap counts, spray log, harvest lock after spray' },
  { key: 'tasks', label: 'Daily tasks', group: 'Work', desc: 'Tasks by bay assigned to workers' },
  { key: 'labour', label: 'Labour & wages', group: 'Work', desc: 'Workers, salaries, attendance, advances, wage run' },
  { key: 'labour_portal', label: 'Labour login', group: 'Work', desc: 'Workers see attendance & earnings, self check-in' },
  { key: 'expenses', label: 'Expenses & purchases', group: 'Spend', desc: 'Seeds, trays, grow bags, rent, current ... every rupee spent' },
  { key: 'inventory', label: 'Input stock', group: 'Spend', desc: 'Stock of seeds, trays, fertiliser etc. with low-stock alerts' },
  { key: 'recurring', label: 'Recurring payments', group: 'Spend', desc: 'Rent, electricity, EMI posted automatically when due' },
  { key: 'harvest', label: 'Harvest & grading', group: 'Sell', desc: 'Daily pluck by crop, grade and bay' },
  { key: 'sales', label: 'Sales & vendors', group: 'Sell', desc: 'Sell to vendors at vendor-specific prices, payments & dues' },
  { key: 'orders', label: 'Vendor orders', group: 'Sell', desc: 'Vendors / owner record orders; delivery fulfils them' },
  { key: 'vendor_portal', label: 'Vendor login', group: 'Sell', desc: 'Vendors see deliveries, accept/reject, dues and prices' },
  { key: 'finance', label: 'P&L & balance sheet', group: 'Decide', desc: 'Profit & loss, cost per kg, balance sheet for any date' },
  { key: 'other_income', label: 'Other income', group: 'Decide', desc: 'Subsidy, scrap sale, nursery plants ...' },
  { key: 'loans', label: 'Loans & EMI', group: 'Decide', desc: 'Loan tracker with repayments' },
  { key: 'assets', label: 'Assets & maintenance', group: 'Decide', desc: 'Structure, polyfilm, pumps - depreciation & service due' },
  { key: 'documents', label: 'Document vault', group: 'Decide', desc: 'Land, lease, subsidy, loan papers & photos' },
  { key: 'alerts', label: 'Alerts', group: 'Decide', desc: 'Exceptions that need action today' },
];

const ALL_ON = Object.fromEntries(MODULES.map((m) => [m.key, true]));

// Customer types the platform is sold to
const CUSTOMER_TYPES = {
  single_polyhouse: { label: 'Single polyhouse owner', siteWord: 'Polyhouse', modules: { ...ALL_ON } },
  crop_field: { label: 'Crop field owner', siteWord: 'Field', modules: { ...ALL_ON, fertigation: false, climate: false } },
  multi_polyhouse: { label: 'Owner with many polyhouses', siteWord: 'Polyhouse', modules: { ...ALL_ON } },
  fpo: { label: 'Farmer Producer Organisation', siteWord: 'Member farm', modules: { ...ALL_ON, climate: false, fertigation: false } },
  multi_location: { label: 'Farmer with land at many places', siteWord: 'Land', modules: { ...ALL_ON, fertigation: false, climate: false } },
};

const DEFAULT_CATEGORIES = [
  ['Seeds & seedlings', 'input'], ['Trays', 'input'], ['Grow bags', 'input'], ['Grow slabs', 'input'],
  ['Threads & clips', 'input'], ['Iron & structure', 'input'], ['Fertiliser', 'input'], ['Pesticide', 'input'],
  ['Labour wages', 'labour'], ['Land rent', 'rent'], ['Electricity (current)', 'utility'], ['Water', 'utility'],
  ['Transport', 'transport'], ['Packaging', 'packaging'], ['Repairs & maintenance', 'repair'], ['Fuel', 'other'],
  ['Loan interest', 'interest'], ['Miscellaneous', 'other'],
];

const DEFAULT_SETTINGS = {
  sale_frequency: 'daily',        // how often the owner sells produce
  currency: '₹',
  grades: ['A', 'B', 'C'],
  opening_cash: 0,
  books_start: null,              // date from which cash is tracked
  thresholds: {
    ec_min: 1.2, ec_max: 2.0, ph_min: 5.8, ph_max: 6.5,
    drain_ec_margin: 0.5,          // drain EC above feed EC by this for 3 logs => salt build-up
    temp_min: 18, temp_max: 28, hum_min: 60, hum_max: 80,
    trap_count: 50,
    asset_due_days: 60,
    doc_expiry_days: 30,
  },
};

// Staff roles inside an org. 'admin' = owner. superadmin is platform-level.
const ROLES = ['admin', 'manager', 'supervisor', 'delivery', 'labour', 'vendor'];
const STAFF = ['admin', 'manager', 'supervisor', 'delivery'];
const MANAGERS = ['admin', 'manager'];
const FIELD = ['admin', 'manager', 'supervisor'];

module.exports = { MODULES, CUSTOMER_TYPES, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, ROLES, STAFF, MANAGERS, FIELD };
