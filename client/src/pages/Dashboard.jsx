// Home dashboard. Owner/manager: money & decisions for the chosen period. Supervisor: today's field view.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, PageHeader, Spinner, Stat, Badge, Empty } from '../components/Ui';
import PeriodPicker, { initialPeriod } from '../components/PeriodPicker';
import { MoneyTrend, CostVsPrice, CropStack, ShareBars } from '../components/Charts';
import { useOptions } from '../components/Form';
import { AlertList } from './Alerts';
import { money, num, pct, fdate, cls } from '../utils';

function Today({ t, cur }) {
  const unsold = t.produce.filter((p) => p.available > 0);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card title="Plucked today" action={<Link to="/harvest" className="text-sm text-brand-700 font-medium">+ Add</Link>}>
        {t.harvest.length ? t.harvest.map((h) => (
          <div key={h.crop_id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: h.color }} />{h.crop}</span>
            <b className="tabular-nums">{num(h.qty)} {h.unit}</b>
          </div>
        )) : <p className="text-sm text-slate-500">No harvest entered today.</p>}
        {unsold.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">
            <b>Not yet sold today:</b> {unsold.map((u) => `${u.crop} ${u.grade} ${num(u.available)} ${u.unit}`).join(', ')}
          </div>
        )}
      </Card>
      {t.openOrders.length > 0 && (
        <Card title="Open vendor orders" action={<Link to="/sell" className="text-sm text-brand-700 font-medium">Fulfil</Link>}>
          {t.openOrders.slice(0, 6).map((o) => (
            <div key={o.id} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
              <span>{o.party} · {o.crop} {o.grade}</span><span className="tabular-nums font-semibold">{num(o.quantity)} <span className="text-slate-400 font-normal">{fdate(o.date)}</span></span>
            </div>
          ))}
        </Card>
      )}
      {t.attendance && (
        <Card title="Labour today" action={<Link to="/labour" className="text-sm text-brand-700 font-medium">Mark</Link>}>
          <div className="grid grid-cols-3 text-center">
            <div><div className="text-2xl font-bold text-brand-700">{num(t.attendance.present || 0)}</div><div className="text-xs text-slate-500">Present</div></div>
            <div><div className="text-2xl font-bold text-amber-600">{num(t.attendance.half || 0)}</div><div className="text-xs text-slate-500">Half day</div></div>
            <div><div className="text-2xl font-bold text-slate-400">{Math.max(0, t.attendance.workers - (t.attendance.present || 0) - (t.attendance.half || 0))}</div><div className="text-xs text-slate-500">Absent / not marked</div></div>
          </div>
        </Card>
      )}
      {t.tasks.length > 0 && (
        <Card title="Today's tasks" action={<Link to="/m/tasks" className="text-sm text-brand-700 font-medium">All</Link>}>
          {t.tasks.slice(0, 6).map((k) => (
            <div key={k.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
              <span className={cls(k.status === 'done' && 'line-through text-slate-400')}>{k.title}{k.worker ? ` · ${k.worker}` : ''}</span>
              <Badge tone={k.status === 'done' ? 'green' : 'amber'}>{k.status}</Badge>
            </div>
          ))}
        </Card>
      )}
      {t.locks.length > 0 && (
        <Card title="Harvest locked (spray)">
          {t.locks.map((l) => <div key={l.id} className="text-sm py-1"><Icon name="bi-lock-fill" className="text-red-600" /> {l.farm_name}{l.bay_name ? ' / ' + l.bay_name : ''} — safe from <b>{fdate(l.lock_until)}</b></div>)}
        </Card>
      )}
    </div>
  );
}

function Setup({ s }) {
  const steps = [
    [s.farms, 'Add your farm / polyhouse (size, rent)', '/m/farms?new=1'],
    [s.crops, 'Add crops you grow', '/m/crops?new=1'],
    [s.vendors, 'Add vendors you sell to', '/m/parties?new=1'],
    [s.prices, 'Set each vendor\'s price per crop', '/m/price_list?new=1'],
    [s.workers, 'Add workers with salaries', '/m/workers?new=1'],
    [s.users > 1, 'Create logins for supervisor / delivery / vendors', '/settings'],
  ];
  const left = steps.filter((x) => !x[0]);
  if (!left.length) return null;
  return (
    <Card title={`Set up your farm (${steps.length - left.length}/${steps.length} done)`} className="border-brand-300 bg-brand-50/40 mb-4">
      <div className="grid sm:grid-cols-2 gap-2">
        {steps.map(([done, text, to]) => (
          <Link key={text} to={to} className={cls('flex items-center gap-2 rounded-xl px-3 py-2 text-sm', done ? 'text-slate-400 line-through' : 'bg-white border border-slate-200 hover:border-brand-500 font-medium')}>
            <Icon name={done ? 'bi-check-circle-fill' : 'bi-circle'} className={done ? 'text-brand-600' : 'text-slate-400'} /> {text}
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { role, cur, on } = useAuth();
  const [period, setPeriod] = useState(initialPeriod('this_month'));
  const [farm, setFarm] = useState('');
  const [d, setD] = useState(null);
  const farms = useOptions('farms');

  useEffect(() => {
    setD(null);
    api.get('/dashboard', { from: period.from, to: period.to, group: period.group, farm_id: farm }).then(setD).catch(() => setD({ error: true }));
  }, [period, farm]);

  if (!d) return <Spinner />;
  if (d.error) return <Empty text="Could not load dashboard" />;

  if (d.role === 'field') {
    return (
      <div className="space-y-4">
        <PageHeader title="My farm today" subtitle={fdate(new Date().toISOString())} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[['/harvest', 'bi-basket', 'Harvest'], ['/sell', 'bi-truck', 'Sell'], ['/labour', 'bi-people', 'Attendance'], ['/m/fertigation_logs?new=1', 'bi-droplet-half', 'EC / pH']].filter(([to]) => to !== '/labour' || on('labour')).map(([to, i, l]) => (
            <Link key={to} to={to} className="card py-4 flex flex-col items-center gap-1 font-medium text-sm"><Icon name={i} className="text-2xl text-brand-700" />{l}</Link>
          ))}
        </div>
        <Today t={d.today} cur={cur} />
        <Card title="Alerts"><AlertList alerts={d.alerts} /></Card>
      </div>
    );
  }

  const s = d.summary; const T = s.totals; const P = d.prev;
  const sold = s.byCrop.filter((c) => c.sold > 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard">
        <PeriodPicker value={period} onChange={setPeriod} />
        {farms.length > 1 && (
          <select className="input !w-auto !py-2" value={farm} onChange={(e) => setFarm(e.target.value)}>
            <option value="">All farms</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        )}
      </PageHeader>

      {role === 'admin' && <Setup s={d.setup} />}

      <div className="card px-4 py-3 bg-gradient-to-r from-brand-700 to-brand-600 text-white border-0">
        <div className="text-xs uppercase tracking-wider text-brand-100 font-semibold"><Icon name="bi-lightbulb" /> {fdate(s.from)} – {fdate(s.to)}</div>
        <p className="mt-1 text-[15px] leading-snug font-medium">{d.finding}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Sales" value={money(T.revenue, cur)} delta={pct(T.revenue, P.revenue)} sub="vs prev." icon="bi-graph-up" tone="blue" />
        <Stat label="Expenses" value={money(T.expenses, cur)} delta={pct(T.expenses, P.expenses)} good="down" sub="vs prev." icon="bi-wallet2" tone="amber" />
        <Stat label={T.profit >= 0 ? 'Profit' : 'Loss'} value={money(T.profit, cur)} sub={`${T.margin}% margin`} icon="bi-piggy-bank" tone={T.profit >= 0 ? 'green' : 'red'} />
        <Stat label="Harvested" value={num(T.harvested, 0)} sub={`sold ${num(T.sold, 0)} · ${T.sell_through}%`} delta={pct(T.harvested, P.harvested)} icon="bi-basket" tone="green" />
        <Stat label="Collected" value={money(T.collected, cur)} sub="payments in" icon="bi-cash-coin" tone="blue" />
        <Link to="/vendors"><Stat label="Overdue" value={money(T.overdue, cur)} sub={`of ${money(T.receivable, cur)} due`} icon="bi-alarm" tone={T.overdue > 0 ? 'red' : 'slate'} /></Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 items-start">
        <Card title={`Sales vs expenses (by ${s.group})`} className="xl:col-span-2">
          {s.trend.length ? <MoneyTrend data={s.trend} cur={cur} /> : <Empty />}
        </Card>
        <Card title="Needs attention" action={<Link to="/alerts" className="text-sm text-brand-700 font-medium">All {d.alerts.length}</Link>}>
          <AlertList alerts={d.alerts} limit={6} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Cost vs price per unit, by crop" action={<Link to="/reports" className="text-sm text-brand-700 font-medium">Details</Link>}>
          {sold.length ? <CostVsPrice data={sold} cur={cur} /> : <Empty />}
          <p className="text-xs text-slate-500 mt-1">If orange is taller than blue, that crop is losing money.</p>
        </Card>
        <Card title="Quantity sold by crop">
          {s.cropTrend.length ? <CropStack data={s.cropTrend} crops={sold} /> : <Empty />}
        </Card>
      </div>

      <Card title="Crops" pad={false} className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Crop</th><th className="num">Harvested</th><th className="num">Sold</th><th className="num">Rejected</th><th className="num">Sales</th><th className="num">Avg price</th><th className="num">Cost/unit</th><th className="num">Profit</th><th className="num">Margin</th></tr></thead>
          <tbody>
            {s.byCrop.map((c) => (
              <tr key={c.crop_id}>
                <td><span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ background: c.color }} />{c.crop}</td>
                <td className="num">{num(c.harvested)} {c.unit}</td><td className="num">{num(c.sold)}</td><td className="num">{num(c.rejected)}</td>
                <td className="num font-semibold">{money(c.revenue, cur)}</td><td className="num">{money(c.avg_price, cur)}</td><td className="num">{money(c.cost_per_unit, cur)}</td>
                <td className={cls('num font-semibold', c.profit < 0 ? 'text-red-600' : 'text-brand-700')}>{money(c.profit, cur)}</td><td className="num">{c.margin}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!s.byCrop.length && <Empty />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Vendors" pad={false} className="xl:col-span-2 overflow-x-auto" action={<Link to="/vendors" className="text-sm text-brand-700 font-medium pr-1">Vendor dashboard</Link>}>
          <table className="tbl">
            <thead><tr><th>Vendor</th><th className="num">Qty</th><th className="num">Sales</th><th className="num">Rejection</th><th className="num">Received</th><th className="num">Due now</th><th className="num">Overdue</th></tr></thead>
            <tbody>
              {s.byVendor.map((v) => (
                <tr key={v.party_id}>
                  <td className="font-medium">{v.name}</td><td className="num">{num(v.qty)}</td><td className="num">{money(v.revenue, cur)}</td>
                  <td className={cls('num', v.rejection_pct > 5 && 'text-red-600 font-semibold')}>{v.rejection_pct}%</td>
                  <td className="num">{money(v.payments, cur)}</td><td className="num">{money(v.balance, cur)}</td>
                  <td className={cls('num', v.overdue > 0 && 'text-red-600 font-semibold')}>{money(v.overdue, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!s.byVendor.length && <Empty />}
        </Card>
        <Card title="Where the money went">{s.byCategory.length ? <ShareBars data={s.byCategory} labelKey="category" valueKey="amount" cur={cur} /> : <Empty />}</Card>
      </div>

      {s.labour && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Man-days" value={num(s.labour.mandays)} sub={`${s.labour.workers} workers`} icon="bi-people" />
          <Stat label="Labour cost" value={money(s.labour.cost, cur)} icon="bi-person-badge" />
          <Stat label="Labour cost / unit" value={money(s.labour.cost_per_unit, cur)} sub="per unit harvested" icon="bi-calculator" />
          <Stat label="Rejected" value={num(T.rejected)} sub={`${T.sold ? ((100 * T.rejected) / T.sold).toFixed(1) : 0}% of sold`} icon="bi-x-octagon" tone={T.rejected / (T.sold || 1) > 0.05 ? 'red' : 'slate'} />
        </div>
      )}

      <h2 className="font-bold text-lg pt-2">Today</h2>
      <Today t={d.today} cur={cur} />
    </div>
  );
}
