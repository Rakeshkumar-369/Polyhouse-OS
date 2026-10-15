// Quick sale / delivery entry: pick crop -> grade -> vendor -> quantity. Price comes from the vendor's price list.
import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Chips, Icon, PageHeader, useToast, Badge, Empty } from '../components/Ui';
import { useOptions } from '../components/Form';
import { money, num, todayISO, cls } from '../utils';

export default function Sell() {
  const { cur, role, on, meta } = useAuth();
  const toast = useToast();
  const canPrice = ['admin', 'manager'].includes(role);
  const grades = meta.org.settings.grades || ['A', 'B', 'C'];
  const [crops, setCrops] = useState([]);
  const vendors = useOptions('parties', { kind: 'buyer' });
  const farms = useOptions('farms');
  const blank = { date: todayISO(), crop_id: '', grade: 'A', party_id: '', quantity: '', rate: '', farm_id: '', invoice_no: '', order_id: '', notes: '' };
  const [f, setF] = useState(blank);
  const [price, setPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [todaySales, setTodaySales] = useState([]);
  const [stock, setStock] = useState([]);
  const [orders, setOrders] = useState([]);

  const refresh = useCallback(() => {
    api.get('/r/sales', { from: f.date, to: f.date }).then(setTodaySales).catch(() => {});
    api.get('/ops/produce-stock', { date: f.date }).then(setStock).catch(() => {});
    if (on('orders')) api.get('/r/orders', { status: 'open' }).then(setOrders).catch(() => {});
  }, [f.date, on]);
  useEffect(() => { api.get('/r/crops').then((c) => setCrops(c.filter((x) => x.active))); }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => { if (farms.length === 1 && !f.farm_id) setF((x) => ({ ...x, farm_id: farms[0].id })); }, [farms]); // eslint-disable-line

  useEffect(() => {
    if (!f.crop_id || !f.party_id) { setPrice(null); return; }
    api.get('/ops/price', { party_id: f.party_id, crop_id: f.crop_id, grade: f.grade, date: f.date }).then((p) => { setPrice(p); setF((x) => ({ ...x, rate: p.price })); });
  }, [f.crop_id, f.party_id, f.grade, f.date]);

  const crop = crops.find((c) => c.id == f.crop_id);
  const avail = stock.find((s) => s.crop_id == f.crop_id && s.grade === f.grade);
  const amount = (Number(f.quantity) || 0) * (Number(f.rate) || 0);
  const vendorOrders = orders.filter((o) => o.party_id == f.party_id && o.crop_id == f.crop_id);

  const save = async (e) => {
    e.preventDefault();
    if (!f.crop_id || !f.party_id || !(Number(f.quantity) > 0)) return toast('Pick crop, vendor and quantity', 'error');
    setBusy(true);
    try {
      const body = { ...f }; if (!canPrice) delete body.rate;
      const r = await api.post('/r/sales', body);
      toast(`Saved: ${num(r.quantity)} ${crop?.unit || ''} to ${r.party_id_label} = ${money(r.amount, cur)}`);
      setF((x) => ({ ...x, quantity: '', invoice_no: '', order_id: '', notes: '' }));
      refresh();
    } catch (e2) { toast(e2.message, 'error'); } finally { setBusy(false); }
  };

  const fillOrder = (o) => setF((x) => ({ ...x, party_id: o.party_id, crop_id: o.crop_id, grade: o.grade, quantity: o.quantity, order_id: o.id }));
  const totalToday = todaySales.reduce((a, s) => a + Number(s.amount), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <PageHeader title="Sell / deliver" subtitle="Crop → vendor → quantity. Price is applied from the vendor's price list." />
        <Card>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">1. Crop</label>
              {crops.length ? <Chips options={crops.map((c) => ({ value: c.id, label: c.name, color: c.color }))} value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v, order_id: '' })} /> : <p className="text-sm text-slate-500">No crops yet. Admin must add crops first.</p>}
            </div>
            <div>
              <label className="label">Grade</label>
              <Chips options={grades} value={f.grade} onChange={(v) => setF({ ...f, grade: v })} />
              {avail && <p className="text-xs text-slate-500 mt-1.5">Available to sell (last 3 days): <b>{num(avail.available)} {crop?.unit}</b> · plucked today {num(avail.harvested_today)}</p>}
            </div>
            <div>
              <label className="label">2. Vendor</label>
              {vendors.length <= 8 ? (
                <Chips options={vendors.map((v) => ({ value: v.id, label: v.label }))} value={f.party_id} onChange={(v) => setF({ ...f, party_id: v, order_id: '' })} />
              ) : (
                <select className="input" value={f.party_id} onChange={(e) => setF({ ...f, party_id: e.target.value, order_id: '' })}><option value="">— select vendor —</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">3. Quantity ({crop?.unit || 'kg'})</label>
                <input className="input !text-2xl !font-bold" type="number" step="any" inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="label">Rate / {crop?.unit || 'unit'}</label>
                <input className="input !text-2xl" type="number" step="any" inputMode="decimal" value={f.rate} disabled={!canPrice} onChange={(e) => setF({ ...f, rate: e.target.value })} />
                {price && <p className="text-[11px] text-slate-400 mt-1">from {price.source}</p>}
              </div>
            </div>
            {vendorOrders.length > 0 && (
              <div>
                <label className="label">Against order</label>
                <Chips options={[{ value: '', label: 'None' }, ...vendorOrders.map((o) => ({ value: o.id, label: `#${o.id} · ${num(o.quantity)} ${o.grade}` }))]} value={f.order_id} onChange={(v) => setF({ ...f, order_id: v })} />
              </div>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500">More: date, farm, slip no., note</summary>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div><label className="label">Date</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
                <div><label className="label">From farm</label><select className="input" value={f.farm_id} onChange={(e) => setF({ ...f, farm_id: e.target.value })}><option value="">—</option>{farms.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
                <div><label className="label">Invoice / slip no.</label><input className="input" value={f.invoice_no} onChange={(e) => setF({ ...f, invoice_no: e.target.value })} /></div>
                <div><label className="label">Note</label><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
              </div>
            </details>
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 text-white px-4 py-3">
              <div><div className="text-xs text-slate-400">Amount</div><div className="text-2xl font-bold tabular-nums">{money(amount, cur)}</div></div>
              <button className="btn bg-brand-500 hover:bg-brand-600 text-white !px-6 !py-3 text-base" disabled={busy}><Icon name="bi-check2-circle" /> Save sale</button>
            </div>
          </form>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4 lg:pt-14">
        {on('orders') && orders.length > 0 && (
          <Card title="Open orders">
            {orders.slice(0, 8).map((o) => (
              <button key={o.id} onClick={() => fillOrder(o)} className="w-full flex justify-between items-center py-2 border-b border-slate-100 last:border-0 text-sm text-left hover:text-brand-700">
                <span>{o.party_id_label} · {o.crop_id_label} {o.grade}</span><span className="font-semibold tabular-nums">{num(o.quantity)} <Icon name="bi-chevron-right" /></span>
              </button>
            ))}
          </Card>
        )}
        <Card title={`Sales on ${f.date === todayISO() ? 'today' : f.date}`} action={<Badge tone="green">{money(totalToday, cur)}</Badge>}>
          {todaySales.length ? todaySales.map((s) => (
            <div key={s.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
              <div><div className="font-medium">{s.party_id_label}</div><div className="text-slate-500">{s.crop_id_label} {s.grade} · {num(s.quantity)} × {money(s.rate, cur)}</div></div>
              <div className="text-right"><div className="font-semibold tabular-nums">{money(s.amount, cur)}</div><div className={cls('text-xs', s.status === 'disputed' ? 'text-red-600' : 'text-slate-400')}>{s.status}</div></div>
            </div>
          )) : <Empty text="No sales yet" />}
        </Card>
        <Card title="Produce stock (3 days)">
          {stock.length ? stock.map((s) => (
            <div key={`${s.crop_id}${s.grade}`} className="flex justify-between text-sm py-1">
              <span><span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: s.color }} />{s.crop} {s.grade}</span>
              <span className="tabular-nums">{num(s.harvested)} in · {num(s.sold)} sold · <b>{num(s.available)} left</b></span>
            </div>
          )) : <p className="text-sm text-slate-500">No harvest recorded recently.</p>}
        </Card>
      </div>
    </div>
  );
}
