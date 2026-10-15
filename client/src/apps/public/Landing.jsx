// Public product website: what it does, who it's for, how it works, plans, and "Request a demo" (lands in Super admin > Leads)
import { useState } from 'react';
import { api } from '../../lib/api';
import { Link } from '../../lib/router';
import { Icon } from '../../ui/kit';

const PROBLEMS = [
  ['basket', 'Harvest by crop & grade', 'Every day\'s pluck recorded by crop, grade and bay in seconds — no notebook totals.', 'Yield per sq m'],
  ['truck', 'Sell to many vendors', 'Delivery person picks crop → vendor → quantity. Each vendor\'s own price is applied automatically.', 'Price realised per kg'],
  ['wallet2', 'Every rupee spent', 'Seeds, trays, grow bags, slabs, threads, iron, rent, current, labour — with bill photos.', 'Cost per kg'],
  ['people', 'Labour & wages', 'Attendance in one tap, daily / monthly / per-kg pay, advances recovered, payslips.', 'Labour cost per kg'],
  ['shop', 'Vendor dues', 'Who owes how much, for how long — with a WhatsApp reminder in one tap.', 'Days to collect'],
  ['graph-up-arrow', 'Day / week / month P&L', 'Profit by crop, farm and vendor for any dates, plus a balance sheet. Export to Excel.', 'Net profit'],
  ['droplet-half', 'EC / pH & climate', 'Daily feed and drain readings with alerts before salt builds up or fungus spreads.', 'Days in target band'],
  ['moisture', 'Spray safety', 'A spray locks that bay for harvest until the pre-harvest interval ends.', 'Residue rejections'],
];
const FOR = [
  ['house', 'One polyhouse owner'], ['map', 'Crop field owner'], ['building', 'Owner with many polyhouses'],
  ['people', 'Farmer Producer Organisation'], ['geo-alt', 'Farmer with land at many places'],
];
const ROLES = [
  ['person-circle', 'Owner', 'Sets up the farm and vision, sees every number.'],
  ['clipboard-data', 'Supervisor', 'Harvest, attendance, EC/pH, sprays, tasks.'],
  ['truck', 'Delivery', 'Records each sale at the vendor\'s door.'],
  ['shop', 'Vendor', 'Confirms deliveries, sees dues, places orders.'],
  ['person-badge', 'Labour', 'Checks in and sees this week\'s earnings — in Telugu.'],
];

function DemoForm() {
  const [f, setF] = useState({ name: '', phone: '', farm_type: 'single_polyhouse', acres: '', location: '', message: '' });
  const [state, setState] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setState('sending');
    try { await api.post('/public/demo-request', f); setState('sent'); } catch (err) { setState(err.message); }
  };
  if (state === 'sent') return <div className="card p-6 text-center"><Icon name="check-circle-fill" className="text-4xl text-brand-600" /><h3 className="mt-2 font-bold text-lg">Thank you!</h3><p className="text-slate-600">We will call you within one working day.</p></div>;
  const inp = (k, l, p = {}) => <div><label className="label">{l}</label><input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...p} /></div>;
  return (
    <form onSubmit={submit} className="card p-5 grid sm:grid-cols-2 gap-3 text-left">
      {inp('name', 'Your name', { required: true })}
      {inp('phone', 'Phone', { required: true, inputMode: 'tel' })}
      <div><label className="label">Farm type</label>
        <select className="input" value={f.farm_type} onChange={(e) => setF({ ...f, farm_type: e.target.value })}>
          <option value="single_polyhouse">One polyhouse</option><option value="multi_polyhouse">Many polyhouses</option><option value="crop_field">Crop field</option><option value="fpo">FPO</option><option value="multi_location">Land at many places</option>
        </select>
      </div>
      {inp('acres', 'Acres')}
      <div className="sm:col-span-2">{inp('location', 'Village / district')}</div>
      <div className="sm:col-span-2"><label className="label">What do you grow / need?</label><textarea rows={2} className="input" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
      {state && state !== 'sending' && <div className="sm:col-span-2 text-sm text-red-600">{state}</div>}
      <button className="btn-primary sm:col-span-2 !py-3" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Request a free demo'}</button>
    </form>
  );
}

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <img src="/favicon.svg" className="h-9 w-9" alt="" /><span className="font-bold text-lg tracking-tight flex-1">Polyhouse OS</span>
          <a href="#demo" className="hidden sm:inline text-sm font-semibold text-slate-600 hover:text-brand-700 mr-2">Request demo</a>
          <Link to="/login" className="btn-primary">Log in</Link>
        </div>
      </header>

      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-800"><Icon name="lightning-charge" /> Built for Indian polyhouses & farms</span>
            <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">Know your profit <span className="text-brand-700">every day</span>, not at season end.</h1>
            <p className="mt-4 text-lg text-slate-600">Record harvest, sales to each vendor, expenses and labour from your phone. See cost per kg, price per kg, who owes you and what to fix — the same evening.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#demo" className="btn-primary !px-6 !py-3 text-base">Request a free demo</a>
              <Link to="/login" className="btn-outline !px-6 !py-3 text-base"><Icon name="play-circle" /> Try it now</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              {['Works on any ₹8,000 Android phone', 'English & తెలుగు', 'No payment gateway needed'].map((x) => <span key={x} className="inline-flex items-center gap-1.5"><Icon name="check-circle-fill" className="text-brand-600" />{x}</span>)}
            </div>
          </div>
          <div className="card p-4 sm:p-5 shadow-xl shadow-brand-900/5">
            <div className="rounded-xl bg-brand-700 text-white p-4"><div className="text-xs text-brand-100 font-semibold uppercase tracking-wider">Sample dashboard · this month</div><div className="mt-1 font-medium">Profit ₹1,94,777 on sales of ₹2,84,054. Capsicum Yellow earned most at ₹101/kg. ₹2.1L overdue from 2 vendors.</div></div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[['Sales', '₹2.84L', 'text-blue-600'], ['Cost / kg', '₹14', 'text-orange-600'], ['Price / kg', '₹75', 'text-brand-700']].map(([a, b, c]) => <div key={a} className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] text-slate-500 uppercase font-semibold">{a}</div><div className={'text-xl font-bold ' + c}>{b}</div></div>)}
            </div>
            <div className="mt-3 flex items-end gap-1.5 h-24 px-1">{[40, 55, 48, 70, 62, 80, 66, 90, 75, 95, 84, 100].map((h, i) => <div key={i} className="flex-1 rounded-t bg-blue-500/80" style={{ height: h + '%' }} />)}</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-3xl font-bold tracking-tight text-center">Everything a farm runs on — in one place</h2>
        <p className="text-center text-slate-600 mt-2">Each module exists because a problem costs farmers money. Turn on only what you need.</p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROBLEMS.map(([i, h, d, n]) => (
            <div key={h} className="card p-5">
              <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center text-lg"><Icon name={i} /></span>
              <h3 className="mt-3 font-semibold">{h}</h3><p className="text-sm text-slate-600 mt-1">{d}</p>
              <p className="mt-3 text-xs font-semibold text-brand-700 uppercase tracking-wider">Moves: {n}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Made for every kind of grower</h2>
            <div className="mt-5 space-y-2">{FOR.map(([i, l]) => <div key={l} className="card px-4 py-3 flex items-center gap-3"><Icon name={i} className="text-brand-700 text-lg" /><span className="font-medium">{l}</span></div>)}</div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">One login for each person</h2>
            <div className="mt-5 space-y-2">{ROLES.map(([i, r, d]) => <div key={r} className="card px-4 py-3 flex items-start gap-3"><Icon name={i} className="text-brand-700 text-lg mt-0.5" /><div><div className="font-semibold">{r}</div><div className="text-sm text-slate-600">{d}</div></div></div>)}</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight text-center">Start in 10 minutes</h2>
        <div className="mt-8 grid sm:grid-cols-4 gap-4">
          {[['1', 'We create your login', 'You get a user ID and password on WhatsApp.'], ['2', 'Set up your farm', 'Acres, crops, vendors & their prices, workers & pay — a 5-step guide.'], ['3', 'Record the day', 'Harvest, sales, expenses, attendance — 30 seconds each.'], ['4', 'Decide with numbers', 'Dashboard, alerts and reports by day, week or month.']].map(([n, h, d]) => (
            <div key={n} className="card p-5"><div className="h-9 w-9 rounded-full bg-brand-700 text-white grid place-items-center font-bold">{n}</div><h3 className="mt-3 font-semibold">{h}</h3><p className="text-sm text-slate-600 mt-1">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold tracking-tight text-center">Plans</h2>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[['Pilot', '30 days free', ['All modules', 'Setup help on call', 'Your data stays yours']], ['Farm', 'One owner, any number of polyhouses', ['Unlimited staff, vendor & labour logins', 'Reports, P&L, balance sheet', 'Telugu & English']], ['FPO / Enterprise', 'Many members, many locations', ['Member-wise reports', 'Central buyer & price lists', 'Training for your team']]].map(([n, s, f], i) => (
              <div key={n} className={'card p-6 ' + (i === 1 ? 'ring-2 ring-brand-600' : '')}>
                <h3 className="font-bold text-lg">{n}</h3><p className="text-sm text-slate-600">{s}</p>
                <ul className="mt-4 space-y-2 text-sm">{f.map((x) => <li key={x} className="flex gap-2"><Icon name="check2" className="text-brand-700 mt-0.5" />{x}</li>)}</ul>
                <a href="#demo" className={(i === 1 ? 'btn-primary' : 'btn-outline') + ' w-full mt-5'}>Ask for pricing</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="max-w-3xl mx-auto px-4 py-14 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Request a free demo</h2>
        <p className="text-slate-600 mt-2 mb-6">Tell us about your farm. We'll set up your login and walk you through it.</p>
        <DemoForm />
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Polyhouse OS · <Link to="/login" className="text-brand-700 font-medium">Log in</Link>
      </footer>
    </div>
  );
}
