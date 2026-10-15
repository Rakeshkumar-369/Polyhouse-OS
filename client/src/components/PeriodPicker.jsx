// The Day / Week / Month ... dropdown used on dashboards & reports
import { PERIODS, periodRange, autoGroup } from '../utils';

export default function PeriodPicker({ value, onChange, showGroup = true }) {
  // value = { key, from, to, group }
  const set = (patch) => {
    const next = { ...value, ...patch };
    if (patch.key && patch.key !== 'custom') Object.assign(next, periodRange(patch.key));
    if (patch.key || patch.from || patch.to) next.group = patch.group || autoGroup(next.from, next.to);
    onChange(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input !w-auto !py-2 font-medium" value={value.key} onChange={(e) => set({ key: e.target.value })}>
        {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {value.key === 'custom' && (
        <>
          <input type="date" className="input !w-auto !py-2" value={value.from} onChange={(e) => set({ from: e.target.value })} />
          <span className="text-slate-400">to</span>
          <input type="date" className="input !w-auto !py-2" value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </>
      )}
      {showGroup && (
        <select className="input !w-auto !py-2" value={value.group} onChange={(e) => onChange({ ...value, group: e.target.value })} title="Show trend by">
          <option value="day">by day</option><option value="week">by week</option><option value="month">by month</option>
        </select>
      )}
    </div>
  );
}

export const initialPeriod = (key = 'this_month') => { const r = periodRange(key); return { key, ...r, group: autoGroup(r.from, r.to) }; };
