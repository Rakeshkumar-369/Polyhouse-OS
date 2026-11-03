// Smart suggestions: what the farm's own history says about this month, next month and each crop's best season.
// Data: GET /api/suggestions (server/src/suggestionsService.js)
import { useState } from 'react';
import { useApi } from '../../lib/api';
import { t } from '../../lib/i18n';
import { cls } from '../../lib/format';
import { Card, Empty, Icon, PageHeader, Skeleton, Badge, Tabs } from '../../ui/kit';

export const KIND = {
  now: { icon: 'thermometer-half', label: 'This month' },
  upcoming: { icon: 'calendar2-check', label: 'Next month' },
  season: { icon: 'flower1', label: 'Best season' },
  price: { icon: 'tags', label: 'Price' },
  avoid: { icon: 'exclamation-triangle-fill', label: 'Weak month' },
  learning: { icon: 'hourglass-split', label: 'Learning' },
};
const TONE = { warn: 'border-l-amber-500 bg-amber-50/50', good: 'border-l-brand-600 bg-brand-50/50', info: 'border-l-blue-500 bg-blue-50/30' };

export function SuggestionList({ items, limit }) {
  if (!items.length) return <Empty icon="lightbulb" text="Suggestions appear after a few months of harvest and temperature records." />;
  return (
    <div className="space-y-2">
      {items.slice(0, limit || items.length).map((s, i) => (
        <div key={i} className={cls('rounded-xl border border-slate-200 border-l-4 px-3 py-2.5', TONE[s.level] || 'border-l-slate-300')}>
          <div className="flex items-start gap-2">
            <Icon name={KIND[s.type]?.icon || 'lightbulb'} className="mt-0.5 text-slate-500" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">{s.title}</div>
              <div className="text-xs text-slate-600 mt-0.5">{s.detail}</div>
            </div>
            <Badge tone={s.confidence === 'high' ? 'green' : s.confidence === 'medium' ? 'blue' : 'slate'}>{t(KIND[s.type]?.label || '')}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// Heat colour for a month's yield index (100 = the crop's normal month)
const heat = (i) => (i === null ? 'bg-slate-50 text-slate-300' : i >= 130 ? 'bg-brand-600 text-white' : i >= 110 ? 'bg-brand-200 text-brand-900' : i >= 90 ? 'bg-slate-100 text-slate-700' : i >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700');

function SeasonCalendar({ data }) {
  const crops = data.profiles.filter((p) => !p.learning);
  if (!crops.length) return <Empty icon="calendar2-check" text="The season calendar fills in after a few months of records." />;
  const cur = data.thisMonth.slice(0, 3);
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="text-xs border-separate border-spacing-1 min-w-[640px] w-full">
        <thead>
          <tr><th className="text-left font-semibold text-slate-500 pr-2">Crop</th>{data.months.map((m) => <th key={m} className={cls('font-semibold w-12', m === cur ? 'text-brand-700' : 'text-slate-500')}>{m}</th>)}</tr>
        </thead>
        <tbody>
          {crops.map((p) => (
            <tr key={p.crop_id}>
              <td className="pr-2 font-medium whitespace-nowrap"><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ background: p.color }} />{p.crop}</td>
              {p.byMonth.map((m, i) => (
                <td key={i} title={m ? `${p.crop} ${m.month}: ${m.value} ${p.unit} (${m.index}% of normal)${m.t !== null ? `, ${m.t} °C` : ''}${m.price ? `, ₹${m.price}` : ''}` : 'no data'}
                  className={cls('rounded-md text-center py-1.5 font-semibold tabular-nums', heat(m ? m.index : null), data.months[i] === cur && 'ring-2 ring-brand-500')}>
                  {m ? m.index : '·'}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="pr-2 font-medium text-slate-500 whitespace-nowrap"><Icon name="thermometer-half" /> Avg °C</td>
            {data.tempRow.map((m, i) => <td key={i} className="text-center py-1.5 text-slate-600 tabular-nums">{m ? Math.round(m.t) : '·'}</td>)}
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-500">
        {[['bg-brand-600', '130%+ (best)'], ['bg-brand-200', '110–130%'], ['bg-slate-100', 'normal'], ['bg-amber-100', '70–90%'], ['bg-red-100', 'below 70%']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1"><span className={cls('h-3 w-3 rounded', c)} />{l}</span>)}
        <span>Numbers = yield in that month as % of the crop's normal month (latest year).</span>
      </div>
    </div>
  );
}

export default function Suggestions() {
  const { data } = useApi('/suggestions');
  const [tab, setTab] = useState('all');
  if (!data) return <Skeleton rows={2} />;
  const tabs = [['all', 'All'], ['now', 'This month'], ['upcoming', 'Next month'], ['season', 'Best season'], ['price', 'Price'], ['avoid', 'Weak month']].filter(([k]) => k === 'all' || data.suggestions.some((s) => s.type === k));
  const items = data.suggestions.filter((s) => tab === 'all' || s.type === tab);
  return (
    <div className="space-y-4">
      <PageHeader title={t('Smart suggestions')} subtitle={`Learned from your own harvest, temperature and price records · ${data.thisMonth}${data.currentTemp !== null ? ` · ${data.currentTemp} °C average so far` : ''}`} />
      <Card title="Season calendar" sub="How each crop did in each month, with the average temperature">
        <SeasonCalendar data={data} />
      </Card>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <Card><div className="pt-4"><SuggestionList items={items} /></div></Card>
      <p className="text-xs text-slate-500"><Icon name="info-circle-fill" className="text-blue-500" /> The more you record — daily harvest by bay, a temperature reading each day, crop cycles with area — the sharper these become. Suggestions for a crop start after {data.minMonths} months of records.</p>
    </div>
  );
}
