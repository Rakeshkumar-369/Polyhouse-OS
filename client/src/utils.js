// Formatting + date helpers shared by every page
export const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
export const todayISO = () => iso(new Date());
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };

export const money = (v, cur = '₹') => (v === null || v === undefined || v === '' ? '—' : `${Number(v) < 0 ? '-' : ''}${cur}${Math.abs(Math.round(Number(v))).toLocaleString('en-IN')}`);
export const num = (v, d = 1) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d }));
export const short = (v) => {
  const n = Number(v) || 0; const a = Math.abs(n);
  if (a >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return (n / 1e5).toFixed(2) + ' L';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
};
export const fdate = (s) => (s ? new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
export const pct = (a, b) => (b ? Math.round((100 * (a - b)) / Math.abs(b)) : null);
export const cls = (...a) => a.filter(Boolean).join(' ');

// Period dropdown presets (Day / Week / Month / ... ). Weeks start Monday. FY = April-March (India).
export const PERIODS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['this_week', 'This week'], ['last_week', 'Last week'],
  ['this_month', 'This month'], ['last_month', 'Last month'], ['last_30', 'Last 30 days'], ['last_90', 'Last 90 days'],
  ['this_fy', 'This financial year'], ['this_year', 'This calendar year'], ['custom', 'Custom dates'],
];

export function periodRange(key, custom = {}) {
  const t = todayISO(); const d = new Date(t + 'T00:00:00');
  const monday = addDays(t, -((d.getDay() + 6) % 7));
  const m0 = iso(new Date(d.getFullYear(), d.getMonth(), 1));
  switch (key) {
    case 'today': return { from: t, to: t };
    case 'yesterday': return { from: addDays(t, -1), to: addDays(t, -1) };
    case 'this_week': return { from: monday, to: t };
    case 'last_week': return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case 'this_month': return { from: m0, to: t };
    case 'last_month': return { from: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: addDays(m0, -1) };
    case 'last_90': return { from: addDays(t, -89), to: t };
    case 'this_fy': { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return { from: `${y}-04-01`, to: t }; }
    case 'this_year': return { from: `${d.getFullYear()}-01-01`, to: t };
    case 'custom': return { from: custom.from || addDays(t, -29), to: custom.to || t };
    default: return { from: addDays(t, -29), to: t };
  }
}
export const autoGroup = (from, to) => { const n = (new Date(to) - new Date(from)) / 864e5; return n <= 31 ? 'day' : n <= 120 ? 'week' : 'month'; };

// CSV download of any array of objects (columns: [[key,label],...])
export function downloadCSV(name, rows, columns) {
  const cols = columns || Object.keys(rows[0] || {}).map((k) => [k, k]);
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map((c) => esc(c[1])).join(','), ...rows.map((r) => cols.map((c) => esc(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name.replace(/[^\w.-]+/g, '_') + '.csv'; a.click();
}

// Validated colour-blind-safe categorical order (fixed order, never cycled)
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
