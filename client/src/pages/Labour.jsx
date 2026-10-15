// Labour: one-screen attendance, wage run (calculate & pay), workers, advances
import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, PageHeader, Spinner, Empty, useToast, Badge } from '../components/Ui';
import ResourcePage from '../components/ResourcePage';
import PeriodPicker, { initialPeriod } from '../components/PeriodPicker';
import { money, num, todayISO, cls, downloadCSV } from '../utils';

const ST = [['present', 'P', 'bg-brand-600'], ['half', '½', 'bg-amber-500'], ['absent', 'A', 'bg-red-500'], ['leave', 'L', 'bg-slate-500']];

function Attendance() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get('/ops/attendance-sheet', { date }).then(setRows), [date]);
  useEffect(() => { load(); }, [load]);
  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    setBusy(true);
    try { await api.post('/ops/attendance-sheet', { date, entries: rows }); toast('Attendance saved'); load(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const count = (s) => rows?.filter((r) => r.status === s).length || 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className="input !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn-light" onClick={() => setRows((r) => r.map((x) => ({ ...x, status: x.status || 'present' })))}>Mark rest present</button>
        {rows && <span className="text-sm text-slate-500">P {count('present')} · ½ {count('half')} · A {count('absent')} · L {count('leave')}</span>}
      </div>
      {!rows ? <Spinner /> : !rows.length ? <Card><Empty text="Add workers first (Workers tab)" /></Card> : (
        <Card pad={false}>
          {rows.map((r, i) => (
            <div key={r.worker_id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex-1 min-w-[140px]"><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-500">{r.skill} · {r.pay_type}</div></div>
              <div className="flex gap-1.5">
                {ST.map(([s, l, c]) => (
                  <button key={s} onClick={() => set(i, 'status', r.status === s ? null : s)} title={s}
                    className={cls('h-10 w-10 rounded-xl font-bold text-sm', r.status === s ? `${c} text-white` : 'bg-slate-100 text-slate-500')}>{l}</button>
                ))}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <input className="input flex-1 sm:!w-36 !py-2" placeholder="Work done" value={r.task || ''} onChange={(e) => set(i, 'task', e.target.value)} />
                <input className="input !w-24 !py-2" type="number" placeholder="OT hrs" value={r.overtime_hours || ''} onChange={(e) => set(i, 'overtime_hours', e.target.value)} />
              </div>
            </div>
          ))}
        </Card>
      )}
      {rows?.length > 0 && <button className="btn-primary w-full !py-3" onClick={save} disabled={busy}><Icon name="bi-check2-all" /> Save attendance</button>}
    </div>
  );
}

function WageRun() {
  const { cur } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState(initialPeriod('this_week'));
  const [rows, setRows] = useState(null);
  const load = useCallback(() => { setRows(null); api.get('/ops/wage-run', { from: period.from, to: period.to }).then(setRows); }, [period]);
  useEffect(() => { load(); }, [load]);
  const pay = async (r) => {
    if (!confirm(`Pay ${r.worker.name} ${money(r.net, cur)} for ${period.from} to ${period.to}?`)) return;
    try {
      await api.post('/r/wage_payments', { worker_id: r.worker.id, date: todayISO(), period_start: period.from, period_end: period.to, days_worked: r.days_worked, gross: r.gross, bonus: r.bonus, deductions: r.deductions, mode: 'cash', notes: r.basis });
      toast(`Paid ${r.worker.name}`); load();
    } catch (e) { toast(e.message, 'error'); }
  };
  const tot = (k) => (rows || []).reduce((a, r) => a + Number(r[k] || 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <PeriodPicker value={period} onChange={setPeriod} showGroup={false} />
        {rows && <button className="btn-light !py-2" onClick={() => downloadCSV(`Wages ${period.from} ${period.to}`, rows.map((r) => ({ worker: r.worker.name, pay_type: r.worker.pay_type, days: r.days_worked, kg: r.kg_harvested, basis: r.basis, gross: r.gross, bonus: r.bonus, deductions: r.deductions, net: r.net, paid: r.paid })))}><Icon name="bi-download" /> CSV</button>}
      </div>
      {!rows ? <Spinner /> : (
        <Card pad={false} className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Worker</th><th className="num">Days</th><th>Basis</th><th className="num">Gross</th><th className="num">Bonus</th><th className="num">Advance cut</th><th className="num">Net</th><th className="num">Paid</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.worker.id}>
                  <td className="font-medium">{r.worker.name}<div className="text-xs text-slate-400">{r.worker.pay_type}{r.advance_due > 0 ? ` · advance due ${money(r.advance_due, cur)}` : ''}</div></td>
                  <td className="num">{num(r.days_worked)}</td><td className="text-xs text-slate-500 max-w-[220px] whitespace-normal">{r.basis}</td>
                  <td className="num">{money(r.gross, cur)}</td><td className="num">{money(r.bonus, cur)}</td><td className="num">{money(r.deductions, cur)}</td>
                  <td className="num font-bold">{money(r.net, cur)}</td>
                  <td className="num">{r.paid > 0 ? <Badge tone="green">{money(r.paid, cur)}</Badge> : '—'}</td>
                  <td>{r.net > 0 && !r.paid && <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => pay(r)}>Pay</button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="font-semibold bg-slate-50"><td className="px-3 py-2">Total</td><td className="num px-3">{num(tot('days_worked'))}</td><td></td><td className="num px-3">{money(tot('gross'), cur)}</td><td className="num px-3">{money(tot('bonus'), cur)}</td><td className="num px-3">{money(tot('deductions'), cur)}</td><td className="num px-3">{money(tot('net'), cur)}</td><td className="num px-3">{money(tot('paid'), cur)}</td><td></td></tr></tfoot>
          </table>
        </Card>
      )}
      <p className="text-xs text-slate-500">Daily = days × wage. Monthly = salary ÷ 30 per day, minus absent days. Piece = kg harvested × rate. Overtime = hours × (day wage ÷ 8). Paying posts the wages to Expenses (Labour) automatically and recovers advances.</p>
    </div>
  );
}

export default function Labour() {
  const { role } = useAuth();
  const mgr = ['admin', 'manager'].includes(role);
  const tabs = [['att', 'Attendance'], ...(mgr ? [['wages', 'Wage run'], ['workers', 'Workers'], ['adv', 'Advances / bonus']] : [])];
  const [tab, setTab] = useState('att');
  return (
    <div className="space-y-4">
      <PageHeader title="Labour" subtitle="Attendance, salaries and payments" />
      <div className="flex gap-1 overflow-x-auto">{tabs.map(([k, l]) => <button key={k} className={k === tab ? 'chip-on whitespace-nowrap' : 'chip-off whitespace-nowrap'} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'att' && <Attendance />}
      {tab === 'wages' && <WageRun />}
      {tab === 'workers' && <ResourcePage resKey="workers" hideHeader />}
      {tab === 'adv' && <ResourcePage resKey="advances" hideHeader />}
    </div>
  );
}
