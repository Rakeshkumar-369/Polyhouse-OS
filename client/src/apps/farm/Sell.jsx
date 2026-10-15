// Quick sale / delivery: crop -> grade -> vendor -> quantity. Price comes from the vendor's price list (admin sets it).
import { useEffect, useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { money, num, todayISO, cls } from '../../lib/format';
import { Card, Chips, Icon, PageHeader, useToast, Badge, Empty } from '../../ui/kit';
import { useOptions } from '../../ui/Form';

export default function Sell() {
  const { cur, role, on, meta } = useAuth();
  const toast = useToast();
  const canPrice = ['admin', 'manager'].includes(role);
  const grades = meta.org.settings.grades || ['A', 'B', 'C'];
  const blank = { date: todayISO(), crop_id: '', grade: grades[0] || 'A', party_id: '', quantity: '', rate: '', farm_id: '', invoice_no: '', order_id: '', notes: '' };
  const [f, setF] = useState(blank);
  const [price, setPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const crops = (useApi('/r/crops').data || []).filter((c) => c.active);
  const vendors = useOptions('parties', { kind: 'buyer' });
  const farms = useOptions('farms');
  const sales = useApi('/r/sales', { from: f.date, to: f.date });
  const stock = useApi('/ops/produce-stock', { date: f.date });
  const orders = useApi(on('orders') ? '/r/orders' : null, { status: 'open' });

  useEffect(() => { if (farms.length === 1 && !f.farm_id) setF((x) => ({ ...x, farm_id: farms[0].id })); }, [farms]); // eslint-disable-line
  useEffect(() => {
    if (!f.crop_id || !f.party_id) { setPrice(null); return; }
    api.get('/ops/price', { party_id: f.party_id, crop_id: f.crop_id, grade: f.grade, date: f.date }).then((p) => { setPrice(p); setF((x) => ({ ...x, rate: p.price })); }).catch(() => {});
  }, [f.crop_id, f.party_id, f.grade, f.date]);

  const crop = crops.find((c) => String(c.id) === String(f.crop_id));
  const avail = (stock.data || []).find((s) => String(s.crop_id) === String(f.crop_id) && s.grade === f.grade);
  const amount = (Number(f.quantity) || 0) * (Number(f.rate) || 0);
  const openOrders = orders.data || [];
  const vendorOrders = openOrders.filter((o) => String(o.party_id) === String(f.party_id) && String(o.crop_id) === String(f.crop_id));
  const today = sales.data || [];

  const save = async (e) => {
    e.preventDefault();
    if (!f.crop_id || !f.party_id || !(Number(f.quantity) > 0)) return toast('Pick crop, vendor and quantity', 'error');
    setBusy(true);
    try {
      const body = { ...f }; if (!canPrice) delete body.rate;
      const r = await api.post('/r/sales', body);
      toast(`${num(r.quantity)} ${crop?.unit || ''} → ${r.party_id_label} = ${money(r.amount, cur)}`);
      setF((x) => ({ ...x, quantity: '', invoice_no: '', order_id: '', notes: '' }));
      sales.reload(); stock.reload(); orders.reload();
    } catch (e2) { toast(e2.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PageHeader title={t('Sell / deliver')} subtitle="Crop → vendor → quantity. The vendor's price is applied automatically." />
        <Card>
          <form onSubmit={save} className="space-y-4 pt-4">
            <div>
              <label className="label">{t('1. Crop')}</label>
              {crops.length ? <Chips options={crops.map((c) => ({ value: c.id, label: c.name, color: c.color }))} value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v, order_id: '' })} /> : <p className="text-sm text-slate-500">No crops yet. The owner must add crops first.</p>}
            </div>
            <div>
              <label className="label">{t('Grade')}</label>
              <Chips options={grades} value={f.grade} onChange={(v) => setF({ ...f, grade: v })} />
              {avail && <p className="text-xs text-slate-500 mt-1.5">{t('Available to sell')}: <b className="text-slate-700">{num(avail.available)} {crop?.unit}</b> · plucked today {num(avail.harvested_today)}</p>}
            </div>
            <div>
              <label className="label">{t('2. Vendor')}</label>
              {vendors.length <= 8 ? (
                <Chips options={vendors.map((v) => ({ value: v.id, label: v.label }))} value={f.party_id} onChange={(v) => setF({ ...f, party_id: v, order_id: '' })} />
              ) : (
                <select className="input" value={f.party_id} onChange={(e) => setF({ ...f, party_id: e.target.value, order_id: '' })}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
              )}
              {!vendors.length && <p className="text-sm text-slate-500">No vendors yet. The owner must add vendors first.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('3. Quantity')} ({crop?.unit || 'kg'})</label>
                <input className="input !text-2xl !font-bold" type="number" step="any" inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="label">{t('Rate / unit')}</label>
                <input className="input !text-2xl" type="number" step="any" inputMode="decimal" value={f.rate} disabled={!canPrice} onChange={(e) => setF({ ...f, rate: e.target.value })} />
                {price && <p className="text-[11px] text-slate-400 mt-1">from {price.source}</p>}
              </div>
            </div>
            {vendorOrders.length > 0 && (
              <div><label className="label">{t('Against order')}</label>
                <Chips options={[{ value: '', label: 'None' }, ...vendorOrders.map((o) => ({ value: o.id, label: `#${o.id} · ${num(o.quantity)} ${o.grade}` }))]} value={f.order_id} onChange={(v) => setF({ ...f, order_id: v })} />
              </div>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500 font-medium">{t('More details')}</summary>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div><label className="label">{t('Date')}</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
                <div><label className="label">{t('From farm')}</label><select className="input" value={f.farm_id} onChange={(e) => setF({ ...f, farm_id: e.target.value })}><option value="">—</option>{farms.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
                <div><label className="label">{t('Invoice / slip no.')}</label><input className="input" value={f.invoice_no} onChange={(e) => setF({ ...f, invoice_no: e.target.value })} /></div>
                <div><label className="label">{t('Note')}</label><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
              </div>
            </details>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3">
              <div><div className="text-xs text-slate-400">{t('Amount')}</div><div className="text-2xl font-bold tabular-nums">{money(amount, cur)}</div></div>
              <button className="btn bg-brand-500 hover:bg-brand-600 text-white !px-5 !py-3 text-base" disabled={busy}><Icon name="check2-circle" /> {t('Save sale')}</button>
            </div>
          </form>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4 lg:pt-[60px]">
        {openOrders.length > 0 && (
          <Card title={t('Open orders')}>
            {openOrders.slice(0, 8).map((o) => (
              <button key={o.id} onClick={() => setF((x) => ({ ...x, party_id: o.party_id, crop_id: o.crop_id, grade: o.grade, quantity: o.quantity, order_id: o.id }))} className="w-full flex justify-between items-center gap-2 py-2 border-b border-slate-100 last:border-0 text-sm text-left hover:text-brand-700">
                <span className="truncate">{o.party_id_label} · {o.crop_id_label} {o.grade}</span><span className="font-semibold tabular-nums shrink-0">{num(o.quantity)} <Icon name="chevron-right" /></span>
              </button>
            ))}
          </Card>
        )}
        <Card title={f.date === todayISO() ? t('Sales today') : `${t('Sales')} ${f.date}`} action={<Badge tone="green">{money(today.reduce((a, s) => a + Number(s.amount), 0), cur)}</Badge>}>
          {today.length ? today.map((s) => (
            <div key={s.id} className="flex justify-between gap-2 py-2 border-b border-slate-100 last:border-0 text-sm">
              <div className="min-w-0"><div className="font-medium truncate">{s.party_id_label}</div><div className="text-slate-500 truncate">{s.crop_id_label} {s.grade} · {num(s.quantity)} × {money(s.rate, cur)}</div></div>
              <div className="text-right shrink-0"><div className="font-semibold tabular-nums">{money(s.amount, cur)}</div><div className={cls('text-xs', s.status === 'disputed' ? 'text-red-600' : 'text-slate-400')}>{t(s.status)}</div></div>
            </div>
          )) : <Empty text="No sales yet" />}
        </Card>
        <Card title={t('Produce stock (3 days)')}>
          {(stock.data || []).length ? stock.data.map((s) => (
            <div key={`${s.crop_id}${s.grade}`} className="flex justify-between gap-2 text-sm py-1">
              <span className="truncate"><span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: s.color }} />{s.crop} {s.grade}</span>
              <span className="tabular-nums shrink-0 text-slate-500">{num(s.harvested)} in · {num(s.sold)} sold · <b className="text-slate-800">{num(s.available)} left</b></span>
            </div>
          )) : <p className="text-sm text-slate-500">No harvest recorded recently.</p>}
        </Card>
      </div>
    </div>
  );
}
