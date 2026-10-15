// The Day / Week / Month / FY / custom dropdown used on dashboards & reports
import { PERIODS, periodRange, autoGroup } from '../lib/format';
import { t } from '../lib/i18n';

export default function PeriodPicker({ value, onChange, showGroup = true }) {
  const set = (patch) => {
    const next = { ...value, ...patch };
    if (patch.key && patch.key !== 'custom') Object.assign(next, periodRange(patch.key));
    if (patch.key || patch.from || patch.to) next.group = autoGroup(next.from, next.to);
    onChange(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input !w-auto !py-2 font-medium" value={value.key} onChange={(e) => set({ key: e.target.value })} aria-label="Period">
        {PERIODS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
      </select>
      {value.key === 'custom' && (
        <>
          <input type="date" className="input !w-auto !py-2" value={value.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
          <span className="text-slate-400">–</span>
          <input type="date" className="input !w-auto !py-2" value={value.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
        </>
      )}
      {showGroup && (
        <select className="input !w-auto !py-2" value={value.group} onChange={(e) => onChange({ ...value, group: e.target.value })} aria-label="Group by">
          <option value="day">{t('by day')}</option><option value="week">{t('by week')}</option><option value="month">{t('by month')}</option>
        </select>
      )}
    </div>
  );
}
