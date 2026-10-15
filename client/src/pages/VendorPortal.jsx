// Vendor login: deliveries received, accept / report rejection, statement & dues, today's prices, place orders
import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, Spinner, Badge, Empty, Modal, useToast, Chips } from '../components/Ui';
import { useOptions } from '../components/Form';
import { money, num, fdate, cls, todayISO, addDays } from '../utils';

export default function VendorPortal() {
  const { meta, logout, cur } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('deliveries');
  const [check, setCheck] = useState(null);
  const [order, setOrder] = useState(null);
  const crops = useOptions('crops');
  const load = useCallback(() => api.get('/portal/vendor').then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const confirmSale = async (e) => {
    e.preventDefault();
    try { await api.put(`/portal/vendor/sales/${check.id}`, check); toast('Thank you, recorded'); setCheck(null); load(); } catch (e2) { toast(e2.message, 'error'); }
  };
  const placeOrder = async (e) => {
    e.preventDefault();
    try { await api.post('/portal/vendor/orders', order); toast('Order sent to farm'); setOrder(null); load(); } catch (e2) { toast(e2.message, 'error'); }
  };

  const sales = d ? d.lines.filter((l) => l.kind === 'sale').reverse() : [];
  return (
    <div className="min-h-screen pb-10">
      <header className="bg-brand-800 text-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1"><div className="text-xs text-brand-200">{d?.org.name || 'Supplier'}</div><div className="font-bold text-lg">{meta.user.name}</div></div>
          <button className="btn bg-white/10 text-white" onClick={logout}><Icon name="bi-box-arrow-right" /></button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {err && <Card><Empty icon="bi-lock" text={err} /></Card>}
        {!d && !err ? <Spinner /> : d && (
          <>
            <div className="grid grid-cols-2 gap-3 -mt-8">
              <div className="card p-4"><div className="text-xs text-slate-500 uppercase font-semibold">You owe</div><div className="text-2xl font-bold">{money(d.closing, cur)}</div></div>
              <div className="card p-4"><div className="text-xs text-slate-500 uppercase font-semibold">Overdue</div><div className={cls('text-2xl font-bold', d.overdue > 0 && 'text-red-600')}>{money(d.overdue, cur)}</div></div>
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {[['deliveries', 'Deliveries'], ['statement', 'Statement'], ['prices', 'Prices'], ...(d.ordersOn ? [['orders', 'My orders']] : [])].map(([k, l]) => <button key={k} className={k === tab ? 'chip-on whitespace-nowrap' : 'chip-off whitespace-nowrap'} onClick={() => setTab(k)}>{l}</button>)}
            </div>
            {tab === 'deliveries' && (
              <Card pad={false}>
                {sales.length ? sales.map((s) => (
                  <div key={s.id} className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{s.crop} {s.grade} · {num(s.quantity)} {s.unit}</div>
                      <div className="text-xs text-slate-500">{fdate(s.date)} · {money(s.rate, cur)}/{s.unit}{s.rejected_qty > 0 && ` · rejected ${num(s.rejected_qty)}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{money(s.amount, cur)}</div>
                      {s.status === 'delivered' && s.date >= addDays(todayISO(), -7)
                        ? <button className="text-xs text-brand-700 font-semibold" onClick={() => setCheck({ id: s.id, rejected_qty: 0, vendor_note: '', s })}>Confirm</button>
                        : <Badge tone={s.status === 'accepted' ? 'green' : s.status === 'disputed' ? 'red' : 'slate'}>{s.status}</Badge>}
                    </div>
                  </div>
                )) : <Empty text="No deliveries in the last 30 days" />}
              </Card>
            )}
            {tab === 'statement' && (
              <Card pad={false} className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Details</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
                  <tbody>
                    <tr className="bg-slate-50"><td colSpan={3}>Opening</td><td className="num">{money(d.opening, cur)}</td></tr>
                    {d.lines.map((l) => (
                      <tr key={l.kind + l.id}><td>{fdate(l.date)}</td><td>{l.kind === 'sale' ? `${l.crop} ${num(l.quantity)} × ${money(l.rate, cur)}` : `Paid · ${l.mode}`}</td>
                        <td className={cls('num', l.kind === 'payment' && 'text-brand-700')}>{l.kind === 'payment' ? '−' : ''}{money(l.amount, cur)}</td><td className="num">{money(l.balance, cur)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            {tab === 'prices' && (
              <Card title="Your prices today">
                {d.prices.length ? d.prices.map((p) => <div key={p.crop + p.grade} className="flex justify-between py-2 border-b border-slate-100 last:border-0"><span>{p.crop} · Grade {p.grade}</span><b>{money(p.price, cur)}/{p.unit}</b></div>) : <Empty text="No prices set" />}
              </Card>
            )}
            {tab === 'orders' && (
              <div className="space-y-3">
                <button className="btn-primary w-full" onClick={() => setOrder({ date: addDays(todayISO(), 1), crop_id: '', grade: 'A', quantity: '', notes: '' })}><Icon name="bi-cart-plus" /> Place an order</button>
                <Card pad={false}>
                  {d.orders.length ? d.orders.map((o) => (
                    <div key={o.id} className="px-4 py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
                      <div><div className="font-medium">{o.crop} {o.grade} · {num(o.quantity)} {o.unit}</div><div className="text-xs text-slate-500">for {fdate(o.date)}{o.notes ? ` · ${o.notes}` : ''}</div></div>
                      <div className="flex items-center gap-2"><Badge tone={o.status === 'fulfilled' ? 'green' : o.status === 'open' ? 'amber' : 'slate'}>{o.status}</Badge>
                        {o.status === 'open' && <button className="text-xs text-red-600" onClick={async () => { await api.del(`/portal/vendor/orders/${o.id}`); load(); }}>Cancel</button>}</div>
                    </div>
                  )) : <Empty text="No orders yet" />}
                </Card>
              </div>
            )}
          </>
        )}
      </main>
      <Modal open={!!check} onClose={() => setCheck(null)} title="Confirm delivery">
        {check && (
          <form onSubmit={confirmSale} className="space-y-3">
            <p className="text-sm">{check.s.crop} {check.s.grade} · <b>{num(check.s.quantity)} {check.s.unit}</b> on {fdate(check.s.date)}</p>
            <div><label className="label">Rejected quantity (0 if all good)</label><input type="number" step="any" className="input" value={check.rejected_qty} onChange={(e) => setCheck({ ...check, rejected_qty: e.target.value })} /></div>
            <div><label className="label">Remark</label><input className="input" value={check.vendor_note} onChange={(e) => setCheck({ ...check, vendor_note: e.target.value })} placeholder="e.g. 3 kg soft fruit" /></div>
            <button className="btn-primary w-full">Confirm</button>
          </form>
        )}
      </Modal>
      <Modal open={!!order} onClose={() => setOrder(null)} title="New order">
        {order && (
          <form onSubmit={placeOrder} className="space-y-3">
            <div><label className="label">Crop</label><Chips options={crops.map((c) => ({ value: c.id, label: c.label }))} value={order.crop_id} onChange={(v) => setOrder({ ...order, crop_id: v })} /></div>
            <div><label className="label">Grade</label><Chips options={meta.org.settings.grades || ['A', 'B', 'C']} value={order.grade} onChange={(v) => setOrder({ ...order, grade: v })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Quantity</label><input type="number" step="any" required className="input" value={order.quantity} onChange={(e) => setOrder({ ...order, quantity: e.target.value })} /></div>
              <div><label className="label">Needed on</label><input type="date" required className="input" value={order.date} onChange={(e) => setOrder({ ...order, date: e.target.value })} /></div>
            </div>
            <div><label className="label">Note</label><input className="input" value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></div>
            <button className="btn-primary w-full">Send order</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
