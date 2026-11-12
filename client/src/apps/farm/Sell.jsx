// Sell / deliver: vendor -> one or more items (crop, grade, quantity) -> Save & make bill -> send on WhatsApp.
// Prices come from the vendor's price list (only owner / manager can type a different rate).
// "Same as last time" copies the vendor's previous bill; open orders can be added with one tap.
import { useEffect, useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Link } from '../../lib/router';
import { t } from '../../lib/i18n';
import { money, num, todayISO, cls } from '../../lib/format';
import { Card, Chips, Icon, PageHeader, useToast, Badge, Empty, Modal } from '../../ui/kit';
import { useOptions } from '../../ui/Form';
import BillSheet from '../../ui/BillSheet';

let seq = 0;
const blankDraft = (grade) => ({ crop_id: '', grade, quantity: '', rate: '', source: '', order_id: '' });

export default function Sell() {
  const { cur, role, on, meta } = useAuth();
  const toast = useToast();
  const canPrice = ['admin', 'manager'].includes(role);
  const grades = meta.org.settings.grades || ['A', 'B', 'C'];
  const billNow = on('billing') && meta.org.settings.billing?.when !== 'later';
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(todayISO());
  const [farm, setFarm] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(blankDraft(grades[0] || 'A'));
  const [busy, setBusy] = useState(false);
  const [bill, setBill] = useState(null);
  const [last, setLast] = useState(null);
  const crops = (useApi('/r/crops').data || []).filter((c) => c.active);
  const vendors = useOptions('parties', { kind: 'buyer' });
  const farms = useOptions('farms');
  const sales = useApi('/r/sales', { from: date, to: date });
  const stock = useApi('/ops/produce-stock', { date });
  const orders = useApi(on('orders') ? '/r/orders' : null, { status: 'open' });

  useEffect(() => { if (farms.length === 1 && !farm) setFarm(farms[0].id); }, [farms]); // eslint-disable-line
  const cropOf = (id) => crops.find((c) => String(c.id) === String(id));
  const priceOf = async (cropId, grade) => {
    if (!vendor || !cropId) return { price: '', source: '' };
    try { return await api.get('/ops/price', { party_id: vendor, crop_id: cropId, grade, date }); } catch { return { price: '', source: '' }; }
  };

  // price for the item being entered
  useEffect(() => {
    let live = true;
    if (!draft.crop_id || !vendor) return undefined;
    priceOf(draft.crop_id, draft.grade).then((p) => { if (live) setDraft((d) => ({ ...d, rate: p.price, source: p.source })); });
    return () => { live = false; };
  }, [draft.crop_id, draft.grade, vendor, date]); // eslint-disable-line

  // the vendor's previous bill, for "Same as last time"
  useEffect(() => {
    setLast(null);
    if (!vendor || !on('billing')) return;
    api.get('/bills', { party_id: vendor, status: 'issued', limit: 1 }).then(async (b) => { if (b[0]) setLast(await api.get(`/bills/${b[0].id}`)); }).catch(() => {});
  }, [vendor]); // eslint-disable-line

  // re-price items when the vendor changes
  useEffect(() => {
    if (!vendor || !items.length) return;
    Promise.all(items.map(async (it) => ({ ...it, ...(await priceOf(it.crop_id, it.grade)) }))).then((list) => setItems(list.map((x) => ({ ...x, rate: x.price ?? x.rate }))));
  }, [vendor]); // eslint-disable-line

  const draftOk = draft.crop_id && Number(draft.quantity) > 0;
  const addDraft = () => {
    if (!draftOk) return toast('Pick a crop and enter the quantity', 'error');
    setItems((l) => [...l, { ...draft, key: ++seq }]);
    setDraft((d) => ({ ...blankDraft(d.grade) }));
  };
  const editItem = (it) => { setItems((l) => l.filter((x) => x.key !== it.key)); setDraft(it); };
  const sameAsLast = async () => {
    const list = await Promise.all(last.lines.map(async (l) => {
      const c = crops.find((x) => x.name === l.crop); if (!c) return null;
      const p = await priceOf(c.id, l.grade);
      return { key: ++seq, crop_id: c.id, grade: l.grade, quantity: l.quantity, rate: p.price, source: p.source, order_id: '' };
    }));
    setItems(list.filter(Boolean));
  };
  const addOrder = async (o) => {
    const p = await priceOf(o.crop_id, o.grade);
    setVendor(o.party_id);
    setItems((l) => [...l, { key: ++seq, crop_id: o.crop_id, grade: o.grade, quantity: o.quantity, rate: p.price, source: p.source, order_id: o.id }]);
  };

  const all = [...items, ...(draftOk ? [draft] : [])];
  const total = all.reduce((a, x) => a + (Number(x.quantity) || 0) * (Number(x.rate) || 0), 0);

  const save = async () => {
    if (!vendor) return toast('Pick the vendor', 'error');
    if (!all.length) return toast('Add at least one item', 'error');
    setBusy(true);
    const lines = all.map((x) => ({ crop_id: x.crop_id, grade: x.grade, quantity: x.quantity, order_id: x.order_id || '', ...(canPrice ? { rate: x.rate } : {}) }));
    try {
      if (on('billing') && billNow) {
        const doc = await api.post('/bills', { party_id: vendor, date, farm_id: farm, notes: note, lines });
        setBill(doc);
      } else {
        for (const l of lines) await api.post('/r/sales', { ...l, party_id: vendor, date, farm_id: farm, notes: note });
        toast(`${t('Saved')}: ${lines.length} item(s) · ${money(total, cur)}${on('billing') ? ' · bill it later from Bills' : ''}`);
      }
      setItems([]); setDraft(blankDraft(draft.grade)); setNote('');
      sales.reload(); stock.reload(); orders.reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const crop = cropOf(draft.crop_id);
  const avail = (stock.data || []).find((s) => String(s.crop_id) === String(draft.crop_id) && s.grade === draft.grade);
  const vOrders = (orders.data || []).filter((o) => !vendor || String(o.party_id) === String(vendor));
  const today = sales.data || [];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3 min-w-0">
        <PageHeader title={t('Sell / deliver')} subtitle={billNow ? 'Vendor → items → Save & make bill → send it on WhatsApp' : 'Vendor → items → Save'} />
        <Card>
          <div className="space-y-4 pt-4">
            <div>
              <label className="label">{t('1. Vendor')}</label>
              {vendors.length <= 8 ? (
                <Chips options={vendors.map((v) => ({ value: v.id, label: v.label }))} value={vendor} onChange={setVendor} />
              ) : (
                <select className="input" value={vendor} onChange={(e) => setVendor(e.target.value)}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
              )}
              {!vendors.length && <p className="text-sm text-slate-500">No vendors yet. {canPrice ? <Link to="/m/parties?new=1" className="text-brand-700 underline">Add a vendor</Link> : 'The owner must add vendors first.'}</p>}
              {last && !items.length && (
                <button className="mt-2 chip-off !py-1.5 text-xs text-left max-w-full" onClick={sameAsLast}><Icon name="repeat" /> {t('Same as last time')}: {last.lines.slice(0, 3).map((l) => `${l.crop} ${num(l.quantity)}`).join(', ')}{last.lines.length > 3 ? '…' : ''}</button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
              <div className="flex items-center justify-between"><label className="label !mb-0">{t('2. Items')}</label>{items.length > 0 && <Badge tone="green">{items.length} {t('added')}</Badge>}</div>
              {crops.length ? <Chips options={crops.map((c) => ({ value: c.id, label: c.name, color: c.color }))} value={draft.crop_id} onChange={(v) => setDraft({ ...draft, crop_id: v, order_id: '' })} /> : <p className="text-sm text-slate-500">No crops yet. The owner must add crops first.</p>}
              <Chips options={grades} value={draft.grade} onChange={(v) => setDraft({ ...draft, grade: v })} />
              {avail && <p className="text-xs text-slate-500">{t('Available to sell')}: <b className="text-slate-700">{num(avail.available)} {crop?.unit}</b> · plucked today {num(avail.harvested_today)}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('Quantity')} ({crop?.unit || 'kg'})</label>
                  <input className="input !text-2xl !font-bold" type="number" step="any" inputMode="decimal" value={draft.quantity} placeholder="0"
                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addDraft()} />
                </div>
                <div>
                  <label className="label">{t('Rate / unit')}</label>
                  <input className="input !text-2xl" type="number" step="any" inputMode="decimal" value={draft.rate} disabled={!canPrice} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} />
                </div>
              </div>
              {draft.source && draft.source !== 'vendor price list' && (
                <p className="text-[11px] text-amber-700">No price set for this vendor — using the crop's usual price.{canPrice && <> <Link to="/m/price_list?new=1" className="underline font-semibold">Set it</Link></>}</p>
              )}
              <button className="btn-light w-full" onClick={addDraft} disabled={!draftOk}><Icon name="plus-lg" /> {t('Add another item')}</button>
            </div>

            {items.length > 0 && (
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {items.map((it) => {
                  const c = cropOf(it.crop_id);
                  return (
                    <div key={it.key} className="flex items-center gap-2 px-3 py-2">
                      <button className="flex-1 text-left min-w-0" onClick={() => editItem(it)} title="Tap to change">
                        <div className="font-semibold truncate"><span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ background: c?.color }} />{c?.name} {it.grade}{it.order_id ? <Badge tone="blue"> order</Badge> : null}</div>
                        <div className="text-xs text-slate-500">{num(it.quantity)} {c?.unit} × {money(it.rate, cur)}</div>
                      </button>
                      <b className="tabular-nums">{money(Number(it.quantity) * Number(it.rate), cur)}</b>
                      <button className="h-9 w-9 grid place-items-center rounded-full hover:bg-red-50 text-red-600" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} aria-label="Remove"><Icon name="x-lg" /></button>
                    </div>
                  );
                })}
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500 font-medium">{t('More details')}</summary>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <div><label className="label">{t('Date')}</label><input type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></div>
                <div><label className="label">{t('From farm')}</label><select className="input" value={farm} onChange={(e) => setFarm(e.target.value)}><option value="">—</option>{farms.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
                <div><label className="label">{t('Note')}</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vehicle no., remarks" /></div>
              </div>
            </details>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 sticky bottom-20 lg:bottom-2 z-10 shadow-lg">
              <div><div className="text-xs text-slate-400">{t('Amount')}{all.length > 1 ? ` · ${all.length} items` : ''}</div><div className="text-2xl font-bold tabular-nums">{money(total, cur)}</div></div>
              <button className="btn bg-brand-500 hover:bg-brand-600 text-white !px-5 !py-3 text-base" disabled={busy || !vendor || !all.length} onClick={save}>
                <Icon name={billNow ? 'receipt' : 'check2-circle'} /> {billNow ? t('Save & make bill') : t('Save sale')}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2 min-w-0 space-y-4 lg:pt-[60px]">
        {vOrders.length > 0 && (
          <Card title={t('Open orders')} sub="Tap to add to this delivery">
            {vOrders.slice(0, 8).map((o) => (
              <button key={o.id} onClick={() => addOrder(o)} className="w-full flex justify-between items-center gap-2 py-2 border-b border-slate-100 last:border-0 text-sm text-left hover:text-brand-700">
                <span className="truncate">{o.party_id_label} · {o.crop_id_label} {o.grade}</span><span className="font-semibold tabular-nums shrink-0">{num(o.quantity)} <Icon name="plus-circle-dotted" /></span>
              </button>
            ))}
          </Card>
        )}
        <Card title={date === todayISO() ? t('Sales today') : `${t('Sales')} ${date}`} action={<Badge tone="green">{money(today.reduce((a, s) => a + Number(s.amount), 0), cur)}</Badge>}>
          {today.length ? today.map((s) => (
            <div key={s.id} className="flex justify-between gap-2 py-2 border-b border-slate-100 last:border-0 text-sm">
              <div className="min-w-0"><div className="font-medium truncate">{s.party_id_label}</div><div className="text-slate-500 truncate">{s.crop_id_label} {s.grade} · {num(s.quantity)} × {money(s.rate, cur)}{s.bill_no ? ` · ${s.bill_no}` : ''}</div></div>
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

      <Modal open={!!bill} onClose={() => setBill(null)} title={t('Bill ready')}>
        {bill && (
          <div className="space-y-3">
            <BillSheet doc={bill} onSent={() => toast(t('Sent'))} />
            <button className="btn-light w-full" onClick={() => setBill(null)}><Icon name="plus-lg" /> {t('Next sale')}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
