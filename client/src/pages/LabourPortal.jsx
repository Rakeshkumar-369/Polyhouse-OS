// Labour login: big check-in button, today's tasks, this week's/month's earnings, attendance, payslips
import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, Spinner, Badge, Empty, useToast } from '../components/Ui';
import { money, num, fdate, cls } from '../utils';

export default function LabourPortal() {
  const { meta, logout, cur } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api.get('/portal/labour').then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const check = async () => { try { await api.post('/portal/labour/checkin'); toast('Done'); load(); } catch (e) { toast(e.message, 'error'); } };
  const done = async (id) => { await api.put(`/portal/labour/tasks/${id}`); load(); };
  const t = d?.today;
  const label = !t || !t.check_in ? 'Check in' : !t.check_out ? 'Check out' : 'Done for today';

  return (
    <div className="min-h-screen pb-10">
      <header className="bg-brand-800 text-white px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="flex-1"><div className="text-xs text-brand-200">{meta.org.name}</div><div className="font-bold text-lg">{meta.user.name}</div></div>
          <button className="btn bg-white/10 text-white" onClick={logout}><Icon name="bi-box-arrow-right" /></button>
        </div>
      </header>
      <main className="max-w-xl mx-auto p-4 space-y-4">
        {err && <Card><Empty icon="bi-lock" text={err} /></Card>}
        {!d && !err ? <Spinner /> : d && (
          <>
            <button onClick={check} disabled={t?.check_out} className={cls('w-full rounded-3xl py-8 text-white text-2xl font-bold shadow-lg active:scale-[.99] disabled:opacity-60', !t?.check_in ? 'bg-brand-600' : 'bg-slate-800')}>
              <Icon name={!t?.check_in ? 'bi-fingerprint' : 'bi-door-open'} className="mr-2" />{label}
              {t?.check_in && <div className="text-sm font-normal opacity-80 mt-1">In {t.check_in?.slice(0, 5)}{t.check_out ? ` · Out ${t.check_out.slice(0, 5)}` : ''}</div>}
            </button>
            {d.locks.length > 0 && <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-red-800"><Icon name="bi-exclamation-octagon-fill" /> <b>Do not enter / pick:</b> {d.locks.map((l) => `${l.farm_name}${l.bay_name ? ' ' + l.bay_name : ''}`).join(', ')} (spray)</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4"><div className="text-xs uppercase font-semibold text-slate-500">This week</div><div className="text-2xl font-bold">{money(d.week.net, cur)}</div><div className="text-xs text-slate-500">{num(d.week.days_worked)} days{d.week.kg_harvested ? ` · ${num(d.week.kg_harvested)} kg` : ''}</div></div>
              <div className="card p-4"><div className="text-xs uppercase font-semibold text-slate-500">This month</div><div className="text-2xl font-bold">{money(d.month.net, cur)}</div><div className="text-xs text-slate-500">{num(d.month.days_worked)} days · paid {money(d.month.paid, cur)}</div></div>
            </div>
            {d.month.advance_due > 0 && <div className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">Advance to be adjusted: {money(d.month.advance_due, cur)}</div>}
            {d.tasks.length > 0 && (
              <Card title="My work today">
                {d.tasks.map((k) => (
                  <div key={k.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div><div className="font-medium">{k.title}</div><div className="text-xs text-slate-500">{[k.farm, k.bay].filter(Boolean).join(' / ')}</div></div>
                    {k.status === 'done' ? <Badge tone="green">done</Badge> : <button className="btn-primary !py-1.5 text-xs" onClick={() => done(k.id)}>Mark done</button>}
                  </div>
                ))}
              </Card>
            )}
            <Card title="My attendance">
              <div className="grid grid-cols-7 gap-1.5">
                {d.attendance.slice(0, 28).reverse().map((a) => (
                  <div key={a.date} title={`${a.date} ${a.status}`} className={cls('rounded-lg py-1.5 text-center text-xs font-semibold', { present: 'bg-brand-100 text-brand-800', half: 'bg-amber-100 text-amber-800', absent: 'bg-red-100 text-red-700', leave: 'bg-slate-100 text-slate-600' }[a.status])}>
                    {a.date.slice(8)}
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Payslips">
              {d.payslips.length ? d.payslips.map((p) => (
                <div key={p.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                  <div>{fdate(p.period_start)} – {fdate(p.period_end)}<div className="text-xs text-slate-500">Gross {money(p.gross, cur)}{p.deductions > 0 ? ` · cut ${money(p.deductions, cur)}` : ''}</div></div>
                  <b>{money(p.net_paid, cur)}</b>
                </div>
              )) : <Empty text="No payments yet" />}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
