// Quick expense / purchase entry: category -> amount -> who/where. Purchases of stock items add to Input stock.
import { useEffect, useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Link } from '../../lib/router';
import { t } from '../../lib/i18n';
import { money, num, todayISO, fdate } from '../../lib/format';
import { Card, Chips, Icon, PageHeader, useToast, Empty } from '../../ui/kit';
import { useOptions, FieldInput } from '../../ui/Form';

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
  const [busy, setBusy] = useState(false);
  const recent = useApi(isMgr ? '/r/expenses' : null, { limit: 12 });

  useEffect(() => { if (f.quantity && f.rate) setF((x) => ({ ...x, amount: String(Math.round(Number(x.quantity) * Number(x.rate) * 100) / 100) })); }, [f.quantity, f.rate]);

  const save = async (e) => {
    e.preventDefault();
    if (!f.category_id || !(Number(f.amount) > 0)) return toast('Pick category and enter amount', 'error');
    setBusy(true);
    try { await api.post('/r/expenses', f); toast(`${t('Saved')} ${money(f.amount, cur)}`); setF({ ...blank, date: f.date }); recent.reload(); } catch (e2) { toast(e2.message, 'error'); } finally { setBusy(false); }
  };
  const sel = (k, opts, label, empty = '—') => (
    <div><label className="label">{t(label)}</label><select className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">{empty}</option>{opts.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PageHeader title={t('Spend')} subtitle="Seeds, trays, grow bags, labour, rent, current — every rupee spent" />
        <Card>
          <form onSubmit={save} className="space-y-4 pt-4">
            <div><label className="label">{t('What did you pay for?')}</label>
              <Chips options={cats.map((c) => ({ value: c.id, label: c.label }))} value={f.category_id} onChange={(v) => setF({ ...f, category_id: v })} />
            </div>
            {on('inventory') && items.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">{sel('item_id', items, 'Stock item (optional)')}</div>
                <div><label className="label">{t('Qty')}</label><input className="input" type="number" step="any" inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
                <div><label className="label">{t('Rate')}</label><input className="input" type="number" step="any" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t('Amount')} ({cur})</label><input className="input !text-2xl !font-bold" type="number" step="any" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></div>
              <div><label className="label">{t('Paid by')}</label><select className="input !py-3" value={f.payment_mode} onChange={(e) => setF({ ...f, payment_mode: e.target.value })}>{['cash', 'upi', 'bank', 'cheque', 'credit'].map((m) => <option key={m} value={m}>{m === 'credit' ? 'credit (pay later)' : m.toUpperCase()}</option>)}</select></div>
            </div>
            <div><label className="label">{t('Description')}</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. 500 grow bags, October current bill" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              {sel('party_id', parties, 'Paid to / supplier')}
              {sel('farm_id', farms, 'Farm (blank = shared)', 'Shared')}
              {on('crop_cycles') && sel('crop_cycle_id', cycles, 'Crop cycle')}
              <div><label className="label">{t('Date')}</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              {f.payment_mode === 'credit' && <div><label className="label">Paid now (rest is due)</label><input className="input" type="number" value={f.paid_amount} onChange={(e) => setF({ ...f, paid_amount: e.target.value })} placeholder="0" /></div>}
              <div><label className="label">{t('Bill no.')}</label><input className="input" value={f.bill_no} onChange={(e) => setF({ ...f, bill_no: e.target.value })} /></div>
              <div><label className="label">{t('Bill photo')}</label><FieldInput field={{ name: 'bill_file', type: 'file' }} value={f.bill_file} onChange={(v) => setF({ ...f, bill_file: v })} /></div>
            </div>
            <button className="btn-primary w-full !py-3 text-base" disabled={busy}><Icon name="check2-circle" /> {t('Save expense')}</button>
          </form>
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-4 lg:pt-[60px]">
        {isMgr && (
          <Card title={t('Recent expenses')} action={<Link to="/m/expenses" className="text-sm text-brand-700 font-semibold">All</Link>}>
            {(recent.data || []).length ? recent.data.map((e) => (
              <div key={e.id} className="flex justify-between gap-2 py-2 border-b border-slate-100 last:border-0 text-sm">
                <div className="min-w-0"><div className="font-medium truncate">{e.category_id_label}{e.description ? ` · ${e.description}` : ''}</div><div className="text-slate-500 truncate">{fdate(e.date)}{e.party_id_label ? ` · ${e.party_id_label}` : ''}{e.item_id ? ` · +${num(e.quantity)} stock` : ''}</div></div>
                <div className="font-semibold tabular-nums shrink-0">{money(e.amount, cur)}</div>
              </div>
            )) : <Empty text="No expenses yet" />}
          </Card>
        )}
        {isMgr && on('recurring') && (
          <Card title={t('Recurring payments')}>
            <p className="text-sm text-slate-500 mb-3">Rent, current bill, salaries and EMIs: add once, posted automatically every month.</p>
            <Link to="/m/recurring_expenses" className="btn-outline w-full"><Icon name="calendar2-check" /> Manage recurring</Link>
          </Card>
        )}
        {on('inventory') && <Link to="/m/stock_moves?new=1" className="btn-light w-full"><Icon name="box-arrow-up" /> Issue stock to farm</Link>}
        <p className="text-xs text-slate-500"><Icon name="info-circle-fill" className="text-blue-500" /> Choose “credit” for a purchase you'll pay later — it shows as payable in the balance sheet.</p>
      </div>
    </div>
  );
}
