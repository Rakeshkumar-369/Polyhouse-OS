// Bills & receipts: every bill (search, period, not-sent filter) -> open -> Send on WhatsApp in one tap;
// "To bill" turns sales not yet on a bill into one bill per vendor; "Receipts" lists payments received with their receipt.
import { useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLocation, navigate } from '../../lib/router';
import { t } from '../../lib/i18n';
import { money, fdate, cls, todayISO, initialPeriod } from '../../lib/format';
import { openWhatsApp } from '../../lib/share';
import { Card, Icon, Modal, PageHeader, Spinner, Badge, Empty, useToast, Tabs, Chips } from '../../ui/kit';
import { useOptions } from '../../ui/Form';
import PeriodPicker from '../../ui/PeriodPicker';
import BillSheet from '../../ui/BillSheet';
import PaymentForm from '../../ui/PaymentForm';

const OWN = ['admin', 'manager'];

function useDoc() {
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const open = async (url) => { try { setDoc(await api.get(url)); } catch (e) { toast(e.message, 'error'); } };
  return [doc, setDoc, open];
}

function BillList() {
  const { cur } = useAuth();
  const [period, setPeriod] = useState(initialPeriod('this_month'));
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');
  const { data, reload } = useApi('/bills', { from: period.from, to: period.to, q: q.trim() || undefined });
  const [doc, setDoc, open] = useDoc();
  const rows = (data || []).filter((b) => (show === 'unsent' ? b.status === 'issued' && !b.sent_count : show === 'cancelled' ? b.status === 'cancelled' : show === 'all' ? true : b.status === 'issued'));
  const live = (data || []).filter((b) => b.status === 'issued');
  const unsent = live.filter((b) => !b.sent_count).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <PeriodPicker value={period} onChange={setPeriod} showGroup={false} />
        <div className="relative flex-1 min-w-[160px]"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9 !py-2" placeholder={`${t('Search')}: bill no. / vendor`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card p-3"><div className="text-[11px] text-slate-500 uppercase font-semibold">{t('Bills')}</div><div className="text-xl font-bold">{live.length}</div></div>
        <div className="card p-3"><div className="text-[11px] text-slate-500 uppercase font-semibold">{t('Amount')}</div><div className="text-xl font-bold tabular-nums">{money(live.reduce((a, b) => a + Number(b.amount), 0), cur)}</div></div>
        <button className={cls('card p-3', unsent && 'border-amber-300')} onClick={() => setShow(show === 'unsent' ? 'all' : 'unsent')}><div className="text-[11px] text-slate-500 uppercase font-semibold">{t('Not sent')}</div><div className={cls('text-xl font-bold', unsent && 'text-amber-600')}>{unsent}</div></button>
      </div>
      <Chips options={[['all', 'All'], ['unsent', 'Not sent'], ['issued', 'Issued'], ['cancelled', 'Cancelled']].map(([value, label]) => ({ value, label }))} value={show} onChange={setShow} />
      {!data ? <Spinner /> : !rows.length ? <Card><Empty icon="receipt" text="No bills in this period" /></Card> : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <button key={b.id} onClick={() => open(`/bills/${b.id}`)} className={cls('card p-3 text-left hover:border-brand-400 transition', b.status === 'cancelled' && 'opacity-60')}>
              <div className="flex justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold truncate">{b.party}</div><div className="text-xs text-slate-500">{b.bill_no} · {fdate(b.date)} · {b.line_count} {t('items')}</div></div>
                <div className="text-right shrink-0"><div className="font-bold tabular-nums">{money(b.amount, cur)}</div>
                  {b.status === 'cancelled' ? <Badge tone="red">{t('cancelled')}</Badge> : b.sent_count ? <Badge tone="green"><Icon name="check2" /> {t('sent')}</Badge> : <Badge tone="amber">{t('not sent')}</Badge>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!doc} onClose={() => setDoc(null)} title={doc?.bill?.bill_no}>
        {doc && <BillSheet doc={doc} onSent={reload} onCancel={() => { setDoc(null); reload(); }} />}
      </Modal>
    </div>
  );
}

function ToBill() {
  const { cur } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi('/bills/unbilled');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState([]);
  const [doc, setDoc] = useState(null);
  const make = async (partyId) => {
    const list = (data || []).filter((u) => !partyId || u.party_id === partyId);
    if (!list.length) return;
    setBusy(true);
    try {
      const from = list.map((u) => u.first_date).sort()[0];
      const r = await api.post('/bills/from-sales', { party_id: partyId || undefined, from, to: todayISO() });
      setMade((m) => [...r.bills, ...m]);
      toast(`${r.created} ${t('bill(s) made')}`);
      reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const send = async (b) => { openWhatsApp(b.share.whatsapp); try { await api.post(`/bills/${b.bill.id}/sent`); } catch { /* ignore */ } setMade((m) => m.map((x) => (x === b ? { ...x, sent: true } : x))); };
  const total = (data || []).reduce((a, u) => a + Number(u.amount), 0);
  return (
    <div className="space-y-4">
      {made.length > 0 && (
        <Card title={t('Bills made — send them')} sub="One tap opens WhatsApp with the bill message and link">
          {made.map((b) => (
            <div key={b.bill.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
              <button className="flex-1 min-w-0 text-left" onClick={() => setDoc(b)}><div className="font-semibold truncate">{b.party.name}</div><div className="text-xs text-slate-500">{b.bill.bill_no} · {b.lines.length} {t('items')} · {money(b.totals.amount, cur)}</div></button>
              <button className={cls('btn !py-2 text-white', b.sent ? 'bg-slate-400' : 'bg-[#16a34a] hover:bg-[#15803d]')} onClick={() => send(b)}><Icon name={b.sent ? 'check2' : 'whatsapp'} /> {b.sent ? t('Sent') : t('Send')}</button>
            </div>
          ))}
        </Card>
      )}
      <Card title={t('Sales not on a bill yet')} sub="For vendors you bill weekly or monthly — one bill per vendor" action={data?.length > 1 && <button className="btn-primary !py-2" disabled={busy} onClick={() => make()}><Icon name="receipt" /> {t('Bill all')} ({money(total, cur)})</button>}>
        {!data ? <Spinner /> : !data.length ? <Empty icon="check2-circle" text="Everything is billed" /> : data.map((u) => (
          <div key={u.party_id} className="flex items-center gap-2 py-2.5 border-b border-slate-100 last:border-0">
            <div className="flex-1 min-w-0"><div className="font-semibold truncate">{u.party}</div><div className="text-xs text-slate-500">{u.line_count} {t('sale(s)')} · {fdate(u.first_date)}{u.first_date !== u.last_date ? ` – ${fdate(u.last_date)}` : ''}</div></div>
            <b className="tabular-nums">{money(u.amount, cur)}</b>
            <button className="btn-light !py-2" disabled={busy} onClick={() => make(u.party_id)}><Icon name="receipt" /> {t('Make bill')}</button>
          </div>
        ))}
      </Card>
      <Modal open={!!doc} onClose={() => setDoc(null)} title={doc?.bill?.bill_no}>{doc && <BillSheet doc={doc} />}</Modal>
    </div>
  );
}

function Receipts({ startNew }) {
  const { cur } = useAuth();
  const [period, setPeriod] = useState(initialPeriod('this_month'));
  const { data, reload } = useApi('/r/payments_received', { from: period.from, to: period.to });
  const vendors = useOptions('parties', { kind: 'buyer' });
  const [adding, setAdding] = useState(!!startNew);
  const [doc, setDoc, open] = useDoc();
  const rows = data || [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <PeriodPicker value={period} onChange={setPeriod} showGroup={false} />
        <button className="btn-primary" onClick={() => setAdding(true)}><Icon name="plus-lg" /> {t('Payment received')}</button>
      </div>
      <div className="card p-3 flex justify-between"><span className="text-slate-500 text-sm">{rows.length} {t('payments')}</span><b className="tabular-nums">{money(rows.reduce((a, r) => a + Number(r.amount), 0), cur)}</b></div>
      {!data ? <Spinner /> : !rows.length ? <Card><Empty icon="cash-coin" text="No payments in this period" /></Card> : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <button key={p.id} onClick={() => open(`/receipts/${p.id}`)} className="card p-3 text-left hover:border-brand-400 transition">
              <div className="flex justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold truncate">{p.party_id_label}</div><div className="text-xs text-slate-500">{p.receipt_no || '—'} · {fdate(p.date)} · {String(p.mode || '').toUpperCase()}{p.reference ? ` · ${p.reference}` : ''}</div></div>
                <div className="text-right shrink-0"><div className="font-bold tabular-nums text-brand-700">{money(p.amount, cur)}</div><span className="text-xs text-green-700"><Icon name="whatsapp" /> {t('Send')}</span></div>
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title={t('Payment received')}>
        {adding && <PaymentForm vendors={vendors} onSaved={reload} onClose={() => setAdding(false)} />}
      </Modal>
      <Modal open={!!doc} onClose={() => setDoc(null)} title={doc?.payment?.receipt_no}>{doc && <BillSheet doc={doc} />}</Modal>
    </div>
  );
}

export default function Bills() {
  const { role } = useAuth();
  const { query } = useLocation();
  const own = OWN.includes(role);
  const tabs = [['bills', 'Bills'], ...(own ? [['tobill', 'To bill'], ['receipts', 'Receipts']] : [])];
  const tab = tabs.some(([k]) => k === query.get('tab')) ? query.get('tab') : 'bills';
  const setTab = (k) => navigate(k === 'bills' ? '/bills' : `/bills?tab=${k}`, { replace: true });
  return (
    <div className="space-y-4">
      <PageHeader title={t('Bills & receipts')} subtitle="Every sale gets a numbered bill; every payment a receipt — send them on WhatsApp in one tap">
        <button className="btn-primary" onClick={() => navigate('/sell')}><Icon name="truck" /> {t('New sale')}</button>
      </PageHeader>
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === 'bills' && <BillList />}
      {tab === 'tobill' && <ToBill />}
      {tab === 'receipts' && <Receipts startNew={query.get('new') === '1'} />}
    </div>
  );
}
