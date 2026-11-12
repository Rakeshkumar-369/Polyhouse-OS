// The "send" panel shown after a bill / receipt / statement is made:
// summary + Send on WhatsApp (one tap) + Open / print (PDF) + Copy or share link.
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { openWhatsApp, shareOrCopy } from '../lib/share';
import { money, num, fdate, cls } from '../lib/format';
import { t } from '../lib/i18n';
import { Icon, Badge, useToast } from './kit';

export function ShareButtons({ doc, onSent, onCancel }) {
  const toast = useToast();
  const { role } = useAuth();
  const [busy, setBusy] = useState(false);
  const send = async () => {
    openWhatsApp(doc.share.whatsapp);
    if (doc.kind === 'bill') { try { await api.post(`/bills/${doc.bill.id}/sent`); onSent?.(); } catch { /* not critical */ } }
  };
  const other = async () => { const r = await shareOrCopy({ title: doc.header.name, text: doc.share.text, url: doc.share.url }); if (r === 'copied') toast(t('Link copied')); };
  const cancel = async () => {
    if (!window.confirm('Cancel this bill? Its sale lines stay and can be billed again.')) return;
    setBusy(true);
    try { await api.post(`/bills/${doc.bill.id}/cancel`); toast('Bill cancelled'); onCancel?.(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <button className="btn col-span-2 !py-3 text-base bg-[#16a34a] hover:bg-[#15803d] text-white" onClick={send}>
        <Icon name="whatsapp" className="text-lg" /> {t('Send on WhatsApp')}{doc.party?.phone ? '' : ' (choose chat)'}
      </button>
      <a className="btn-outline" href={doc.share.url} target="_blank" rel="noreferrer"><Icon name="printer" /> {t('Open / PDF')}</a>
      <button className="btn-outline" onClick={other}><Icon name="share" /> {t('Share link')}</button>
      {doc.kind === 'bill' && doc.bill.status === 'issued' && ['admin', 'manager'].includes(role) && onCancel && (
        <button className="btn-danger col-span-2 !py-2" disabled={busy} onClick={cancel}><Icon name="x-circle" /> {t('Cancel bill')}</button>
      )}
    </div>
  );
}

export default function BillSheet({ doc, onSent, onCancel }) {
  const { cur } = useAuth();
  if (!doc) return null;
  const isBill = doc.kind === 'bill';
  return (
    <div className="space-y-4">
      <div className={cls('rounded-2xl p-4', isBill && doc.bill.status === 'cancelled' ? 'bg-red-50' : 'bg-brand-50')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{isBill ? doc.header.title || 'Bill' : doc.kind === 'receipt' ? 'Payment receipt' : 'Statement'}</div>
            <div className="font-bold text-lg truncate">{isBill ? doc.bill.bill_no : doc.kind === 'receipt' ? doc.payment.receipt_no : doc.party.name}</div>
            <div className="text-sm text-slate-600 truncate">{doc.party?.name} · {fdate(isBill ? doc.bill.date : doc.kind === 'receipt' ? doc.payment.date : doc.to)}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-extrabold tabular-nums">{money(isBill ? doc.totals.amount : doc.kind === 'receipt' ? doc.payment.amount : doc.closing, cur)}</div>
            {isBill && doc.bill.status === 'cancelled' && <Badge tone="red">cancelled</Badge>}
            {isBill && doc.bill.sent_count > 0 && doc.bill.status !== 'cancelled' && <Badge tone="green">sent {doc.bill.sent_count}×</Badge>}
          </div>
        </div>
        {isBill && (
          <div className="mt-3 divide-y divide-brand-100 text-sm">
            {doc.lines.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 py-1.5">
                <span className="truncate">{l.crop} {l.grade} · {num(l.quantity - (l.rejected_qty || 0))} {l.unit} × {money(l.rate, cur)}</span>
                <b className="tabular-nums shrink-0">{money(l.amount, cur)}</b>
              </div>
            ))}
          </div>
        )}
        {doc.balance && doc.balance.balance > 0 && <div className="mt-2 text-sm text-slate-600">Total due from {doc.party.name}: <b>{money(doc.balance.balance, cur)}</b></div>}
      </div>
      <ShareButtons doc={doc} onSent={onSent} onCancel={onCancel} />
      <details className="text-sm"><summary className="cursor-pointer text-slate-500">{t('Message preview')}</summary><pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">{doc.share.text}</pre></details>
    </div>
  );
}
