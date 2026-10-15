// Quick expense / purchase entry: category -> amount -> who/where. Purchases of stock items add to Input stock.
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Chips, Icon, PageHeader, useToast, Empty, Badge } from '../components/Ui';
import { useOptions, FieldInput } from '../components/Form';
import { money, num, todayISO, fdate } from '../utils';

export default function Spend() {
  const { cur, role, on } = useAuth();
  const toast = useToast();
  const isMgr = ['admin', 'manager'].includes(role);
  const cats = useOptions('expense_categories');
  const farms = useOptions('farms');
  const parties = useOptions('parties');
  const items = useOptions('inventory_items', {}, !on('inventory'));
  const cycles = useOptions('crop_cycles', {}, !on('crop_cycles'));
  const blank = { date: todayISO(), category_id: '', description: '', amount: '', item_id: '', quantity: '', rate: '', party_id: '', farm_id: '', crop_cycle_id: '', payment_mode: 'cash', paid_amount: '', bill_no: '', bill_file: '' };
  const [f, setF] = useState(blank);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { if (isMgr) api.get('/r/expenses', { limit: 15 }).then(setList).catch(() => {}); }, [isMgr]);
  useEffect(refresh, [refresh]);
  useEffect(() => { if (f.quantity && f.rate) setF((x) => ({ ...x, amount: String(Math.round(Number(x.quantity) * Number(x.rate) * 100) / 100) })); }, [f.quantity, f.rate]);

  const save = async (e) => {
    e.preventDefault();
    if (!f.category_id || !(Number(f.amount) > 0)) return toast('Pick category and enter amount', 'error');
    setBusy(true);
    try {
      await api.post('/r/expenses', f);
      toast(`Saved ${money(f.amount, cur)}`); setF({ ...blank, date: f.date }); refresh();
    } catch (e2) { toast(e2.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <PageHeader title="Spend" subtitle="Seeds, trays, grow bags, labour, rent, current — every rupee spent" />
        <Card>
          <form onSubmit={save} className="space-y-4">
            <div><label className="label">What did you pay for?</label>
              <Chips options={cats.map((c) => ({ value: c.id, label: c.label }))} value={f.category_id} onChange={(v) => setF({ ...f, category_id: v })} />
            </div>
            {on('inventory') && items.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1"><label className="label">Stock item (optional)</label><select className="input" value={f.item_id} onChange={(e) => setF({ ...f, item_id: e.target.value })}><option value="">—</option>{items.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
                <div><label className="label">Qty</label><input className="input" type="number" step="any" inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
                <div><label className="label">Rate</label><input className="input" type="number" step="any" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Amount ({cur})</label><input className="input !text-2xl !font-bold" type="number" step="any" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></div>
              <div><label className="label">Paid by</label><select className="input !py-3" value={f.payment_mode} onChange={(e) => setF({ ...f, payment_mode: e.target.value })}>{['cash', 'upi', 'bank', 'cheque', 'credit'].map((m) => <option key={m} value={m}>{m === 'credit' ? 'credit (pay later)' : m}</option>)}</select></div>
            </div>
            <div><label className="label">Description</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. 500 grow bags, October current bill" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="label">Paid to / supplier</label><select className="input" value={f.party_id} onChange={(e) => setF({ ...f, party_id: e.target.value })}><option value="">—</option>{parties.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
              <div><label className="label">Farm (blank = shared)</label><select className="input" value={f.farm_id} onChange={(e) => setF({ ...f, farm_id: e.target.value })}><option value="">Shared</option>{farms.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
              {on('crop_cycles') && <div><label className="label">Crop cycle (direct cost)</label><select className="input" value={f.crop_cycle_id} onChange={(e) => setF({ ...f, crop_cycle_id: e.target.value })}><option value="">—</option>{cycles.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>}
              <div><label className="label">Date</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              {f.payment_mode === 'credit' && <div><label className="label">Paid now (rest is due)</label><input className="input" type="number" value={f.paid_amount} onChange={(e) => setF({ ...f, paid_amount: e.target.value })} placeholder="0" /></div>}
              <div><label className="label">Bill no.</label><input className="input" value={f.bill_no} onChange={(e) => setF({ ...f, bill_no: e.target.value })} /></div>
              <div><label className="label">Bill photo</label><FieldInput field={{ name: 'bill_file', type: 'file' }} value={f.bill_file} onChange={(v) => setF({ ...f, bill_file: v })} /></div>
            </div>
            <button className="btn-primary w-full !py-3 text-base" disabled={busy}><Icon name="bi-check2-circle" /> Save expense</button>
          </form>
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-4 lg:pt-14">
        {isMgr && (
          <Card title="Recent expenses" action={<Link to="/m/expenses" className="text-sm text-brand-700 font-medium">All</Link>}>
            {list.length ? list.map((e) => (
              <div key={e.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                <div className="min-w-0"><div className="font-medium truncate">{e.category_id_label}{e.description ? ` · ${e.description}` : ''}</div><div className="text-slate-500">{fdate(e.date)}{e.party_id_label ? ` · ${e.party_id_label}` : ''}{e.item_id ? ` · ${num(e.quantity)} in stock` : ''}</div></div>
                <div className="font-semibold tabular-nums shrink-0">{money(e.amount, cur)}</div>
              </div>
            )) : <Empty text="No expenses yet" />}
          </Card>
        )}
        {isMgr && on('recurring') && (
          <Card title="Recurring payments">
            <p className="text-sm text-slate-500 mb-3">Rent, current bill, salaries and EMIs can be added once and posted automatically every month.</p>
            <Link to="/m/recurring_expenses" className="btn-outline w-full"><Icon name="bi-calendar2-check" /> Manage recurring</Link>
          </Card>
        )}
        {on('inventory') && <Link to="/m/stock_moves?new=1" className="btn-light w-full"><Icon name="bi-box-arrow-up" /> Issue stock to farm (use)</Link>}
        <div className="flex gap-2"><Badge>Tip</Badge><span className="text-xs text-slate-500">Choose "credit" to record a purchase you'll pay later — it shows as payable in the balance sheet.</span></div>
      </div>
    </div>
  );
}
