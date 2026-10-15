// Labour login: big check-in button, spray warnings, earnings this week / month, tasks, attendance calendar, payslips
import { useApi, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { money, num, fdate, cls } from '../../lib/format';
import { Card, Icon, Spinner, Badge, Empty, useToast, ErrorBox } from '../../ui/kit';
import { PortalHeader } from '../vendor/VendorApp';

export default function LabourApp() {
  const { meta, cur } = useAuth();
  const toast = useToast();
  const { data: d, error, reload } = useApi('/portal/labour');
  const check = async () => { try { await api.post('/portal/labour/checkin'); toast(t('Done')); reload(); } catch (e) { toast(e.message, 'error'); } };
  const done = async (id) => { await api.put(`/portal/labour/tasks/${id}`); reload(); };
  const td = d?.today;
  const label = !td || !td.check_in ? t('Check in') : !td.check_out ? t('Check out') : t('Done for today');

  return (
    <div className="min-h-screen pb-10">
      <PortalHeader title={meta.user.name} sub={meta.org.name} />
      <main className="max-w-xl mx-auto px-4 -mt-8 space-y-4">
        {error && <ErrorBox text={error} />}
        {!d ? !error && <Spinner /> : (
          <>
            <button onClick={check} disabled={!!td?.check_out} className={cls('w-full rounded-3xl py-8 text-white text-2xl font-bold shadow-lg active:scale-[.99] transition disabled:opacity-60', !td?.check_in ? 'bg-brand-600' : 'bg-slate-800')}>
              <Icon name={!td?.check_in ? 'fingerprint' : 'door-open'} className="mr-2" />{label}
              {td?.check_in && <div className="text-sm font-normal opacity-80 mt-1">In {td.check_in.slice(0, 5)}{td.check_out ? ` · Out ${td.check_out.slice(0, 5)}` : ''}</div>}
            </button>
            {d.locks.length > 0 && <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-red-800"><Icon name="exclamation-octagon-fill" /> <b>{t('Do not enter / pick:')}</b> {d.locks.map((l) => `${l.farm_name}${l.bay_name ? ' ' + l.bay_name : ''}`).join(', ')}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4"><div className="text-[11px] uppercase font-semibold tracking-wider text-slate-500">{t('This week')}</div><div className="text-2xl font-bold">{money(d.week.gross + d.week.bonus, cur)}</div><div className="text-xs text-slate-500">{num(d.week.days_worked)} {t('Days')}{d.week.kg_harvested ? ` · ${num(d.week.kg_harvested)} kg` : ''}</div></div>
              <div className="card p-4"><div className="text-[11px] uppercase font-semibold tracking-wider text-slate-500">{t('This month')}</div><div className="text-2xl font-bold">{money(d.month.gross + d.month.bonus, cur)}</div><div className="text-xs text-slate-500">{num(d.month.days_worked)} {t('Days')} · {t('Paid')} {money(d.month.paid, cur)}</div></div>
            </div>
            {d.month.advance_due > 0 && <div className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">{t('Advance to be adjusted')}: {money(d.month.advance_due, cur)}</div>}
            {d.tasks.length > 0 && (
              <Card title={t('My work today')}>
                {d.tasks.map((k) => (
                  <div key={k.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
                    <div className="min-w-0"><div className="font-medium">{k.title}</div><div className="text-xs text-slate-500">{[k.farm, k.bay].filter(Boolean).join(' / ')}</div></div>
                    {k.status === 'done' ? <Badge tone="green">{t('done')}</Badge> : <button className="btn-primary !py-1.5 text-xs" onClick={() => done(k.id)}>{t('Mark done')}</button>}
                  </div>
                ))}
              </Card>
            )}
            <Card title={t('My attendance')}>
              <div className="grid grid-cols-7 gap-1.5">
                {d.attendance.slice(0, 28).reverse().map((a) => (
                  <div key={a.date} title={`${a.date} ${t(a.status)}`} className={cls('rounded-lg py-1.5 text-center text-xs font-semibold', { present: 'bg-brand-100 text-brand-800', half: 'bg-amber-100 text-amber-800', absent: 'bg-red-100 text-red-700', leave: 'bg-slate-100 text-slate-600' }[a.status])}>{a.date.slice(8)}</div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">{[['bg-brand-100', 'present'], ['bg-amber-100', 'half'], ['bg-red-100', 'absent'], ['bg-slate-100', 'leave']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1"><span className={cls('h-3 w-3 rounded', c)} />{t(l)}</span>)}</div>
            </Card>
            <Card title={t('Payslips')}>
              {d.payslips.length ? d.payslips.map((p) => (
                <div key={p.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                  <div>{fdate(p.period_start)} – {fdate(p.period_end)}<div className="text-xs text-slate-500">{t('Gross')} {money(p.gross, cur)}{p.deductions > 0 ? ` · ${t('Advance cut')} ${money(p.deductions, cur)}` : ''}</div></div>
                  <b>{money(p.net_paid, cur)}</b>
                </div>
              )) : <Empty text={t('No payments yet')} />}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
