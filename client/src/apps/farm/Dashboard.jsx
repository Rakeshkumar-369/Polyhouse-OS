// Home dashboard. Owner/manager: money & decisions for the chosen period. Supervisor: today's field view.
import { useState } from 'react';
import { useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Link } from '../../lib/router';
import { t } from '../../lib/i18n';
import { money, num, pct, fdate, cls, initialPeriod, shortMoney, C } from '../../lib/format';
import { Card, Icon, PageHeader, Stat, Badge, Empty, Skeleton, ErrorBox, Progress } from '../../ui/kit';
import { BarChart, LineChart, ShareBars, Sparkline } from '../../ui/charts';
import { useOptions } from '../../ui/Form';
import PeriodPicker from '../../ui/PeriodPicker';
import { AlertList } from './Alerts';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function QuickActions({ on }) {
  const items = [['/sell', 'truck', 'Sell', 'sales'], ['/harvest', 'basket', 'Harvest', 'harvest'], ['/spend', 'wallet2', 'Spend', 'expenses'], ['/labour', 'people', 'Attendance', 'labour']].filter((x) => on(x[3]));
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(([to, i, l]) => (
        <Link key={to} to={to} className="card py-3 flex flex-col items-center gap-1 text-[13px] font-semibold text-slate-700 hover:border-brand-400 active:bg-slate-50">
          <span className="h-10 w-10 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center text-lg"><Icon name={i} /></span>{t(l)}
        </Link>
      ))}
    </div>
  );
}

export function Today({ d }) {
  const unsold = d.produce.filter((p) => p.available > 0);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card title={t('Plucked today')} action={<Link to="/harvest" className="text-sm text-brand-700 font-semibold">+ {t('Add')}</Link>}>
        {d.harvest.length ? d.harvest.map((h) => (
          <div key={h.crop_id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: h.color }} />{h.crop}</span>
            <b className="tabular-nums">{num(h.qty)} {h.unit}</b>
          </div>
        )) : <p className="text-sm text-slate-500">No harvest entered today.</p>}
        {unsold.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm"><b>Not sold yet:</b> {unsold.map((u) => `${u.crop} ${u.grade} ${num(u.available)}`).join(' · ')}</div>}
      </Card>
      {d.openOrders.length > 0 && (
        <Card title={t('Open vendor orders')} action={<Link to="/sell" className="text-sm text-brand-700 font-semibold">Fulfil</Link>}>
          {d.openOrders.slice(0, 6).map((o) => (
            <div key={o.id} className="flex justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0 text-sm">
              <span className="truncate">{o.party} · {o.crop} {o.grade}</span><span className="tabular-nums font-semibold shrink-0">{num(o.quantity)} <span className="text-slate-400 font-normal">{fdate(o.date)}</span></span>
            </div>
          ))}
        </Card>
      )}
      {d.attendance && (
        <Card title={t('Labour today')} action={<Link to="/labour" className="text-sm text-brand-700 font-semibold">Mark</Link>}>
          <div className="grid grid-cols-3 text-center">
            <div><div className="text-2xl font-bold text-brand-700">{num(d.attendance.present || 0)}</div><div className="text-xs text-slate-500">{t('present')}</div></div>
            <div><div className="text-2xl font-bold text-amber-600">{num(d.attendance.half || 0)}</div><div className="text-xs text-slate-500">{t('half')}</div></div>
            <div><div className="text-2xl font-bold text-slate-400">{Math.max(0, d.attendance.workers - (d.attendance.present || 0) - (d.attendance.half || 0))}</div><div className="text-xs text-slate-500">not marked</div></div>
          </div>
        </Card>
      )}
      {d.tasks.length > 0 && (
        <Card title={t("Today's tasks")} action={<Link to="/m/tasks" className="text-sm text-brand-700 font-semibold">All</Link>}>
          {d.tasks.slice(0, 6).map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0 text-sm">
              <span className={cls('truncate', k.status === 'done' && 'line-through text-slate-400')}>{k.title}{k.worker ? ` · ${k.worker}` : ''}</span>
              <Badge tone={k.status === 'done' ? 'green' : 'amber'}>{t(k.status)}</Badge>
            </div>
          ))}
        </Card>
      )}
      {d.locks.length > 0 && (
        <Card title={t('Harvest locked (spray)')}>
          {d.locks.map((l) => <div key={l.id} className="text-sm py-1"><Icon name="lock-fill" className="text-red-600" /> {l.farm_name}{l.bay_name ? ' / ' + l.bay_name : ''} — safe from <b>{fdate(l.lock_until)}</b></div>)}
        </Card>
      )}
    </div>
  );
}

function Setup({ s }) {
  const steps = [
    [s.farms, 'Add your farm / polyhouse', '/m/farms?new=1'], [s.crops, 'Add crops you grow', '/m/crops?new=1'],
    [s.vendors, 'Add vendors you sell to', '/m/parties?new=1'], [s.prices, "Set each vendor's price", '/m/price_list?new=1'],
    [s.workers, 'Add workers with pay', '/m/workers?new=1'], [s.users > 1, 'Create logins for your team', '/settings'],
  ];
  const left = steps.filter((x) => !x[0]);
  if (!left.length) return null;
  return (
    <Card title={`${t('Finish setting up')} (${steps.length - left.length}/${steps.length})`} className="border-brand-200 bg-brand-50/50">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {steps.map(([done, text, to]) => (
          <Link key={text} to={to} className={cls('flex items-center gap-2 rounded-xl px-3 py-2 text-sm', done ? 'text-slate-400 line-through' : 'bg-white border border-slate-200 hover:border-brand-500 font-medium')}>
            <Icon name={done ? 'check-circle-fill' : 'circle'} className={done ? 'text-brand-600' : 'text-slate-400'} /> {t(text)}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function FieldHome({ d }) {
  const { meta } = useAuth();
  return (
    <div className="space-y-4">
      <PageHeader title={t('My farm today')} subtitle={`${t(greet())}, ${meta.user.name.split(' ')[0]} · ${fdate(new Date().toISOString())}`} />
      <QuickActions on={useAuth().on} />
      <Today d={d.today} />
      <Card title={t('Alerts')}><AlertList alerts={d.alerts} /></Card>
    </div>
  );
}

export default function Dashboard() {
  const { role, cur, on, meta } = useAuth();
  const [period, setPeriod] = useState(initialPeriod('this_month'));
  const [farm, setFarm] = useState('');
  const farms = useOptions('farms');
  const { data: d, error, reload } = useApi('/dashboard', { from: period.from, to: period.to, group: period.group, farm_id: farm });

  if (error && !d) return <ErrorBox text={error} onRetry={reload} />;
  if (!d) return <Skeleton rows={3} />;
  if (d.role === 'field') return <FieldHome d={d} />;

  const s = d.summary; const T = s.totals; const P = d.prev; const I = d.insights;
  const sold = s.byCrop.filter((c) => c.sold > 0);
  const spark = (k) => <Sparkline values={s.trend.map((x) => x[k])} color={C[k] || C.revenue} />;
  const cropsSeries = sold.map((c) => ({ key: c.crop, name: c.crop, color: c.color }));

  return (
    <div className="space-y-4">
      <PageHeader title={`${t(greet())}, ${meta.user.name.split(' ')[0]}`} subtitle={`${meta.org.name} · ${fdate(s.from)} – ${fdate(s.to)}`}>
        <PeriodPicker value={period} onChange={setPeriod} />
        {farms.length > 1 && (
          <select className="input !w-auto !py-2" value={farm} onChange={(e) => setFarm(e.target.value)} aria-label="Farm">
            <option value="">{t('All farms')}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        )}
      </PageHeader>

      {role === 'admin' && <Setup s={d.setup} />}

      <div className="rounded-2xl px-4 py-3.5 bg-gradient-to-r from-brand-800 to-brand-600 text-white shadow-sm">
        <div className="text-[11px] uppercase tracking-wider text-brand-100 font-semibold"><Icon name="lightbulb" /> {t('In one line')}</div>
        <p className="mt-1 text-[15px] leading-snug font-medium">{d.finding}</p>
      </div>

      <div className="lg:hidden"><QuickActions on={on} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label={t('Sales')} value={money(T.revenue, cur)} delta={pct(T.revenue, P.revenue)} sub={t('vs prev.')} icon="graph-up" tone="blue" spark={spark('revenue')} />
        <Stat label={t('Expenses')} value={money(T.expenses, cur)} delta={pct(T.expenses, P.expenses)} good="down" sub={t('vs prev.')} icon="wallet2" tone="amber" spark={spark('expenses')} />
        <Stat label={T.profit >= 0 ? t('Profit') : t('Loss')} value={money(T.profit, cur)} sub={`${T.margin}% ${t('margin')}`} icon="piggy-bank" tone={T.profit >= 0 ? 'green' : 'red'} delta={pct(T.profit, P.profit)} />
        <Stat label={t('Harvested')} value={num(T.harvested, 0)} sub={`${T.sell_through}% ${t('sold')}`} delta={pct(T.harvested, P.harvested)} icon="basket" tone="green" />
        <Stat label={t('Avg price')} value={money(T.avg_price, cur)} sub={`${T.rejection_pct}% ${t('rejected')}`} delta={pct(T.avg_price, P.avg_price)} icon="tags" tone="violet" />
        {I.cash !== null
          ? <Stat label={t('Cash in hand')} value={money(I.cash, cur)} sub={`${shortMoney(T.collected, cur)} ${t('collected')}`} icon="cash-coin" tone="blue" />
          : <Stat label={t('Collected')} value={money(T.collected, cur)} sub="payments in" icon="cash-coin" tone="blue" />}
      </div>

      <div className="grid gap-4 xl:grid-cols-3 items-start">
        <Card title={`${t('Sales vs expenses')} · ${t('by ' + s.group)}`} className="xl:col-span-2">
          {s.trend.length ? <BarChart data={s.trend} series={[{ key: 'revenue', name: t('Sales'), color: C.revenue }, { key: 'expenses', name: t('Expenses'), color: C.expenses }]} line={{ key: 'profit', name: t('Profit'), color: C.profit }} tipFmt={(v) => money(v, cur)} /> : <Empty />}
        </Card>
        <Card title={t('Needs attention')} action={<Link to="/alerts" className="text-sm text-brand-700 font-semibold">All {d.alerts.length}</Link>}>
          <AlertList alerts={d.alerts} limit={5} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t('Cost vs price per unit, by crop')} sub="If orange is taller than blue, that crop is losing money">
          {sold.length ? <BarChart data={sold} x="crop" xFmt={(v) => v} series={[{ key: 'avg_price', name: 'Price / unit', color: C.revenue }, { key: 'cost_per_unit', name: 'Cost / unit', color: C.expenses }]} tipFmt={(v) => money(v, cur)} fmt={(v) => cur + v} /> : <Empty />}
        </Card>
        <Card title={t('Price trend')} sub={`Average price per unit · ${t('by ' + s.group)}`}>
          {s.priceTrend.length ? <LineChart data={s.priceTrend} series={cropsSeries} tipFmt={(v) => money(v, cur)} fmt={(v) => cur + v} /> : <Empty />}
        </Card>
      </div>

      <Card title={t('Crops')} pad={false} className="overflow-x-auto" action={<Link to="/reports" className="text-sm text-brand-700 font-semibold">{t('Reports')}</Link>}>
        <table className="tbl">
          <thead><tr><th>{t('Crop')}</th><th className="num">{t('Harvested')}</th><th className="num">A grade</th><th className="num">Sold</th><th className="num">{t('Sales')}</th><th className="num">Price/unit</th><th className="num">Cost/unit</th><th className="num">{t('Profit')}</th><th className="num">Margin</th></tr></thead>
          <tbody>
            {s.byCrop.map((c) => (
              <tr key={c.crop_id}>
                <td className="font-medium"><span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ background: c.color }} />{c.crop}</td>
                <td className="num">{num(c.harvested)} {c.unit}</td><td className="num">{c.a_grade_pct}%</td><td className="num">{num(c.sold)}</td>
                <td className="num font-semibold">{money(c.revenue, cur)}</td><td className="num">{money(c.avg_price, cur)}</td><td className="num">{money(c.cost_per_unit, cur)}</td>
                <td className={cls('num font-semibold', c.profit < 0 ? 'text-red-600' : 'text-brand-700')}>{money(c.profit, cur)}</td><td className="num">{c.margin}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!s.byCrop.length && <Empty />}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('Who owes how long')} sub={`${money(I.receivable, cur)} due · collected in ~${I.dso} days on average`} action={<Link to="/vendors" className="text-sm text-brand-700 font-semibold">{t('Vendors')}</Link>}>
          <ShareBars data={I.ageing.filter((a) => a.amount > 0)} labelKey="label" valueKey="amount" cur={cur} color="#e34948" />
          {!I.ageing.some((a) => a.amount > 0) && <Empty icon="emoji-smile" text="Nobody owes you money" />}
        </Card>
        <Card title={t('Best paying vendor per crop')} sub="Grow sales with these vendors">
          {s.bestVendor.length ? s.bestVendor.map((b) => (
            <div key={b.crop} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0 text-sm">
              <div className="min-w-0"><div className="font-medium truncate">{b.crop}</div><div className="text-xs text-slate-500 truncate">{b.vendor}</div></div>
              <div className="text-right shrink-0"><div className="font-semibold tabular-nums">{money(b.rate, cur)}</div><div className="text-xs text-brand-700">{b.avg ? `+${Math.round((100 * (b.rate - b.avg)) / b.avg)}% vs avg` : ''}</div></div>
            </div>
          )) : <Empty />}
        </Card>
        <Card title={t('Where the money went')}>{s.byCategory.length ? <ShareBars data={s.byCategory} labelKey="category" valueKey="amount" cur={cur} max={6} /> : <Empty />}</Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {I.cycles.length > 0 && (
          <Card title={t('Crop cycles vs target')} className="lg:col-span-2" action={<Link to="/m/crop_cycles" className="text-sm text-brand-700 font-semibold">All</Link>}>
            <div className="space-y-3">
              {I.cycles.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between gap-2 text-sm mb-1">
                    <span className="truncate"><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ background: c.color }} /><b className="font-medium">{c.name}</b> <span className="text-slate-500">· {c.farm}{c.age_days !== null ? ` · day ${c.age_days}` : ''}</span></span>
                    <span className="tabular-nums shrink-0">{num(c.harvested, 0)}{c.target_yield_kg ? ` / ${num(c.target_yield_kg, 0)}` : ''} {c.unit}{c.yield_sqm !== null ? <span className="text-slate-500"> · {c.yield_sqm}/m²</span> : ''}</span>
                  </div>
                  {c.target_pct !== null && <Progress value={c.target_pct} tone={c.target_pct >= 75 ? 'green' : c.target_pct >= 40 ? 'amber' : 'red'} />}
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card title={t('Best selling days')} sub="Average sales per weekday" className={I.cycles.length ? '' : 'lg:col-span-3'}>
          <BarChart data={s.weekday} x="day" xFmt={(v) => v} series={[{ key: 'avg', name: t('Sales'), color: C.revenue }]} height={180} tipFmt={(v) => money(v, cur)} />
        </Card>
      </div>

      {s.labour && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={t('Man-days')} value={num(s.labour.mandays)} sub={`${s.labour.workers} workers`} icon="people" />
          <Stat label={t('Labour cost')} value={money(s.labour.cost, cur)} icon="person-badge" />
          <Stat label="Labour cost / unit" value={money(s.labour.cost_per_unit, cur)} sub="per unit harvested" icon="calculator" />
          <Stat label={t('Profit / acre')} value={T.acres ? money(T.profit_per_acre, cur) : '—'} sub={`${num(T.acres)} acres · ${T.wastage_pct}% waste`} icon="map" tone="green" />
        </div>
      )}

      <h2 className="font-bold text-lg pt-2">{t('Today')}</h2>
      <Today d={d.today} />
    </div>
  );
}
