// Public documents opened from WhatsApp - no login needed (the link's token is the secret):
//   /b/:token  bill        /r/:token  payment receipt        /s/:token  vendor statement
// Printable on A4 (Print -> Save as PDF), readable on a phone, with a pay-by-UPI QR code.
import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { money, num, fdate, amountInWords, cls } from '../../lib/format';
import { Icon } from '../../ui/kit';

function UpiQr({ upi, name, amount, note }) {
  const link = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}${amount > 0 ? `&am=${amount.toFixed(2)}` : ''}&cu=INR&tn=${encodeURIComponent(note)}`;
  const svg = useMemo(() => { const qr = qrcode(0, 'M'); qr.addData(link); qr.make(); return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }, [link]);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-3 break-inside-avoid">
      <div className="h-28 w-28 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} aria-label="UPI QR code" />
      <div className="text-sm">
        <div className="font-bold text-slate-900">Pay by UPI{amount > 0 ? ` · ${money(amount)}` : ''}</div>
        <div className="text-slate-600">Scan with any UPI app (GPay, PhonePe, Paytm…)</div>
        <div className="font-mono text-slate-800 mt-1">{upi}</div>
        <a href={link} className="no-print inline-flex mt-2 btn-primary !py-1.5 !px-3 text-xs">Open UPI app</a>
      </div>
    </div>
  );
}

function Header({ h, title, no, date }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-slate-900">{h.name}</div>
        {h.company && h.company !== h.name && <div className="text-sm font-semibold text-slate-700">{h.company}</div>}
        {h.address && <div className="text-sm text-slate-600">{h.address}</div>}
        <div className="text-sm text-slate-600">{[h.phone && `Ph: ${h.phone}`, h.email].filter(Boolean).join(' · ')}</div>
        {h.gstin && <div className="text-sm text-slate-600">GSTIN: {h.gstin}</div>}
      </div>
      <div className="text-right">
        <div className="text-lg font-extrabold uppercase tracking-wide text-brand-800">{title}</div>
        {no && <div className="font-mono font-semibold">{no}</div>}
        <div className="text-sm text-slate-600">{date}</div>
      </div>
    </div>
  );
}

function To({ party, label = 'Bill to' }) {
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-bold text-base text-slate-900">{party.name}</div>
      {party.address && <div className="text-slate-600">{party.address}</div>}
      {party.phone && <div className="text-slate-600">Ph: {party.phone}</div>}
      {party.gstin && <div className="text-slate-600">GSTIN: {party.gstin}</div>}
    </div>
  );
}

function Bill({ d }) {
  const { header: h, bill, party, lines, totals, balance } = d;
  const multiDate = new Set(lines.map((l) => l.date)).size > 1;
  return (
    <>
      <Header h={h} title={h.title || 'Bill'} no={`No. ${bill.bill_no}`} date={`Date: ${fdate(bill.date)}`} />
      {bill.status === 'cancelled' && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-center py-2">THIS BILL IS CANCELLED</div>}
      <div className="mt-4 flex flex-wrap justify-between gap-4"><To party={party} />{party.credit_days > 0 && <div className="text-sm text-slate-600 self-end">Credit: {party.credit_days} days</div>}</div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-left">
              <th className="p-2 w-8">#</th>{multiDate && <th className="p-2">Date</th>}<th className="p-2">Item</th><th className="p-2 text-right">Qty</th>
              {totals.rejected > 0 && <th className="p-2 text-right">Rejected</th>}<th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="border-b border-slate-200">
                <td className="p-2 text-slate-500">{i + 1}</td>{multiDate && <td className="p-2 whitespace-nowrap">{fdate(l.date)}</td>}
                <td className="p-2"><div className="font-semibold">{l.crop}{l.variety ? ` (${l.variety})` : ''}</div><div className="text-xs text-slate-500">Grade {l.grade}{l.vendor_note ? ` · ${l.vendor_note}` : ''}</div></td>
                <td className="p-2 text-right tabular-nums whitespace-nowrap">{num(l.quantity, 2)} {l.unit}</td>
                {totals.rejected > 0 && <td className="p-2 text-right tabular-nums text-red-600">{l.rejected_qty > 0 ? `−${num(l.rejected_qty, 2)}` : ''}</td>}
                <td className="p-2 text-right tabular-nums">{money(l.rate)}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-6">
        <div className="text-sm text-slate-700 max-w-sm"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Amount in words</span>{amountInWords(totals.amount)}</div>
        <div className="min-w-[220px] text-sm space-y-1">
          {totals.rejected_value > 0 && <><Row a="Gross" b={money(totals.gross)} /><Row a="Less rejected" b={`−${money(totals.rejected_value)}`} /></>}
          <Row a="Bill amount" b={money(totals.amount)} big />
          {balance && balance.balance > 0 && <Row a="Total due (all bills)" b={money(balance.balance)} />}
        </div>
      </div>
      {bill.notes && <p className="mt-3 text-sm text-slate-600">Note: {bill.notes}</p>}
      <Payment h={h} amount={balance && balance.balance > 0 ? balance.balance : totals.amount} note={bill.bill_no} show={bill.status !== 'cancelled'} />
    </>
  );
}

function Receipt({ d }) {
  const { header: h, payment: p, party, balance } = d;
  return (
    <>
      <Header h={h} title="Payment receipt" no={`No. ${p.receipt_no}`} date={`Date: ${fdate(p.date)}`} />
      <div className="mt-6 text-base leading-relaxed">
        Received with thanks from <b>{party.name}</b> the sum of <b>{money(p.amount)}</b> ({amountInWords(p.amount)}) by <b>{String(p.mode).toUpperCase()}</b>{p.reference ? <> (Ref: <span className="font-mono">{p.reference}</span>)</> : null}.
      </div>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-brand-50 p-4"><div className="text-xs font-semibold uppercase text-slate-500">Amount received</div><div className="text-3xl font-extrabold text-brand-800">{money(p.amount)}</div></div>
        {balance && <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase text-slate-500">Balance due now</div><div className="text-3xl font-extrabold">{money(Math.max(0, balance.balance))}</div></div>}
      </div>
      {p.notes && <p className="mt-3 text-sm text-slate-600">Note: {p.notes}</p>}
      <div className="mt-10 text-right text-sm text-slate-600">For {h.name}</div>
    </>
  );
}

function Statement({ d }) {
  const { header: h, party, lines, bills } = d;
  return (
    <>
      <Header h={h} title="Statement" date={`${fdate(d.from)} – ${fdate(d.to)}`} />
      <div className="mt-4"><To party={party} label="Statement for" /></div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[['Opening', d.opening], ['Sales', d.total_sales], ['Received', d.total_paid], ['Balance due', d.closing]].map(([a, b], i) => (
          <div key={a} className={cls('rounded-xl p-3', i === 3 ? 'bg-brand-50' : 'bg-slate-50')}><div className="text-xs font-semibold uppercase text-slate-500">{a}</div><div className={cls('font-extrabold tabular-nums', i === 3 && 'text-lg text-brand-800')}>{money(b)}</div></div>
        ))}
      </div>
      {d.overdue > 0 && <div className="mt-2 text-sm text-red-700 font-semibold">Overdue: {money(d.overdue)}</div>}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="bg-slate-100 text-left"><th className="p-2">Date</th><th className="p-2">Details</th><th className="p-2 text-right">Sale</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Balance</th></tr></thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-slate-50"><td className="p-2" colSpan={4}>Opening balance</td><td className="p-2 text-right tabular-nums">{money(d.opening)}</td></tr>
            {lines.map((l) => (
              <tr key={l.kind + l.id} className="border-b border-slate-200">
                <td className="p-2 whitespace-nowrap">{fdate(l.date)}</td>
                <td className="p-2">{l.kind === 'sale' ? `${l.crop} ${l.grade} · ${num(l.quantity - (l.rejected_qty || 0))} ${l.unit} × ${money(l.rate)}` : `Payment · ${String(l.mode).toUpperCase()}${l.reference ? ` · ${l.reference}` : ''}`}</td>
                <td className="p-2 text-right tabular-nums">{l.kind === 'sale' ? money(l.amount) : ''}</td>
                <td className="p-2 text-right tabular-nums text-brand-700">{l.kind === 'payment' ? money(l.amount) : ''}</td>
                <td className="p-2 text-right tabular-nums font-medium">{money(l.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bills.length > 0 && (
        <div className="mt-4 no-print">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Bills in this period</div>
          <div className="flex flex-wrap gap-2">{bills.map((b) => <a key={b.bill_no} href={b.url} className="chip-off !py-1 text-xs">{b.bill_no} · {money(b.amount)}</a>)}</div>
        </div>
      )}
      <Payment h={h} amount={d.closing} note={`Statement ${party.name}`} show={d.closing > 0} />
    </>
  );
}

const Row = ({ a, b, big }) => <div className={cls('flex justify-between gap-4', big && 'border-t-2 border-slate-800 pt-1 text-lg font-extrabold')}><span>{a}</span><span className="tabular-nums">{b}</span></div>;

function Payment({ h, amount, note, show }) {
  if (!show || (!h.upi_id && !h.bank_details)) return null;
  return (
    <div className="mt-6 grid sm:grid-cols-2 gap-3">
      {h.upi_id && <UpiQr upi={h.upi_id} name={h.name} amount={Math.round(amount * 100) / 100} note={note} />}
      {h.bank_details && <div className="rounded-2xl border border-slate-200 p-3 text-sm"><div className="font-bold text-slate-900">Bank transfer</div><div className="text-slate-700 whitespace-pre-line">{h.bank_details}</div></div>}
    </div>
  );
}

export default function Doc({ kind, token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const path = { b: 'bill', r: 'receipt', s: 'statement' }[kind];
  useEffect(() => {
    fetch(`/api/public/${path}/${encodeURIComponent(token)}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Not found'); setD(j);
      document.title = `${j.header.name} · ${j.bill?.bill_no || j.payment?.receipt_no || 'Statement'}`;
    }).catch((e) => setErr(e.message));
  }, [path, token]);

  if (err) return <div className="min-h-screen grid place-items-center p-6 text-center"><div><Icon name="file-earmark-text" className="text-5xl text-slate-300" /><p className="mt-3 text-slate-600">{err}. The link may be old or mistyped — ask the farm to send it again.</p></div></div>;
  if (!d) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-4 sm:py-8 px-2 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <div className="no-print flex flex-wrap gap-2 justify-end mb-3">
          <button className="btn-primary" onClick={() => window.print()}><Icon name="printer" /> Print / Save PDF</button>
          {navigator.share && <button className="btn-outline" onClick={() => navigator.share({ title: document.title, url: window.location.href }).catch(() => {})}><Icon name="share" /> Share</button>}
        </div>
        <div className="bg-white shadow-sm print:shadow-none rounded-2xl print:rounded-none p-5 sm:p-8">
          {kind === 'b' && <Bill d={d} />}
          {kind === 'r' && <Receipt d={d} />}
          {kind === 's' && <Statement d={d} />}
          {d.header.footer && <p className="mt-6 pt-3 border-t border-slate-200 text-xs text-slate-500 text-center">{d.header.footer}</p>}
          <p className="mt-2 text-[11px] text-slate-400 text-center">Computer-generated document · Polyhouse OS</p>
        </div>
      </div>
    </div>
  );
}
