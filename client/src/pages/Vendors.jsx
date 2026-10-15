// Vendor dashboard: who owes what, statement with running balance, record payment, vendor price list, WhatsApp reminder
import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, Modal, PageHeader, Spinner, Badge, Empty, useToast } from '../components/Ui';
import ResourcePage from '../components/ResourcePage';
import { ResourceForm } from '../components/Form';
import PeriodPicker, { initialPeriod } from '../components/PeriodPicker';
import { money, num, fdate, cls, todayISO, downloadCSV } from '../utils';

function PaymentForm({ party, onDone }) {
  const { cur } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ date: todayISO(), amount: '', mode: 'upi', reference: '' });
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/r/payments_received', { ...f, party_id: party.party_id || party.id }); toast(`Payment ${money(f.amount, cur)} recorded`); onDone(); } catch (e2) { toast(e2.message, 'error'); }
  };
  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-3 rounded-2xl bg-brand-50 p-3">
      <div><label className="label">Amount received</label><input className="input" type="number" step="any" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
      <div><label className="label">Mode</label><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{['cash', 'upi', 'bank', 'cheque'].map((m) => <option key={m}>{m}</option>)}</select></div>
      <div><label className="label">Date</label><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div><label className="label">UTR / ref</label><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
      <button className="btn-primary col-span-2"><Icon name="bi-cash-coin" /> Record payment</button>
    </form>
  );
}

function Statement({ party, onChanged }) {
  const { cur, meta } = useAuth();
  const [period, setPeriod] = useState(initialPeriod('last_30'));
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState('statement');
  const load = useCallback(() => api.get(`/reports/vendor/${party.party_id}`, { from: period.from, to: period.to }).then(setSt), [party, period]);
  useEffect(() => { load(); }, [load]);
  const phone = (party.phone || '').replace(/\D/g, '');
  const wa = `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(`Namaste ${party.name}, your balance with ${meta.org.name} is ${money(party.balance, cur)}${party.overdue ? ` (overdue ${money(party.overdue, cur)})` : ''}. Kindly arrange payment. Thank you.`)}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card p-3"><div className="text-xs text-slate-500">Due now</div><div className="font-bold text-lg">{money(party.balance, cur)}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-500">Overdue</div><div className={cls('font-bold text-lg', party.overdue > 0 && 'text-red-600')}>{money(party.overdue, cur)}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-500">Credit</div><div className="font-bold text-lg">{party.credit_days} days</div></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {['statement', 'payment', 'prices', 'edit'].map((t) => <button key={t} className={t === tab ? 'chip-on' : 'chip-off'} onClick={() => setTab(t)}>{{ statement: 'Statement', payment: 'Record payment', prices: 'Price list', edit: 'Edit vendor' }[t]}</button>)}
        {phone && <a className="chip-off" href={wa} target="_blank" rel="noreferrer"><Icon name="bi-whatsapp" className="text-green-600" /> Reminder</a>}
      </div>
      {tab === 'payment' && <PaymentForm party={party} onDone={() => { setTab('statement'); load(); onChanged(); }} />}
      {tab === 'prices' && <ResourcePage resKey="price_list" presetFilters={{ party_id: party.party_id }} hideHeader />}
      {tab === 'edit' && <EditVendor id={party.party_id} onDone={onChanged} />}
      {tab === 'statement' && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <PeriodPicker value={period} onChange={setPeriod} showGroup={false} />
            {st && <button className="btn-light !py-2" onClick={() => downloadCSV(`${party.name} statement`, st.lines, [['date', 'Date'], ['kind', 'Type'], ['crop', 'Crop'], ['quantity', 'Qty'], ['rejected_qty', 'Rejected'], ['rate', 'Rate'], ['amount', 'Amount'], ['balance', 'Balance']])}><Icon name="bi-download" /> CSV</button>}
          </div>
          {!st ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Details</th><th className="num">Sale</th><th className="num">Received</th><th className="num">Balance</th></tr></thead>
                <tbody>
                  <tr className="bg-slate-50"><td colSpan={4}>Opening balance</td><td className="num font-semibold">{money(st.opening, cur)}</td></tr>
                  {st.lines.map((l) => (
                    <tr key={l.kind + l.id}>
                      <td>{fdate(l.date)}</td>
                      <td>{l.kind === 'sale' ? <>{l.crop} {l.grade} · {num(l.quantity)}{l.rejected_qty > 0 && <span className="text-red-600"> (−{num(l.rejected_qty)} rej)</span>} × {money(l.rate, cur)} {l.status === 'disputed' && <Badge tone="red">disputed</Badge>}{l.vendor_note && <span className="text-slate-400"> “{l.vendor_note}”</span>}</> : <>Payment · {l.mode}{l.reference ? ` · ${l.reference}` : ''}</>}</td>
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

function EditVendor({ id, onDone }) {
  const { meta } = useAuth();
  const [row, setRow] = useState(null);
  useEffect(() => { api.get(`/r/parties/${id}`).then(setRow); }, [id]);
  return row ? <ResourceForm def={meta.resources.parties} row={row} onSaved={onDone} onDeleted={onDone} /> : <Spinner />;
}

export default function Vendors() {
  const { cur, meta } = useAuth();
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const load = () => api.get('/reports/receivables').then(setRows);
  useEffect(() => { load(); }, []);

  const list = (rows || []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.overdue - a.overdue || b.balance - a.balance);
  const tot = list.reduce((a, r) => ({ due: a.due + Math.max(0, r.balance), over: a.over + r.overdue }), { due: 0, over: 0 });

  return (
    <div className="space-y-4">
      <PageHeader title="Vendors" subtitle="Who buys from you, what they owe, and at what price">
        <button className="btn-primary" onClick={() => setAdding(true)}><Icon name="bi-plus-lg" /> Add vendor</button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-slate-500">Total receivable</div><div className="text-2xl font-bold">{money(tot.due, cur)}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-slate-500">Overdue</div><div className={cls('text-2xl font-bold', tot.over > 0 && 'text-red-600')}>{money(tot.over, cur)}</div></div>
      </div>
      <input className="input" placeholder="Search vendor" value={q} onChange={(e) => setQ(e.target.value)} />
      {!rows ? <Spinner /> : !list.length ? <Card><Empty text="No buyer vendors yet" /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <button key={r.party_id} onClick={() => setSel(r)} className={cls('card p-4 text-left hover:border-brand-400', r.overdue > 0 && 'border-l-4 border-l-red-500')}>
              <div className="flex justify-between items-start gap-2">
                <div className="font-semibold">{r.name}</div>
                {r.overdue > 0 ? <Badge tone="red">Overdue</Badge> : r.balance > 0 ? <Badge tone="amber">Due</Badge> : <Badge tone="green">Clear</Badge>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-slate-500 text-xs">Due now</div><div className="font-bold tabular-nums">{money(r.balance, cur)}</div></div>
                <div><div className="text-slate-500 text-xs">Overdue</div><div className={cls('font-bold tabular-nums', r.overdue > 0 && 'text-red-600')}>{money(r.overdue, cur)}</div></div>
              </div>
              <div className="mt-2 text-xs text-slate-500">Last sale {fdate(r.last_sale)} · last paid {fdate(r.last_payment)} · {r.credit_days}d credit</div>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name} wide>{sel && <Statement party={sel} onChanged={() => { load(); }} />}</Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add vendor" wide>
        {adding && <ResourceForm def={meta.resources.parties} onSaved={() => { setAdding(false); load(); }} />}
      </Modal>
    </div>
  );
}
