// Vendor login: deliveries received (confirm / report rejection), statement & dues, today's prices, place orders
import { useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { money, num, fdate, cls, todayISO, addDays } from '../../lib/format';
import { Card, Icon, Spinner, Badge, Empty, Modal, useToast, Chips, Tabs, ErrorBox } from '../../ui/kit';
import { useOptions } from '../../ui/Form';
import LangSwitch from '../../ui/LangSwitch';

export function PortalHeader({ title, sub }) {
  const { logout } = useAuth();
  return (
    <header className="bg-gradient-to-r from-brand-800 to-brand-600 text-white px-4 pt-4 pb-12">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <img src="/favicon.svg" className="h-9 w-9" alt="" />
        <div className="flex-1 min-w-0"><div className="text-xs text-brand-100 truncate">{sub}</div><div className="font-bold text-lg truncate">{title}</div></div>
        <LangSwitch className="!bg-white/10 !border-white/30 !text-white" />
        <button className="h-9 w-9 rounded-full bg-white/10 grid place-items-center" onClick={logout} aria-label={t('Logout')}><Icon name="box-arrow-right" /></button>
      </div>
    </header>
  );
}

export default function VendorApp() {
  const { meta, cur } = useAuth();
  const toast = useToast();
  const { data: d, error, reload } = useApi('/portal/vendor');
  const [tab, setTab] = useState('deliveries');
  const [check, setCheck] = useState(null);
  const [order, setOrder] = useState(null);
  const crops = useOptions('crops');

  const confirmSale = async (e) => {
    e.preventDefault();
    try { await api.put(`/portal/vendor/sales/${check.id}`, check); toast('Thank you, recorded'); setCheck(null); reload(); } catch (e2) { toast(e2.message, 'error'); }
  };
  const placeOrder = async (e) => {
    e.preventDefault();
    try { await api.post('/portal/vendor/orders', order); toast('Order sent to farm'); setOrder(null); reload(); } catch (e2) { toast(e2.message, 'error'); }
  };
  const sales = d ? d.lines.filter((l) => l.kind === 'sale').reverse() : [];

  return (
    <div className="min-h-screen pb-10">
      <PortalHeader title={meta.user.name} sub={d?.org.name || meta.org.name} />
      <main className="max-w-3xl mx-auto px-4 -mt-8 space-y-4">
        {error && <ErrorBox text={error} />}
        {!d ? !error && <Spinner /> : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4"><div className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">{t('You owe')}</div><div className="text-2xl font-bold">{money(d.closing, cur)}</div></div>
              <div className="card p-4"><div className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">{t('Overdue')}</div><div className={cls('text-2xl font-bold', d.overdue > 0 && 'text-red-600')}>{money(d.overdue, cur)}</div></div>
            </div>
            <Tabs tabs={[['deliveries', 'Deliveries'], ['statement', 'Statement'], ['prices', 'Prices'], ...(d.ordersOn ? [['orders', 'My orders']] : [])]} value={tab} onChange={setTab} />
            {tab === 'deliveries' && (
              <Card pad={false}>
                {sales.length ? sales.map((s) => (
                  <div key={s.id} className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0"><div className="font-medium">{s.crop} {s.grade} · {num(s.quantity)} {s.unit}</div><div className="text-xs text-slate-500">{fdate(s.date)} · {money(s.rate, cur)}/{s.unit}{s.rejected_qty > 0 && ` · rejected ${num(s.rejected_qty)}`}</div></div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{money(s.amount, cur)}</div>
                      {s.status === 'delivered' && s.date >= addDays(todayISO(), -7)
                        ? <button className="text-xs text-brand-700 font-semibold" onClick={() => setCheck({ id: s.id, rejected_qty: 0, vendor_note: '', s })}>{t('Confirm')}</button>
                        : <Badge tone={s.status === 'accepted' ? 'green' : s.status === 'disputed' ? 'red' : 'slate'}>{t(s.status)}</Badge>}
                    </div>
                  </div>
                )) : <Empty text="No deliveries in the last 30 days" />}
              </Card>
            )}
            {tab === 'statement' && (
              <Card pad={false} className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>{t('Date')}</th><th>Details</th><th className="num">{t('Amount')}</th><th className="num">Balance</th></tr></thead>
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
              <Card title={t('Your prices today')}>
                {d.prices.length ? d.prices.map((p) => <div key={p.crop + p.grade} className="flex justify-between py-2 border-b border-slate-100 last:border-0"><span>{p.crop} · {t('Grade')} {p.grade}</span><b>{money(p.price, cur)}/{p.unit}</b></div>) : <Empty text="No prices set" />}
              </Card>
            )}
            {tab === 'orders' && (
              <div className="space-y-3">
                <button className="btn-primary w-full !py-3" onClick={() => setOrder({ date: addDays(todayISO(), 1), crop_id: '', grade: 'A', quantity: '', notes: '' })}><Icon name="cart-plus" /> {t('Place an order')}</button>
                <Card pad={false}>
                  {d.orders.length ? d.orders.map((o) => (
                    <div key={o.id} className="px-4 py-3 border-b border-slate-100 last:border-0 flex justify-between items-center gap-2">
                      <div className="min-w-0"><div className="font-medium">{o.crop} {o.grade} · {num(o.quantity)} {o.unit}</div><div className="text-xs text-slate-500 truncate">for {fdate(o.date)}{o.notes ? ` · ${o.notes}` : ''}</div></div>
                      <div className="flex items-center gap-2"><Badge tone={o.status === 'fulfilled' ? 'green' : o.status === 'open' ? 'amber' : 'slate'}>{t(o.status)}</Badge>
                        {o.status === 'open' && <button className="text-xs text-red-600" onClick={async () => { await api.del(`/portal/vendor/orders/${o.id}`); reload(); }}>{t('Cancel')}</button>}</div>
                    </div>
                  )) : <Empty text="No orders yet" />}
                </Card>
              </div>
            )}
          </>
        )}
      </main>
      <Modal open={!!check} onClose={() => setCheck(null)} title={t('Confirm delivery')}>
        {check && (
          <form onSubmit={confirmSale} className="space-y-3">
            <p className="text-sm">{check.s.crop} {check.s.grade} · <b>{num(check.s.quantity)} {check.s.unit}</b> · {fdate(check.s.date)}</p>
            <div><label className="label">{t('Rejected quantity (0 if all good)')}</label><input type="number" step="any" inputMode="decimal" className="input" value={check.rejected_qty} onChange={(e) => setCheck({ ...check, rejected_qty: e.target.value })} /></div>
            <div><label className="label">{t('Remark')}</label><input className="input" value={check.vendor_note} onChange={(e) => setCheck({ ...check, vendor_note: e.target.value })} placeholder="e.g. 3 kg soft fruit" /></div>
            <button className="btn-primary w-full !py-3">{t('Confirm')}</button>
          </form>
        )}
      </Modal>
      <Modal open={!!order} onClose={() => setOrder(null)} title={t('Place an order')}>
        {order && (
          <form onSubmit={placeOrder} className="space-y-3">
            <div><label className="label">{t('Crop')}</label><Chips options={crops.map((c) => ({ value: c.id, label: c.label }))} value={order.crop_id} onChange={(v) => setOrder({ ...order, crop_id: v })} /></div>
            <div><label className="label">{t('Grade')}</label><Chips options={meta.org.settings.grades || ['A', 'B', 'C']} value={order.grade} onChange={(v) => setOrder({ ...order, grade: v })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t('Quantity')}</label><input type="number" step="any" inputMode="decimal" required className="input" value={order.quantity} onChange={(e) => setOrder({ ...order, quantity: e.target.value })} /></div>
              <div><label className="label">{t('Needed on')}</label><input type="date" required className="input" value={order.date} onChange={(e) => setOrder({ ...order, date: e.target.value })} /></div>
            </div>
            <div><label className="label">{t('Note')}</label><input className="input" value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></div>
            <button className="btn-primary w-full !py-3">{t('Send order')}</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
