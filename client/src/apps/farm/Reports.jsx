// Reports with the Day / Week / Month / FY / custom dropdown. Every table exports to Excel (CSV) or prints.
import { useState } from 'react';
import { useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { money, num, fdate, downloadCSV, cls, todayISO, initialPeriod, C } from '../../lib/format';
import { Card, Icon, PageHeader, Spinner, Stat, Empty, Tabs } from '../../ui/kit';
import { BarChart, LineChart, ShareBars } from '../../ui/charts';
import { useOptions } from '../../ui/Form';
import PeriodPicker from '../../ui/PeriodPicker';

const TABS = [['overview', 'Overview'], ['crops', 'Crops'], ['vendors', 'Vendors'], ['sheet', 'Sales sheet'], ['expenses', 'Expenses'], ['farms', 'Farms'], ['pnl', 'P&L'], ['balance', 'Balance sheet'], ['daybook', 'Day book']];

// cols: [key|fn, label, 'money'|'num'|'pct'|'date', classFn]
function Table({ cols, rows, foot, cur }) {
  const fmt = (c, r) => { const v = typeof c[0] === 'function' ? c[0](r) : r[c[0]]; return c[2] === 'money' ? money(v, cur) : c[2] === 'num' ? num(v) : c[2] === 'pct' ? `${v}%` : c[2] === 'date' ? fdate(v) : v ?? '—'; };
  const right = (c) => c[2] && c[2] !== 'date';
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={c[1]} className={right(c) ? 'num' : ''}>{c[1]}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c[1]} className={cls(right(c) && 'num', c[3] && c[3](r))}>{fmt(c, r)}</td>)}</tr>)}</tbody>
        {foot && rows.length > 0 && <tfoot><tr className="font-semibold bg-slate-50">{cols.map((c, i) => <td key={c[1]} className={cls('px-3 py-2', right(c) && 'num')}>{i === 0 ? t('Total') : foot[c[0]] !== undefined ? fmt(c, foot) : ''}</td>)}</tr></tfoot>}
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
const sumBy = (rows, keys) => Object.fromEntries(keys.map((k) => [k, rows.reduce((a, r) => a + Number(r[k] || 0), 0)]));
const Csv = ({ onClick }) => <button className="btn-light !py-1.5 text-xs no-print" onClick={onClick}><Icon name="download" /> Excel</button>;
const Line2 = ({ a, b, bold, cur }) => <div className={cls('flex justify-between gap-2 py-1.5 border-b border-slate-100 text-sm', bold && 'font-bold border-0 py-2')}><span>{a}</span><span className="tabular-nums">{money(b, cur)}</span></div>;

export default function Reports() {
  const { cur, on } = useAuth();
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState(initialPeriod('this_month'));
  const [farm, setFarm] = useState('');
  const [asOn, setAsOn] = useState(todayISO());
  const farms = useOptions('farms');
  const tabs = TABS.filter(([k]) => !['pnl', 'balance'].includes(k) || on('finance'));
  const P = { from: period.from, to: period.to, group: period.group, farm_id: farm };
  const name = (x) => `${x} ${period.from} to ${period.to}`;

  const { data: s } = useApi('/reports/summary', P);
  const pnl = useApi(tab === 'pnl' ? '/reports/pnl' : null, P).data;
  const bal = useApi(tab === 'balance' ? '/reports/balance' : null, { date: asOn }).data;
  const sheet = useApi(tab === 'sheet' ? '/r/sales' : null, { from: period.from, to: period.to, farm_id: farm, limit: 5000 }).data;
  const day = useApi(tab === 'daybook' ? '/reports/daybook' : null, { date: asOn }).data;
  const pointInTime = ['balance', 'daybook'].includes(tab);

  return (
    <div className="space-y-4">
      <PageHeader title={t('Reports')} subtitle={pointInTime ? fdate(asOn) : `${fdate(period.from)} – ${fdate(period.to)}`}>
        {!pointInTime ? <PeriodPicker value={period} onChange={setPeriod} /> : (
          <label className="flex items-center gap-2 text-sm">{tab === 'balance' ? 'As on' : t('Date')} <input type="date" className="input !w-auto !py-2" value={asOn} onChange={(e) => setAsOn(e.target.value)} /></label>
        )}
        {farms.length > 1 && !pointInTime && (
          <select className="input !w-auto !py-2" value={farm} onChange={(e) => setFarm(e.target.value)} aria-label="Farm"><option value="">{t('All farms')}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        )}
        <button className="btn-outline" onClick={() => window.print()}><Icon name="printer" /> <span className="hidden sm:inline">Print / PDF</span></button>
      </PageHeader>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {!s ? <Spinner /> : (
        <>
          {tab === 'overview' && (
            <div className="space-y-4">
              <Card><p className="text-[15px] pt-4"><Icon name="lightbulb" className="text-brand-700" /> {s.finding}</p></Card>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label={t('Harvested')} value={num(s.totals.harvested, 0)} sub={`culls ${num(s.totals.culls, 0)} · ${s.totals.wastage_pct}%`} />
                <Stat label="Sold" value={num(s.totals.sold, 0)} sub={`rejected ${num(s.totals.rejected, 0)} · ${s.totals.rejection_pct}%`} />
                <Stat label={t('Sales')} value={money(s.totals.revenue, cur)} sub={`avg ${money(s.totals.avg_price, cur)}/unit`} />
                <Stat label={t('Expenses')} value={money(s.totals.expenses, cur)} sub={`+ depreciation ${money(s.totals.depreciation, cur)}`} />
                <Stat label={t('Profit')} value={money(s.totals.profit, cur)} sub={`${s.totals.margin}% margin`} tone={s.totals.profit >= 0 ? 'green' : 'red'} />
                <Stat label={t('Collected')} value={money(s.totals.collected, cur)} />
                <Stat label="Receivable" value={money(s.totals.receivable, cur)} />
                <Stat label={t('Overdue')} value={money(s.totals.overdue, cur)} />
              </div>
              <Card title={`${t('Sales vs expenses')} · ${t('by ' + s.group)}`} action={<Csv onClick={() => downloadCSV(name('Trend'), s.trend)} />}>
                <BarChart data={s.trend} series={[{ key: 'revenue', name: t('Sales'), color: C.revenue }, { key: 'expenses', name: t('Expenses'), color: C.expenses }]} line={{ key: 'profit', name: t('Profit'), color: C.profit }} tipFmt={(v) => money(v, cur)} />
              </Card>
              <Card title={`Trend table · ${t('by ' + s.group)}`} pad={false}>
                <Table cur={cur} rows={s.trend} foot={sumBy(s.trend, ['harvest', 'sold', 'revenue', 'expenses', 'profit'])}
                  cols={[[(r) => (s.group === 'month' ? r.bucket : fdate(r.bucket)), s.group === 'month' ? 'Month' : s.group === 'week' ? 'Week from' : t('Date')], ['harvest', t('Harvested'), 'num'], ['sold', 'Sold', 'num'], ['revenue', t('Sales'), 'money'], ['expenses', t('Expenses'), 'money'], ['profit', 'Sales − expenses', 'money', (r) => r.profit < 0 && 'text-red-600']]} />
              </Card>
            </div>
          )}

          {tab === 'crops' && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Cost vs price per unit"><BarChart data={s.byCrop.filter((c) => c.sold)} x="crop" xFmt={(v) => v} series={[{ key: 'avg_price', name: 'Price / unit', color: C.revenue }, { key: 'cost_per_unit', name: 'Cost / unit', color: C.expenses }]} tipFmt={(v) => money(v, cur)} fmt={(v) => cur + v} /></Card>
                <Card title={t('Quantity sold by crop')}><BarChart data={s.cropTrend} stacked series={s.byCrop.filter((c) => c.sold).map((c) => ({ key: c.crop, name: c.crop, color: c.color }))} /></Card>
              </div>
              <Card title="Crop-wise quantity, sales & profit" pad={false} action={<Csv onClick={() => downloadCSV(name('Crops'), s.byCrop)} />}>
                <Table cur={cur} rows={s.byCrop} foot={sumBy(s.byCrop, ['harvested', 'culls', 'sold', 'rejected', 'revenue', 'direct_cost', 'shared_cost', 'cost', 'profit'])} cols={[
                  ['crop', t('Crop')], ['harvested', t('Harvested'), 'num'], ['a_grade_pct', 'A grade', 'pct'], ['culls', 'Culls', 'num'], ['sold', 'Sold', 'num'], ['rejected', 'Rejected', 'num'],
                  ['revenue', t('Sales'), 'money'], ['avg_price', 'Avg price', 'money'], ['direct_cost', 'Direct cost', 'money'], ['shared_cost', 'Shared cost', 'money'],
                  ['cost_per_unit', 'Cost/unit', 'money'], ['profit', t('Profit'), 'money', (r) => (r.profit < 0 ? 'text-red-600 font-semibold' : 'text-brand-700 font-semibold')], ['margin', 'Margin', 'pct']]} />
              </Card>
              <p className="text-xs text-slate-500">Direct cost = expenses tagged to a crop cycle. Shared cost (rent, current, labour, depreciation…) is split by area × days of each running crop cycle; without cycles, by sales share.</p>
            </div>
          )}

          {tab === 'vendors' && (
            <div className="space-y-4">
              <Card title="Vendor-wise sales & dues" pad={false} action={<Csv onClick={() => downloadCSV(name('Vendors'), s.byVendor.map(({ crops, ...v }) => v))} />}>
                <Table cur={cur} rows={s.byVendor} foot={sumBy(s.byVendor, ['deliveries', 'qty', 'rejected', 'revenue', 'payments', 'balance', 'overdue'])} cols={[
                  ['name', t('Vendor')], ['deliveries', t('Deliveries'), 'num'], ['qty', t('Qty'), 'num'], ['rejected', 'Rejected', 'num'], ['rejection_pct', 'Rej %', 'pct', (r) => r.rejection_pct > 5 && 'text-red-600'],
                  ['revenue', t('Sales'), 'money'], ['payments', 'Received', 'money'], ['balance', 'Due now', 'money'], ['overdue', t('Overdue'), 'money', (r) => r.overdue > 0 && 'text-red-600 font-semibold'], ['credit_days', 'Credit days', 'num'], ['last_sale', 'Last sale', 'date']]} />
              </Card>
              <Card title="Price matrix — average rate each vendor paid" pad={false} action={<Csv onClick={() => downloadCSV(name('Price matrix'), s.priceMatrix.rows.map((r) => ({ vendor: r.name, ...Object.fromEntries(s.priceMatrix.crops.map((c) => [c.crop, r.rates[c.crop_id] ?? ''])) })))} />}>
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>{t('Vendor')}</th>{s.priceMatrix.crops.map((c) => <th key={c.crop_id} className="num">{c.crop}</th>)}</tr></thead>
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
              <Card title={t('Price trend')} sub={`Average price per unit · ${t('by ' + s.group)}`}>
                <LineChart data={s.priceTrend} series={s.byCrop.filter((c) => c.sold).map((c) => ({ key: c.crop, name: c.crop, color: c.color }))} tipFmt={(v) => money(v, cur)} fmt={(v) => cur + v} />
              </Card>
            </div>
          )}

          {tab === 'sheet' && (!sheet ? <Spinner /> : (
            <Card title={`${t('Sales')} — ${sheet.length} ${t('entries')}`} pad={false} action={<Csv onClick={() => downloadCSV(name('Sales sheet'), sheet, [['date', 'Date'], ['party_id_label', 'Vendor'], ['crop_id_label', 'Crop'], ['grade', 'Grade'], ['quantity', 'Qty'], ['rejected_qty', 'Rejected'], ['rate', 'Rate'], ['amount', 'Amount'], ['status', 'Status'], ['invoice_no', 'Slip'], ['farm_id_label', 'Farm']])} />}>
              <Table cur={cur} rows={sheet} foot={sumBy(sheet, ['quantity', 'rejected_qty', 'amount'])} cols={[
                ['date', t('Date'), 'date'], ['party_id_label', t('Vendor')], ['crop_id_label', t('Crop')], ['grade', t('Grade')], ['quantity', t('Qty'), 'num'], ['rejected_qty', 'Rejected', 'num'], ['rate', t('Rate'), 'money'], ['amount', t('Amount'), 'money'], [(r) => t(r.status), t('Status')]]} />
            </Card>
          ))}

          {tab === 'expenses' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Expenses by category"><ShareBars data={s.byCategory} labelKey="category" valueKey="amount" cur={cur} max={12} /></Card>
              <Card title="Category table" pad={false} action={<Csv onClick={() => downloadCSV(name('Expenses'), s.byCategory)} />}>
                <Table cur={cur} rows={s.byCategory} foot={sumBy(s.byCategory, ['entries', 'amount'])} cols={[['category', t('Category')], ['kind', 'Kind'], ['entries', t('entries'), 'num'], ['amount', t('Amount'), 'money']]} />
              </Card>
              {s.labour && (
                <Card title={t('Labour')} className="lg:col-span-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
                    {[[num(s.labour.mandays), 'Man-days'], [s.labour.workers, t('Workers')], [money(s.labour.cost, cur), 'Wages booked'], [money(s.labour.cost_per_unit, cur), 'Labour cost / unit']].map(([v, l]) => <div key={l}><div className="text-xl font-bold">{v}</div><div className="text-xs text-slate-500">{l}</div></div>)}
                  </div>
                </Card>
              )}
            </div>
          )}

          {tab === 'farms' && (
            <Card title="Farm-wise (FPO members / locations)" pad={false} action={<Csv onClick={() => downloadCSV(name('Farms'), s.byFarm)} />}>
              <Table cur={cur} rows={s.byFarm} foot={sumBy(s.byFarm, ['harvest', 'revenue', 'expenses', 'profit'])} cols={[
                ['name', t('Farm')], ['member', 'Member'], ['acres', 'Acres', 'num'], ['harvest', t('Harvested'), 'num'], ['revenue', t('Sales'), 'money'], ['expenses', t('Expenses'), 'money'],
                ['profit', t('Profit'), 'money', (r) => r.profit < 0 && 'text-red-600'], [(r) => (r.acres ? Math.round(r.profit / r.acres) : null), 'Profit / acre', 'money']]} />
              <p className="text-xs text-slate-500 px-4 py-2">Tag sales and expenses with a farm to see them here. Untagged costs show as “Shared”.</p>
            </Card>
          )}

          {tab === 'pnl' && (!pnl ? <Spinner /> : (
            <Card title={`Profit & Loss — ${fdate(pnl.from)} to ${fdate(pnl.to)}`} action={<Csv onClick={() => downloadCSV(name('P&L'), [...pnl.income.map((i) => ({ section: 'Income', name: i.name, amount: i.amount })), ...pnl.other_income.map((i) => ({ section: 'Other income', name: i.source, amount: i.amount })), ...pnl.expenses.map((e) => ({ section: 'Expense', name: e.name, amount: e.amount })), { section: 'Expense', name: 'Depreciation', amount: pnl.depreciation }, { section: 'Net', name: 'Net profit', amount: pnl.net_profit }])} />}>
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl pt-2">
                <div>
                  <h3 className="font-semibold text-brand-800 mb-2">Income</h3>
                  {pnl.income.map((i) => <Line2 key={i.name} a={`${i.name} (${num(i.qty)} ${i.unit})`} b={i.amount} cur={cur} />)}
                  {pnl.other_income.map((i) => <Line2 key={i.source} a={i.source} b={i.amount} cur={cur} />)}
                  <Line2 a="Total income" b={pnl.total_income} bold cur={cur} />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-700 mb-2">{t('Expenses')}</h3>
                  {pnl.expenses.map((e) => <Line2 key={e.name} a={e.name} b={e.amount} cur={cur} />)}
                  {pnl.depreciation > 0 && <Line2 a="Depreciation (assets)" b={pnl.depreciation} cur={cur} />}
                  <Line2 a="Total expenses" b={pnl.total_expenses} bold cur={cur} />
                </div>
              </div>
              <div className={cls('mt-4 rounded-xl px-4 py-3 flex justify-between text-lg font-bold max-w-4xl', pnl.net_profit >= 0 ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700')}>
                <span>Net {pnl.net_profit >= 0 ? 'profit' : 'loss'}</span><span className="tabular-nums">{money(pnl.net_profit, cur)}</span>
              </div>
            </Card>
          ))}

          {tab === 'balance' && (!bal ? <Spinner /> : (
            <div className="space-y-4">
              <Card title={`Balance sheet as on ${fdate(bal.as_on)}`}>
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl pt-2">
                  <div><h3 className="font-semibold text-brand-800 mb-2">What you own</h3>{bal.assets.map((a) => <Line2 key={a.name} a={a.name} b={a.amount} cur={cur} />)}<Line2 a="Total assets" b={bal.total_assets} bold cur={cur} /></div>
                  <div>
                    <h3 className="font-semibold text-orange-700 mb-2">What you owe</h3>{bal.liabilities.map((a) => <Line2 key={a.name} a={a.name} b={a.amount} cur={cur} />)}<Line2 a="Total liabilities" b={bal.total_liabilities} bold cur={cur} />
                    <div className="flex justify-between py-2 font-bold text-brand-800 border-t border-slate-200"><span>Net worth (owner's capital)</span><span className="tabular-nums">{money(bal.net_worth, cur)}</span></div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">Cash = opening cash (Settings) + money received − money paid since {bal.books_start ? fdate(bal.books_start) : 'start'}. Management view, not a statutory audit.</p>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Receivable from vendors" pad={false}><Table cur={cur} rows={bal.receivables} cols={[['name', t('Vendor')], ['balance', 'Due', 'money'], ['overdue', t('Overdue'), 'money', (r) => r.overdue > 0 && 'text-red-600'], ['last_payment', 'Last paid', 'date']]} /></Card>
                <Card title="Payable to suppliers" pad={false}><Table cur={cur} rows={bal.payables} cols={[['name', 'Supplier'], ['due', 'Due', 'money']]} /></Card>
              </div>
            </div>
          ))}

          {tab === 'daybook' && (!day ? <Spinner /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={`${t('Harvest')} (${day.harvests.length})`} pad={false}><Table cur={cur} rows={day.harvests} foot={sumBy(day.harvests, ['quantity'])} cols={[['crop', t('Crop')], ['grade', t('Grade')], ['farm', t('Farm')], ['quantity', t('Qty'), 'num']]} /></Card>
              <Card title={`${t('Sales')} (${day.sales.length})`} pad={false}><Table cur={cur} rows={day.sales} foot={sumBy(day.sales, ['quantity', 'amount'])} cols={[['party', t('Vendor')], ['crop', t('Crop')], ['quantity', t('Qty'), 'num'], ['rate', t('Rate'), 'money'], ['amount', t('Amount'), 'money'], ['delivered_by_name', 'By']]} /></Card>
              <Card title={`${t('Expenses')} (${day.expenses.length})`} pad={false}><Table cur={cur} rows={day.expenses} foot={sumBy(day.expenses, ['amount'])} cols={[['category', t('Category')], ['description', 'What'], ['party', 'Paid to'], ['amount', t('Amount'), 'money']]} /></Card>
              <Card title={`${t('Payments received')} (${day.payments.length})`} pad={false}><Table cur={cur} rows={day.payments} foot={sumBy(day.payments, ['amount'])} cols={[['party', t('Vendor')], ['mode', t('Mode')], ['amount', t('Amount'), 'money']]} /></Card>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
