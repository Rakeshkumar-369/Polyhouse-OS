// Menu definition. A link shows only if the user's role is allowed AND its module is ON.
// /m/<resource> links are generic list screens (shown when the server's /api/meta includes that resource).
const OWN = ['admin', 'manager'];
const FIELD = ['admin', 'manager', 'supervisor'];
const STAFF = ['admin', 'manager', 'supervisor', 'delivery'];

export const MAIN = [
  { to: '/', label: 'Home', icon: 'bi-house-door', roles: FIELD },
  { to: '/sell', label: 'Sell', icon: 'bi-truck', roles: STAFF, module: 'sales' },
  { to: '/harvest', label: 'Harvest', icon: 'bi-basket', roles: STAFF, module: 'harvest' },
  { to: '/spend', label: 'Spend', icon: 'bi-wallet2', roles: ['admin', 'manager', 'supervisor'], module: 'expenses' },
  { to: '/reports', label: 'Reports', icon: 'bi-graph-up-arrow', roles: OWN },
  { to: '/vendors', label: 'Vendors', icon: 'bi-shop', roles: OWN, module: 'sales' },
  { to: '/labour', label: 'Labour', icon: 'bi-people', roles: FIELD, module: 'labour' },
  { to: '/alerts', label: 'Alerts', icon: 'bi-bell', roles: FIELD, module: 'alerts' },
];

export const GROUPS = [
  { title: 'Farm setup', items: [
    { to: '/m/farms', label: 'Farms / polyhouses', icon: 'bi-house' },
    { to: '/m/bays', label: 'Bays / plots', icon: 'bi-grid-3x3' },
    { to: '/m/crops', label: 'Crops', icon: 'bi-flower1' },
    { to: '/m/crop_cycles', label: 'Crop cycles', icon: 'bi-arrow-repeat' },
  ] },
  { title: 'Grow', items: [
    { to: '/m/tasks', label: 'Daily tasks', icon: 'bi-check2-square' },
    { to: '/m/fertigation_logs', label: 'EC / pH log', icon: 'bi-droplet-half' },
    { to: '/m/fertigation_recipes', label: 'Fertigation recipes', icon: 'bi-journal-text' },
    { to: '/m/climate_logs', label: 'Climate log', icon: 'bi-thermometer-half' },
    { to: '/m/scouting_logs', label: 'Scouting', icon: 'bi-bug' },
    { to: '/m/spray_logs', label: 'Spray log', icon: 'bi-moisture' },
  ] },
  { title: 'Sell', items: [
    { to: '/m/sales', label: 'All sales', icon: 'bi-receipt' },
    { to: '/m/orders', label: 'Vendor orders', icon: 'bi-cart-check' },
    { to: '/m/price_list', label: 'Vendor price list', icon: 'bi-tags' },
    { to: '/m/payments_received', label: 'Payments received', icon: 'bi-cash-coin' },
    { to: '/m/harvests', label: 'All harvests', icon: 'bi-basket2' },
    { to: '/m/parties', label: 'Vendors & suppliers', icon: 'bi-person-vcard' },
  ] },
  { title: 'Spend & stock', items: [
    { to: '/m/expenses', label: 'All expenses', icon: 'bi-journal-minus' },
    { to: '/m/recurring_expenses', label: 'Recurring payments', icon: 'bi-calendar2-check' },
    { to: '/m/inventory_items', label: 'Input stock', icon: 'bi-box-seam' },
    { to: '/m/stock_moves', label: 'Stock in / out', icon: 'bi-arrow-left-right' },
    { to: '/m/expense_categories', label: 'Expense categories', icon: 'bi-tags' },
  ] },
  { title: 'Work', items: [
    { to: '/m/workers', label: 'Workers & salaries', icon: 'bi-person-badge' },
    { to: '/m/attendance', label: 'Attendance records', icon: 'bi-calendar-check' },
    { to: '/m/advances', label: 'Advances & bonus', icon: 'bi-cash-stack' },
    { to: '/m/wage_payments', label: 'Wage payments', icon: 'bi-wallet' },
  ] },
  { title: 'Money & records', items: [
    { to: '/m/other_income', label: 'Other income', icon: 'bi-piggy-bank' },
    { to: '/m/loans', label: 'Loans', icon: 'bi-bank' },
    { to: '/m/loan_repayments', label: 'Loan repayments', icon: 'bi-arrow-return-left' },
    { to: '/m/assets', label: 'Assets & maintenance', icon: 'bi-tools' },
    { to: '/m/documents', label: 'Document vault', icon: 'bi-folder2-open' },
  ] },
  { title: 'Admin', items: [
    { to: '/settings', label: 'Settings & users', icon: 'bi-gear', roles: ['admin'] },
    { to: '/account', label: 'My account', icon: 'bi-person-circle', roles: STAFF },
  ] },
];

// Which links does this user see?
export function visible(item, meta, role) {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.module && meta?.org && meta.org.settings.modules[item.module] === false) return false;
  if (item.to.startsWith('/m/')) return !!meta?.resources?.[item.to.slice(3)];
  return true;
}

// Bottom tab bar on phones (max 4 + More)
export function mobileTabs(meta, role) {
  const pick = { delivery: ['/sell', '/harvest'], supervisor: ['/', '/harvest', '/sell', '/labour'] }[role] || ['/', '/sell', '/harvest', '/spend'];
  return MAIN.filter((m) => pick.includes(m.to) && visible(m, meta, role));
}
