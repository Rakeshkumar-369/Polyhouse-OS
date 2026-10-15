// Menu definition. A link shows only if the user's role is allowed AND its module is ON.
// /m/<resource> links are generic list screens (shown when the server's /api/meta includes that resource).
const OWN = ['admin', 'manager'];
const FIELD = ['admin', 'manager', 'supervisor'];
const STAFF = ['admin', 'manager', 'supervisor', 'delivery'];

export const MAIN = [
  { to: '/', label: 'Home', icon: 'house-door', roles: FIELD },
  { to: '/sell', label: 'Sell', icon: 'truck', roles: STAFF, module: 'sales' },
  { to: '/harvest', label: 'Harvest', icon: 'basket', roles: STAFF, module: 'harvest' },
  { to: '/spend', label: 'Spend', icon: 'wallet2', roles: FIELD, module: 'expenses' },
  { to: '/reports', label: 'Reports', icon: 'graph-up-arrow', roles: OWN },
  { to: '/vendors', label: 'Vendors', icon: 'shop', roles: OWN, module: 'sales' },
  { to: '/labour', label: 'Labour', icon: 'people', roles: FIELD, module: 'labour' },
  { to: '/alerts', label: 'Alerts', icon: 'bell', roles: FIELD, module: 'alerts' },
];

export const GROUPS = [
  { title: 'Farm setup', items: [
    { to: '/m/farms', label: 'Farms / polyhouses', icon: 'house' },
    { to: '/m/bays', label: 'Bays / plots', icon: 'grid-3x3' },
    { to: '/m/crops', label: 'Crops', icon: 'flower1' },
    { to: '/m/crop_cycles', label: 'Crop cycles', icon: 'arrow-repeat' },
  ] },
  { title: 'Grow', items: [
    { to: '/m/tasks', label: 'Daily tasks', icon: 'check2-square' },
    { to: '/m/fertigation_logs', label: 'EC / pH log', icon: 'droplet-half' },
    { to: '/m/fertigation_recipes', label: 'Fertigation recipes', icon: 'journal-text' },
    { to: '/m/climate_logs', label: 'Climate log', icon: 'thermometer-half' },
    { to: '/m/scouting_logs', label: 'Scouting', icon: 'bug' },
    { to: '/m/spray_logs', label: 'Spray log', icon: 'moisture' },
  ] },
  { title: 'Sell', items: [
    { to: '/m/sales', label: 'All sales', icon: 'receipt' },
    { to: '/m/orders', label: 'Vendor orders', icon: 'cart-check' },
    { to: '/m/price_list', label: 'Vendor price list', icon: 'tags' },
    { to: '/m/payments_received', label: 'Payments received', icon: 'cash-coin' },
    { to: '/m/harvests', label: 'All harvests', icon: 'basket2' },
    { to: '/m/parties', label: 'Vendors & suppliers', icon: 'person-vcard' },
  ] },
  { title: 'Spend & stock', items: [
    { to: '/m/expenses', label: 'All expenses', icon: 'journal-minus' },
    { to: '/m/recurring_expenses', label: 'Recurring payments', icon: 'calendar2-check' },
    { to: '/m/inventory_items', label: 'Input stock', icon: 'box-seam' },
    { to: '/m/stock_moves', label: 'Stock in / out', icon: 'arrow-left-right' },
    { to: '/m/expense_categories', label: 'Expense categories', icon: 'tags' },
  ] },
  { title: 'Work', items: [
    { to: '/m/workers', label: 'Workers & salaries', icon: 'person-badge' },
    { to: '/m/attendance', label: 'Attendance records', icon: 'calendar-check' },
    { to: '/m/advances', label: 'Advances & bonus', icon: 'cash-stack' },
    { to: '/m/wage_payments', label: 'Wage payments', icon: 'wallet' },
  ] },
  { title: 'Money & records', items: [
    { to: '/m/other_income', label: 'Other income', icon: 'piggy-bank' },
    { to: '/m/loans', label: 'Loans', icon: 'bank' },
    { to: '/m/loan_repayments', label: 'Loan repayments', icon: 'arrow-return-left' },
    { to: '/m/assets', label: 'Assets & maintenance', icon: 'tools' },
    { to: '/m/documents', label: 'Document vault', icon: 'folder2-open' },
  ] },
  { title: 'Admin', items: [
    { to: '/settings', label: 'Settings & users', icon: 'gear', roles: ['admin'] },
    { to: '/account', label: 'My account', icon: 'person-circle', roles: STAFF },
  ] },
];

export function visible(item, meta, role) {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.module && meta?.org && meta.org.settings.modules[item.module] === false) return false;
  if (item.to.startsWith('/m/')) return !!meta?.resources?.[item.to.slice(3)];
  return true;
}

// Bottom tab bar on phones (4 + More)
export function mobileTabs(meta, role) {
  const pick = { delivery: ['/sell', '/harvest'], supervisor: ['/', '/harvest', '/sell', '/labour'] }[role] || ['/', '/sell', '/harvest', '/reports'];
  return MAIN.filter((m) => pick.includes(m.to) && visible(m, meta, role));
}
