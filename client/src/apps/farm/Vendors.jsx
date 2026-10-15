// Vendor dashboard: who owes what, statement with running balance, record payment, vendor price list, WhatsApp reminder
import { useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { money, num, fdate, cls, todayISO, downloadCSV, initialPeriod } from '../../lib/format';
import { Card, Icon, Modal, PageHeader, Spinner, Badge, Empty, useToast, Tabs } from '../../ui/kit';
import ResourcePage from '../../ui/ResourcePage';
import { ResourceForm } from '../../ui/Form';
import PeriodPicker from '../../ui/PeriodPicker';

function PaymentForm({ party, onDone }) {
  const { cur } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ date: todayISO(), amount: '', mode: 'upi', reference: '' });
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/r/payments_received', { ...f, party_id: party.party_id }); toast(`${money(f.amount, cur)} recorded`); onDone(); } catch (e2) { toast(e2.message, 'error'); }
  };
  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-3 rounded-2xl bg-brand-50 p-3">
      <div><label className="label">Amount received</label><input className="input" type="number" step="any" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
      <div><label className="label">{t('Mode')}</label><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{['cash', 'upi', 'bank', 'cheque'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select></div>
      <div><label className="label">{t('Date')}</label><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div><label className="label">UTR / ref</label><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
      <button className="btn-primary col-span-2"><Icon name="cash-coin" /> Record payment</button>
    </form>
  );
}

function EditVendor({ id, onDone }) {
  const { meta } = useAuth();
  const { data } = useApi(`/r/parties/${id}`);
  return data ? <ResourceForm def={meta.resources.parties} row={data} onSaved={onDone} onDeleted={onDone} /> : <Spinner />;
}

function Statement({ party, onChanged }) {
  const { cur, meta } = useAuth();
  const [period, setPeriod] = useState(initialPeriod('last_30'));
  const [tab, setTab] = useState('statement');
  const { data: st, reload } = useApi(`/reports/vendor/${party.party_id}`, { from: period.from, to: period.to });
  const phone = (party.phone || '').replace(/\D/g, '');
  const wa = `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(`Namaste ${party.name}, your balance with ${meta.org.name} is ${money(party.balance, cur)}${party.overdue ? ` (overdue ${money(party.overdue, cur)})` : ''}. Kindly arrange payment. Thank you.`)}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Due now</div><div className="font-bold text-lg">{money(party.balance, cur)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{t('Overdue')}</div><div className={cls('font-bold text-lg', party.overdue > 0 && 'text-red-600')}>{money(party.overdue, cur)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{t('Credit days')}</div><div className="font-bold text-lg">{party.credit_days}</div></div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Tabs tabs={[['statement', 'Statement'], ['payment', 'Record payment'], ['prices', 'Prices'], ['edit', 'Edit']]} value={tab} onChange={setTab} />
        {phone && <a className="chip-off" href={wa} target="_blank" rel="noreferrer"><Icon name="whatsapp" className="text-green-600" /> Reminder</a>}
      </div>
      {tab === 'payment' && <PaymentForm party={party} onDone={() => { setTab('statement'); reload(); onChanged(); }} />}
      {tab === 'prices' && <ResourcePage resKey="price_list" presetFilters={{ party_id: party.party_id }} hideHeader />}
      {tab === 'edit' && <EditVendor id={party.party_id} onDone={onChanged} />}
      {tab === 'statement' && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <PeriodPicker value={period} onChange={setPeriod} showGroup={false} />
            {st && <button className="btn-light !py-2" onClick={() => downloadCSV(`${party.name} statement`, st.lines, [['date', 'Date'], ['kind', 'Type'], ['crop', 'Crop'], ['quantity', 'Qty'], ['rejected_qty', 'Rejected'], ['rate', 'Rate'], ['amount', 'Amount'], ['balance', 'Balance']])}><Icon name="download" /> Excel</button>}
          </div>
          {!st ? <Spinner /> : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="tbl">
                <thead><tr><th>{t('Date')}</th><th>Details</th><th className="num">Sale</th><th className="num">Received</th><th className="num">Balance</th></tr></thead>
                <tbody>
                  <tr className="bg-slate-50"><td colSpan={4}>Opening balance</td><td className="num font-semibold">{money(st.opening, cur)}</td></tr>
                  {st.lines.map((l) => (
                    <tr key={l.kind + l.id}>
                      <td>{fdate(l.date)}</td>
                      <td>{l.kind === 'sale' ? <>{l.crop} {l.grade} · {num(l.quantity)}{l.rejected_qty > 0 && <span className="text-red-600"> (−{num(l.rejected_qty)})</span>} × {money(l.rate, cur)} {l.status === 'disputed' && <Badge tone="red">{t('disputed')}</Badge>}{l.vendor_note && <span className="text-slate-400"> “{l.vendor_note}”</span>}</> : <>Payment · {l.mode}{l.reference ? ` · ${l.reference}` : ''}</>}</td>
                      <td className="num">{l.kind === 'sale' ? money(l.amount, cur) : ''}</td>
                      <td className="num text-brand-700">{l.kind === 'payment' ? money(l.amount, cur) : ''}</td>
                      <td className="num font-medium">{money(l.balance, cur)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold"><td colSpan={2}>Closing</td><td className="num">{money(st.total_sales, cur)}</td><td className="num">{money(st.total_paid, cur)}</td><td className="num">{money(st.closing, cur)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Vendors() {
  const { cur, meta } = useAuth();
  const { data: rows, reload } = useApi('/reports/receivables');
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  const list = (rows || []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.overdue - a.overdue || b.balance - a.balance);
  const tot = list.reduce((a, r) => ({ due: a.due + Math.max(0, r.balance), over: a.over + r.overdue }), { due: 0, over: 0 });

  return (
    <div className="space-y-4">
      <PageHeader title={t('Vendors')} subtitle="Who buys from you, what they owe, and at what price">
        <button className="btn-primary" onClick={() => setAdding(true)}><Icon name="plus-lg" /> {t('Add')}</button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total receivable</div><div className="text-2xl font-bold">{money(tot.due, cur)}</div></div>
        <div className="card p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('Overdue')}</div><div className={cls('text-2xl font-bold', tot.over > 0 && 'text-red-600')}>{money(tot.over, cur)}</div></div>
      </div>
      <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder={t('Search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!rows ? <Spinner /> : !list.length ? <Card><Empty text="No buyer vendors yet" /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <button key={r.party_id} onClick={() => setSel(r)} className={cls('card p-4 text-left hover:border-brand-400 transition', r.overdue > 0 && 'border-l-4 border-l-red-500')}>
              <div className="flex justify-between items-start gap-2">
                <div className="font-semibold">{r.name}</div>
                {r.overdue > 0 ? <Badge tone="red">{t('Overdue')}</Badge> : r.balance > 0 ? <Badge tone="amber">Due</Badge> : <Badge tone="green">Clear</Badge>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-slate-500 text-xs">Due now</div><div className="font-bold tabular-nums">{money(r.balance, cur)}</div></div>
                <div><div className="text-slate-500 text-xs">{t('Overdue')}</div><div className={cls('font-bold tabular-nums', r.overdue > 0 && 'text-red-600')}>{money(r.overdue, cur)}</div></div>
              </div>
              <div className="mt-2 text-xs text-slate-500">Last sale {fdate(r.last_sale)} · paid {fdate(r.last_payment)} · {r.credit_days}d credit</div>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name} wide>{sel && <Statement party={sel} onChanged={reload} />}</Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title={`${t('Add')} · ${t('Vendor')}`} wide>
        {adding && <ResourceForm def={meta.resources.parties} onSaved={() => { setAdding(false); reload(); }} />}
      </Modal>
    </div>
  );
}
