// Record money received from a vendor. On save the server numbers a receipt; we show it ready to send on WhatsApp.
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { money, todayISO } from '../lib/format';
import { Icon, useToast, Chips } from './kit';
import BillSheet from './BillSheet';

export default function PaymentForm({ party, vendors, onSaved, onClose, amount = '' }) {
  const { cur, on } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ party_id: party?.party_id || '', date: todayISO(), amount, mode: 'upi', reference: '' });
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    if (!f.party_id) return toast('Pick the vendor', 'error');
    setBusy(true);
    try {
      const row = await api.post('/r/payments_received', f);
      toast(`${money(f.amount, cur)} ${t('recorded')}`);
      onSaved?.();
      if (on('billing')) setReceipt(await api.get(`/receipts/${row.id}`));
      else onClose?.();
    } catch (e2) { toast(e2.message, 'error'); } finally { setBusy(false); }
  };
  if (receipt) {
    return (
      <div className="space-y-3">
        <BillSheet doc={receipt} />
        <button className="btn-light w-full" onClick={() => { setReceipt(null); setF({ ...f, amount: '', reference: '' }); onClose?.(); }}><Icon name="check2-circle" /> {t('Done')}</button>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-3 rounded-2xl bg-brand-50 p-3">
      {vendors && (
        <div className="col-span-2"><label className="label">{t('Vendor')}</label>
          {vendors.length <= 8 ? <Chips options={vendors.map((v) => ({ value: v.id, label: v.label }))} value={f.party_id} onChange={(v) => setF({ ...f, party_id: v })} />
            : <select className="input" required value={f.party_id} onChange={(e) => setF({ ...f, party_id: e.target.value })}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>}
        </div>
      )}
      <div><label className="label">{t('Amount received')}</label><input className="input !text-xl !font-bold" type="number" step="any" min="0" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
      <div><label className="label">{t('Mode')}</label><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{['cash', 'upi', 'bank', 'cheque'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select></div>
      <div><label className="label">{t('Date')}</label><input className="input" type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div><label className="label">UTR / ref</label><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
      <button className="btn-primary col-span-2" disabled={busy}><Icon name="cash-coin" /> {on('billing') ? t('Save & make receipt') : t('Record payment')}</button>
    </form>
  );
}
