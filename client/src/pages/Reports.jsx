// Reports with Day / Week / Month / custom dropdown. Every table can be exported to CSV (opens in Excel) or printed.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, PageHeader, Spinner, Stat, Empty } from '../components/Ui';
import PeriodPicker, { initialPeriod } from '../components/PeriodPicker';
import { MoneyTrend, CostVsPrice, ShareBars, CropStack } from '../components/Charts';
import { useOptions } from '../components/Form';
import { money, num, fdate, downloadCSV, cls, todayISO } from '../utils';

const TABS = [['overview', 'Overview'], ['crops', 'Crops'], ['vendors', 'Vendors'], ['sheet', 'Sales sheet'], ['expenses', 'Expenses'], ['farms', 'Farms'], ['pnl', 'P&L'], ['balance', 'Balance sheet'], ['daybook', 'Day book']];

function Table({ cols, rows, foot, cur }) {
  // cols: [key, label, type('money'|'num'|'pct'|'date'|fn)]
  const fmt = (c, r) => { const v = typeof c[0] === 'function' ? c[0](r) : r[c[0]]; return c[2] === 'money' ? money(v, cur) : c[2] === 'num' ? num(v) : c[2] === 'pct' ? `${v}%` : c[2] === 'date' ? fdate(v) : v ?? '—'; };
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={c[1]} className={c[2] && c[2] !== 'date' ? 'num' : ''}>{c[1]}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c[1]} className={cls(c[2] && c[2] !== 'date' && 'num', c[3] && c[3](r))}>{fmt(c, r)}</td>)}</tr>)}</tbody>
        {foot && <tfoot><tr className="font-semibold bg-slate-50">{cols.map((c, i) => <td key={c[1]} className={cls('px-3 py-2', c[2] && c[2] !== 'date' && 'num')}>{i === 0 ? 'Total' : foot[c[0]] !== undefined ? fmt(c, foot) : ''}</td>)}</tr></tfoot>}
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
const sumBy = (rows, keys) => Object.fromEntries(keys.map((k) => [k, rows.reduce((a, r) => a + Number(r[k] || 0), 0)]));
const Csv = ({ onClick }) => <button className="btn-light !py-1.5 text-xs" onClick={onClick}><Icon name="bi-download" /> CSV</button>;

export default function Reports() {
  const { cur, on } = useAuth();
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState(initialPeriod('this_month'));
  const [farm, setFarm] = useState('');
  const [s, setS] = useState(null);
  const [extra, setExtra] = useState(null);
  const [asOn, setAsOn] = useState(todayISO());
  const farms = useOptions('farms');
  const tabs = TABS.filter(([k]) => !['pnl', 'balance'].includes(k) || on('finance'));
  const P = { from: period.from, to: period.to, group: period.group, farm_id: farm };
  const name = (t) => `${t} ${period.from} to ${period.to}`;

  useEffect(() => { setS(null); api.get('/reports/summary', P).then(setS); }, [period, farm]); // eslint-disable-line
  useEffect(() => {
    setExtra(null);
    if (tab === 'pnl') api.get('/reports/pnl', P).then(setExtra);
    if (tab === 'balance') api.get('/reports/balance', { date: asOn }).then(setExtra);
    if (tab === 'sheet') api.get('/r/sales', { from: period.from, to: period.to, farm_id: farm, limit: 5000 }).then(setExtra);
    if (tab === 'daybook') api.get('/reports/daybook', { date: asOn }).then(setExtra);
  }, [tab, period, farm, asOn]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle={`${fdate(period.from)} – ${fdate(period.to)}`}>
        {!['balance', 'daybook'].includes(tab) ? <PeriodPicker value={period} onChange={setPeriod} /> : (
          <label className="flex items-center gap-2 text-sm">{tab === 'balance' ? 'As on' : 'Date'} <input type="date" className="input !w-auto !py-2" value={asOn} onChange={(e) => setAsOn(e.target.value)} /></label>
        )}
        {farms.length > 1 && !['balance', 'daybook'].includes(tab) && (
          <select className="input !w-auto !py-2" value={farm} onChange={(e) => setFarm(e.target.value)}><option value="">All farms</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        )}
        <button className="btn-outline" onClick={() => window.print()}><Icon name="bi-printer" /> <span className="hidden sm:inline">Print / PDF</span></button>
      </PageHeader>

      <div className="flex gap-1 overflow-x-auto no-print -mx-4 px-4 pb-1">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={k === tab ? 'chip-on whitespace-nowrap' : 'chip-off whitespace-nowrap'}>{l}</button>)}
      </div>

      {!s ? <Spinner /> : (
        <>
          {tab === 'overview' && (
            <div className="space-y-4">
              <Card><p className="text-[15px]"><Icon name="bi-lightbulb" className="text-brand-700" /> {s.finding}</p></Card>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Harvested" value={num(s.totals.harvested, 0)} sub={`culls ${num(s.totals.culls, 0)}`} />
                <Stat label="Sold" value={num(s.totals.sold, 0)} sub={`rejected ${num(s.totals.rejected, 0)}`} />
                <Stat label="Sales" value={money(s.totals.revenue, cur)} sub={`+ other ${money(s.totals.other_income, cur)}`} />
                <Stat label="Expenses" value={money(s.totals.expenses, cur)} sub={`+ depreciation ${money(s.totals.depreciation, cur)}`} />
                <Stat label="Profit" value={money(s.totals.profit, cur)} sub={`${s.totals.margin}% margin`} tone={s.totals.profit >= 0 ? 'green' : 'red'} />
                <Stat label="Collected" value={money(s.totals.collected, cur)} />
                <Stat label="Receivable" value={money(s.totals.receivable, cur)} />
                <Stat label="Overdue" value={money(s.totals.overdue, cur)} />
              </div>
              <Card title={`Trend by ${s.group}`} action={<Csv onClick={() => downloadCSV(name('Trend'), s.trend)} />}><MoneyTrend data={s.trend} cur={cur} /></Card>
              <Card title={`Trend table by ${s.group}`} pad={false}>
                <Table cur={cur} rows={s.trend} foot={sumBy(s.trend, ['harvest', 'sold', 'revenue', 'expenses', 'profit'])}
                  cols={[['bucket', s.group === 'month' ? 'Month' : s.group === 'week' ? 'Week from' : 'Date'], ['harvest', 'Harvested', 'num'], ['sold', 'Sold', 'num'], ['revenue', 'Sales', 'money'], ['expenses', 'Expenses', 'money'], ['profit', 'Sales − expenses', 'money', (r) => r.profit < 0 && 'text-red-600']]} />
              </Card>
              <p className="text-xs text-slate-500">Day-wise figure excludes depreciation; the Profit card above includes it.</p>
            </div>
          )}

          {tab === 'crops' && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Cost vs price"><CostVsPrice data={s.byCrop.filter((c) => c.sold)} cur={cur} /></Card>
                <Card title="Quantity sold by crop"><CropStack data={s.cropTrend} crops={s.byCrop.filter((c) => c.sold)} /></Card>
              </div>
              <Card title="Crop-wise quantity, sales & profit" pad={false} action={<Csv onClick={() => downloadCSV(name('Crops'), s.byCrop)} />}>
                <Table cur={cur} rows={s.byCrop} foot={sumBy(s.byCrop, ['harvested', 'culls', 'sold', 'rejected', 'revenue', 'direct_cost', 'shared_cost', 'cost', 'profit'])} cols={[
                  ['crop', 'Crop'], ['harvested', 'Harvested', 'num'], ['a_grade_pct', 'A grade', 'pct'], ['culls', 'Culls', 'num'], ['sold', 'Sold', 'num'], ['rejected', 'Rejected', 'num'],
                  ['revenue', 'Sales', 'money'], ['avg_price', 'Avg price', 'money'], ['direct_cost', 'Direct cost', 'money'], ['shared_cost', 'Shared cost', 'money'],
                  ['cost_per_unit', 'Cost/unit', 'money'], ['profit', 'Profit', 'money', (r) => (r.profit < 0 ? 'text-red-600 font-semibold' : 'text-brand-700 font-semibold')], ['margin', 'Margin', 'pct']]} />
              </Card>
              <p className="text-xs text-slate-500">Direct cost = expenses tagged to a crop cycle. Shared cost (rent, current, labour, depreciation…) is split by area × days of each crop cycle; if no cycles, by sales share.</p>
            </div>
          )}

          {tab === 'vendors' && (
            <div className="space-y-4">
              <Card title="Vendor-wise sales & dues" pad={false} action={<Csv onClick={() => downloadCSV(name('Vendors'), s.byVendor.map(({ crops, ...v }) => v))} />}>
                <Table cur={cur} rows={s.byVendor} foot={sumBy(s.byVendor, ['deliveries', 'qty', 'rejected', 'revenue', 'payments', 'balance', 'overdue'])} cols={[
                  ['name', 'Vendor'], ['deliveries', 'Deliveries', 'num'], ['qty', 'Qty', 'num'], ['rejected', 'Rejected', 'num'], ['rejection_pct', 'Rej %', 'pct', (r) => r.rejection_pct > 5 && 'text-red-600'],
                  ['revenue', 'Sales', 'money'], ['payments', 'Received', 'money'], ['balance', 'Due now', 'money'], ['overdue', 'Overdue', 'money', (r) => r.overdue > 0 && 'text-red-600 font-semibold'], ['credit_days', 'Credit days', 'num'], ['last_sale', 'Last sale', 'date']]} />
              </Card>
              <Card title="Price matrix — average rate each vendor paid" pad={false} action={<Csv onClick={() => downloadCSV(name('Price matrix'), s.priceMatrix.rows.map((r) => ({ vendor: r.name, ...Object.fromEntries(s.priceMatrix.crops.map((c) => [c.crop, r.rates[c.crop_id] ?? ''])) })))} />}>
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Vendor</th>{s.priceMatrix.crops.map((c) => <th key={c.crop_id} className="num">{c.crop}</th>)}</tr></thead>
                    <tbody>
                      {s.priceMatrix.rows.map((r) => (
                        <tr key={r.party_id}><td className="font-medium">{r.name}</td>
                          {s.priceMatrix.crops.map((c) => {
                            const v = r.rates[c.crop_id]; const best = Math.max(...s.priceMatrix.rows.map((x) => x.rates[c.crop_id] || 0));
                            return <td key={c.crop_id} className={cls('num', v && v === best && 'text-brand-700 font-bold', v && v < c.avg * 0.9 && 'text-red-600')}>{v ? money(v, cur) : '—'}</td>;
                          })}
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold"><td>Average</td>{s.priceMatrix.crops.map((c) => <td key={c.crop_id} className="num">{money(c.avg, cur)}</td>)}</tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 px-4 py-2">Green = best price for that crop. Red = more than 10% below average.</p>
              </Card>
            </div>
          )}

          {tab === 'sheet' && (!extra ? <Spinner /> : (
            <Card title={`Sales sheet — ${extra.length} entries`} pad={false} action={<Csv onClick={() => downloadCSV(name('Sales sheet'), extra, [['date', 'Date'], ['party_id_label', 'Vendor'], ['crop_id_label', 'Crop'], ['grade', 'Grade'], ['quantity', 'Qty'], ['rejected_qty', 'Rejected'], ['rate', 'Rate'], ['amount', 'Amount'], ['status', 'Status'], ['invoice_no', 'Slip'], ['farm_id_label', 'Farm']])} />}>
              <Table cur={cur} rows={extra} foot={sumBy(extra, ['quantity', 'rejected_qty', 'amount'])} cols={[
                ['date', 'Date', 'date'], ['party_id_label', 'Vendor'], ['crop_id_label', 'Crop'], ['grade', 'Grade'], ['quantity', 'Qty', 'num'], ['rejected_qty', 'Rejected', 'num'], ['rate', 'Rate', 'money'], ['amount', 'Amount', 'money'], ['status', 'Status']]} />
            </Card>
          ))}

          {tab === 'expenses' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Expenses by category"><ShareBars data={s.byCategory} labelKey="category" valueKey="amount" cur={cur} max={12} /></Card>
              <Card title="Category table" pad={false} action={<Csv onClick={() => downloadCSV(name('Expenses'), s.byCategory)} />}>
                <Table cur={cur} rows={s.byCategory} foot={sumBy(s.byCategory, ['entries', 'amount'])} cols={[['category', 'Category'], ['kind', 'Kind'], ['entries', 'Entries', 'num'], ['amount', 'Amount', 'money']]} />
              </Card>
              {s.labour && (
                <Card title="Labour" className="lg:col-span-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div><div className="text-xl font-bold">{num(s.labour.mandays)}</div><div className="text-xs text-slate-500">Man-days</div></div>
                    <div><div className="text-xl font-bold">{s.labour.workers}</div><div className="text-xs text-slate-500">Workers</div></div>
                    <div><div className="text-xl font-bold">{money(s.labour.cost, cur)}</div><div className="text-xs text-slate-500">Wages booked</div></div>
                    <div><div className="text-xl font-bold">{money(s.labour.cost_per_unit, cur)}</div><div className="text-xs text-slate-500">Labour cost / unit</div></div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {tab === 'farms' && (
            <Card title="Farm-wise (FPO members / locations)" pad={false} action={<Csv onClick={() => downloadCSV(name('Farms'), s.byFarm)} />}>
              <Table cur={cur} rows={s.byFarm} foot={sumBy(s.byFarm, ['harvest', 'revenue', 'expenses', 'profit'])} cols={[
                ['name', 'Farm'], ['member', 'Member'], ['acres', 'Acres', 'num'], ['harvest', 'Harvested', 'num'], ['revenue', 'Sales', 'money'], ['expenses', 'Expenses', 'money'],
                ['profit', 'Profit', 'money', (r) => r.profit < 0 && 'text-red-600'], [(r) => (r.acres ? Math.round(r.profit / r.acres) : null), 'Profit / acre', 'money']]} />
              <p className="text-xs text-slate-500 px-4 py-2">Tag sales and expenses with a farm to see them here. Untagged costs show as "Shared".</p>
            </Card>
          )}

          {tab === 'pnl' && (!extra ? <Spinner /> : (
            <Card title={`Profit & Loss — ${fdate(extra.from)} to ${fdate(extra.to)}`} action={<Csv onClick={() => downloadCSV(name('P&L'), [...extra.income.map((i) => ({ section: 'Income', name: i.name, amount: i.amount })), ...extra.other_income.map((i) => ({ section: 'Other income', name: i.source, amount: i.amount })), ...extra.expenses.map((e) => ({ section: 'Expense', name: e.name, amount: e.amount })), { section: 'Expense', name: 'Depreciation', amount: extra.depreciation }, { section: 'Net', name: 'Net profit', amount: extra.net_profit }])} />}>
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                <div>
                  <h3 className="font-semibold text-brand-800 mb-2">Income</h3>
                  {extra.income.map((i) => <div key={i.name} className="flex justify-between py-1 border-b border-slate-100 text-sm"><span>{i.name} <span className="text-slate-400">({num(i.qty)} {i.unit})</span></span><span className="tabular-nums">{money(i.amount, cur)}</span></div>)}
                  {extra.other_income.map((i) => <div key={i.source} className="flex justify-between py-1 border-b border-slate-100 text-sm"><span>{i.source}</span><span className="tabular-nums">{money(i.amount, cur)}</span></div>)}
                  <div className="flex justify-between py-2 font-bold"><span>Total income</span><span className="tabular-nums">{money(extra.total_income, cur)}</span></div>
                </div>
                <div>
                  <h3 className="font-semibold text-orange-700 mb-2">Expenses</h3>
                  {extra.expenses.map((e) => <div key={e.name} className="flex justify-between py-1 border-b border-slate-100 text-sm"><span>{e.name}</span><span className="tabular-nums">{money(e.amount, cur)}</span></div>)}
                  {extra.depreciation > 0 && <div className="flex justify-between py-1 border-b border-slate-100 text-sm"><span>Depreciation (assets)</span><span className="tabular-nums">{money(extra.depreciation, cur)}</span></div>}
                  <div className="flex justify-between py-2 font-bold"><span>Total expenses</span><span className="tabular-nums">{money(extra.total_expenses, cur)}</span></div>
                </div>
              </div>
              <div className={cls('mt-4 rounded-xl px-4 py-3 flex justify-between text-lg font-bold max-w-4xl', extra.net_profit >= 0 ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700')}>
                <span>Net {extra.net_profit >= 0 ? 'profit' : 'loss'}</span><span className="tabular-nums">{money(extra.net_profit, cur)}</span>
              </div>
            </Card>
          ))}

          {tab === 'balance' && (!extra ? <Spinner /> : (
            <div className="space-y-4">
              <Card title={`Balance sheet as on ${fdate(extra.as_on)}`}>
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                  <div>
                    <h3 className="font-semibold text-brand-800 mb-2">What you own</h3>
                    {extra.assets.map((a) => <div key={a.name} className="flex justify-between py-1 border-b border-slate-100 text-sm"><span>{a.name}</span><span className="tabular-nums">{money(a.amount, cur)}</span></div>)}
                    <div className="flex justify-between py-2 font-bold"><span>Total assets</span><span className="tabular-nums">{money(extra.total_assets, cur)}</span></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-orange-700 mb-2">What you owe</h3>
                    {extra.liabilities.map((a) => <div key={a.name} className="flex justify-between py-1 border-b border-slate-100 text-sm"><span>{a.name}</span><span className="tabular-nums">{money(a.amount, cur)}</span></div>)}
                    <div className="flex justify-between py-2 font-bold"><span>Total liabilities</span><span className="tabular-nums">{money(extra.total_liabilities, cur)}</span></div>
                    <div className="flex justify-between py-2 font-bold text-brand-800 border-t border-slate-200"><span>Net worth (owner's capital)</span><span className="tabular-nums">{money(extra.net_worth, cur)}</span></div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">Cash = opening cash (Settings) + money received − money paid since {extra.books_start ? fdate(extra.books_start) : 'start'}. Management view, not a statutory audit.</p>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Receivable from vendors" pad={false}><Table cur={cur} rows={extra.receivables} cols={[['name', 'Vendor'], ['balance', 'Due', 'money'], ['overdue', 'Overdue', 'money', (r) => r.overdue > 0 && 'text-red-600'], ['last_payment', 'Last paid', 'date']]} /></Card>
                <Card title="Payable to suppliers" pad={false}><Table cur={cur} rows={extra.payables} cols={[['name', 'Supplier'], ['due', 'Due', 'money']]} /></Card>
              </div>
            </div>
          ))}

          {tab === 'daybook' && (!extra ? <Spinner /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={`Harvest (${extra.harvests.length})`} pad={false}><Table cur={cur} rows={extra.harvests} foot={sumBy(extra.harvests, ['quantity'])} cols={[['crop', 'Crop'], ['grade', 'Grade'], ['farm', 'Farm'], ['quantity', 'Qty', 'num']]} /></Card>
              <Card title={`Sales (${extra.sales.length})`} pad={false}><Table cur={cur} rows={extra.sales} foot={sumBy(extra.sales, ['quantity', 'amount'])} cols={[['party', 'Vendor'], ['crop', 'Crop'], ['quantity', 'Qty', 'num'], ['rate', 'Rate', 'money'], ['amount', 'Amount', 'money'], ['delivered_by_name', 'By']]} /></Card>
              <Card title={`Expenses (${extra.expenses.length})`} pad={false}><Table cur={cur} rows={extra.expenses} foot={sumBy(extra.expenses, ['amount'])} cols={[['category', 'Category'], ['description', 'What'], ['party', 'Paid to'], ['amount', 'Amount', 'money']]} /></Card>
              <Card title={`Payments received (${extra.payments.length})`} pad={false}><Table cur={cur} rows={extra.payments} foot={sumBy(extra.payments, ['amount'])} cols={[['party', 'Vendor'], ['mode', 'Mode'], ['amount', 'Amount', 'money']]} /></Card>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
