// First-login setup wizard for a new owner: farm -> crops -> vendors & prices -> workers & monthly bills -> start.
// Every step can be skipped; everything entered here can be changed later from the menu.
import { useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { navigate } from '../../lib/router';
import { t } from '../../lib/i18n';
import { cls } from '../../lib/format';
import { Icon, useToast } from '../../ui/kit';
import LangSwitch from '../../ui/LangSwitch';

const COMMON_CROPS = ['Capsicum Red', 'Capsicum Yellow', 'Capsicum Green', 'Cucumber', 'Tomato', 'Cherry Tomato', 'Gerbera', 'Rose', 'Carnation', 'Strawberry', 'Lettuce', 'Broccoli', 'Zucchini', 'Paddy', 'Cotton', 'Chilli', 'Brinjal', 'Okra'];
const COLORS = ['#dc2626', '#eab308', '#16a34a', '#0ea5e9', '#f97316', '#be123c', '#db2777', '#9333ea', '#e11d48', '#65a30d', '#0d9488', '#4f46e5'];
const STEPS = ['Farm details', 'Crops you grow', 'Vendors & prices', 'Workers & pay', 'Done'];

const Field = ({ label, children, className }) => <div className={className}><label className="label">{t(label)}</label>{children}</div>;

export default function Setup() {
  const { meta, reload, cur } = useAuth();
  const toast = useToast();
  const org = meta.org;
  const word = { crop_field: 'Field', fpo: 'Member farm', multi_location: 'Land' }[org.customer_type] || 'Polyhouse';
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const { data: cats } = useApi('/r/expense_categories/options');

  const [farm, setFarm] = useState({ name: `${word} 1`, type: org.customer_type === 'crop_field' || org.customer_type === 'multi_location' ? 'open_field' : 'polyhouse', location: org.district || '', area_acres: '', length_m: '', width_m: '', height_m: '', ownership: 'owned', monthly_rent: '', member_name: '' });
  const [sale, setSale] = useState(org.settings.sale_frequency || 'daily');
  const [crops, setCrops] = useState([]); // {name, unit, price}
  const [custom, setCustom] = useState('');
  const [vendors, setVendors] = useState([{ name: '', phone: '', credit_days: '', prices: {} }]);
  const [workers, setWorkers] = useState([{ name: '', phone: '', pay_type: 'daily', wage: '' }]);
  const [bills, setBills] = useState({ electricity: '' });
  const [made, setMade] = useState({ farms: 0, crops: [], vendors: 0, workers: 0 });

  const toggleCrop = (n) => setCrops((c) => (c.some((x) => x.name === n) ? c.filter((x) => x.name !== n) : [...c, { name: n, unit: /Gerbera|Rose|Carnation/.test(n) ? 'bunch' : 'kg', price: '' }]));
  const catId = (kind) => (cats || []).find((c) => c.label.toLowerCase().includes(kind))?.id;

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); setStep((s) => s + 1); window.scrollTo(0, 0); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const saveFarm = () => run(async () => {
    if (farm.name.trim()) {
      const f = await api.post('/r/farms', farm);
      setMade((m) => ({ ...m, farms: m.farms + 1, farmId: f.id }));
      if (farm.ownership === 'leased' && Number(farm.monthly_rent) > 0 && catId('rent')) {
        await api.post('/r/recurring_expenses', { name: `Rent - ${farm.name}`, category_id: catId('rent'), farm_id: f.id, amount: farm.monthly_rent, frequency: 'monthly', next_due: new Date().toISOString().slice(0, 8) + '05', auto_post: 1 });
      }
    }
    await api.put('/settings', { settings: { sale_frequency: sale } });
  });

  const saveCrops = () => run(async () => {
    const out = [];
    for (const [i, c] of crops.entries()) {
      const r = await api.post('/r/crops', { name: c.name, unit: c.unit, default_price: c.price || 0, color: COLORS[i % COLORS.length] });
      out.push({ id: r.id, name: c.name, unit: c.unit });
    }
    setMade((m) => ({ ...m, crops: out }));
  });

  const saveVendors = () => run(async () => {
    let n = 0;
    for (const v of vendors.filter((x) => x.name.trim())) {
      const p = await api.post('/r/parties', { name: v.name, phone: v.phone, credit_days: v.credit_days || 0, type: 'buyer' });
      n++;
      for (const [cropId, price] of Object.entries(v.prices)) {
        if (Number(price) > 0) await api.post('/r/price_list', { party_id: p.id, crop_id: cropId, grade: 'A', price });
      }
    }
    setMade((m) => ({ ...m, vendors: n }));
  });

  const saveWorkers = () => run(async () => {
    let n = 0;
    for (const w of workers.filter((x) => x.name.trim())) {
      await api.post('/r/workers', { name: w.name, phone: w.phone, pay_type: w.pay_type, farm_id: made.farmId || '', daily_wage: w.pay_type === 'daily' ? w.wage : 0, monthly_salary: w.pay_type === 'monthly' ? w.wage : 0, piece_rate: w.pay_type === 'piece' ? w.wage : 0 });
      n++;
    }
    if (Number(bills.electricity) > 0 && catId('electric')) {
      await api.post('/r/recurring_expenses', { name: 'Electricity bill', category_id: catId('electric'), amount: bills.electricity, frequency: 'monthly', next_due: new Date().toISOString().slice(0, 8) + '10', auto_post: 1 });
    }
    setMade((m) => ({ ...m, workers: n }));
  });

  const finish = async (to = '/') => {
    setBusy(true);
    try { await api.put('/settings', { settings: { setup_done: true } }); await reload(); navigate(to); } catch (e) { toast(e.message, 'error'); setBusy(false); }
  };

  const Nav = ({ onNext, nextLabel = 'Next' }) => (
    <div className="flex gap-2 pt-2">
      {step > 0 && <button type="button" className="btn-light" onClick={() => setStep(step - 1)} disabled={busy}><Icon name="chevron-left" /> {t('Back')}</button>}
      <button type="button" className="btn-outline" onClick={() => setStep(step + 1)} disabled={busy}>{t('Skip')}</button>
      <button type="button" className="btn-primary flex-1 !py-3" onClick={onNext} disabled={busy}>{busy ? '…' : t(nextLabel)} <Icon name="chevron-right" /></button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-[#f5f7f6]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <img src="/favicon.svg" className="h-9 w-9" alt="" />
          <div className="flex-1"><div className="font-bold">{t('Set up your farm')}</div><div className="text-xs text-slate-500">{org.name}</div></div>
          <LangSwitch />
        </div>
        <div className="flex gap-1.5 mb-5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => <div key={s} className={cls('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand-600' : 'bg-slate-200')} />)}
        </div>
        <div className="card p-5 space-y-4 fade-in" key={step}>
          <div><div className="text-xs font-semibold text-brand-700 uppercase tracking-wider">Step {step + 1} of {STEPS.length}</div><h1 className="text-xl font-bold">{t(STEPS[step])}</h1></div>

          {step === 0 && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={`${word} name`}><input className="input" value={farm.name} onChange={(e) => setFarm({ ...farm, name: e.target.value })} /></Field>
                <Field label="Location / village"><input className="input" value={farm.location} onChange={(e) => setFarm({ ...farm, location: e.target.value })} /></Field>
                {org.customer_type === 'fpo' && <Field label="Member / land owner (FPO)"><input className="input" value={farm.member_name} onChange={(e) => setFarm({ ...farm, member_name: e.target.value })} /></Field>}
                <Field label="Type"><select className="input" value={farm.type} onChange={(e) => setFarm({ ...farm, type: e.target.value })}>{['polyhouse', 'net_house', 'open_field', 'nursery'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select></Field>
                <Field label="Area (acres)"><input className="input" type="number" step="any" inputMode="decimal" value={farm.area_acres} onChange={(e) => setFarm({ ...farm, area_acres: e.target.value })} /></Field>
              </div>
              {farm.type !== 'open_field' && (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Length (m)"><input className="input" type="number" step="any" value={farm.length_m} onChange={(e) => setFarm({ ...farm, length_m: e.target.value })} /></Field>
                  <Field label="Width (m)"><input className="input" type="number" step="any" value={farm.width_m} onChange={(e) => setFarm({ ...farm, width_m: e.target.value })} /></Field>
                  <Field label="Height (m)"><input className="input" type="number" step="any" value={farm.height_m} onChange={(e) => setFarm({ ...farm, height_m: e.target.value })} /></Field>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Ownership"><select className="input" value={farm.ownership} onChange={(e) => setFarm({ ...farm, ownership: e.target.value })}><option value="owned">Owned</option><option value="leased">Leased (pay rent)</option></select></Field>
                {farm.ownership === 'leased' && <Field label="Monthly rent"><input className="input" type="number" inputMode="decimal" value={farm.monthly_rent} onChange={(e) => setFarm({ ...farm, monthly_rent: e.target.value })} placeholder={`${cur} — posted every month automatically`} /></Field>}
                <Field label="How often do you sell?"><select className="input" value={sale} onChange={(e) => setSale(e.target.value)}>{['daily', 'alternate days', 'twice a week', 'weekly', 'fortnightly', 'monthly', 'seasonal'].map((x) => <option key={x}>{x}</option>)}</select></Field>
              </div>
              <p className="text-xs text-slate-500">More {word.toLowerCase()}s, bays and plots can be added later from <b>Farms / polyhouses</b>.</p>
              <Nav onNext={saveFarm} />
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-slate-600">Tap the crops you grow. Add a usual price if you know it (used when a vendor has no special price).</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_CROPS.map((n) => <button type="button" key={n} onClick={() => toggleCrop(n)} className={crops.some((c) => c.name === n) ? 'chip-on' : 'chip-off'}>{n}</button>)}
              </div>
              <div className="flex gap-2">
                <input className="input" placeholder="Other crop name" value={custom} onChange={(e) => setCustom(e.target.value)} />
                <button type="button" className="btn-outline" onClick={() => { if (custom.trim()) { toggleCrop(custom.trim()); setCustom(''); } }}><Icon name="plus-lg" /></button>
              </div>
              {crops.length > 0 && (
                <div className="space-y-2">
                  {crops.map((c, i) => (
                    <div key={c.name} className="grid grid-cols-[1fr_90px_110px] gap-2 items-center">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <select className="input !py-2" value={c.unit} onChange={(e) => setCrops(crops.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}>{['kg', 'bunch', 'piece', 'crate', 'dozen', 'quintal'].map((u) => <option key={u}>{u}</option>)}</select>
                      <input className="input !py-2" type="number" inputMode="decimal" placeholder={`${cur}/${c.unit}`} value={c.price} onChange={(e) => setCrops(crops.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                    </div>
                  ))}
                </div>
              )}
              <Nav onNext={saveCrops} />
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-slate-600">Who do you sell to? Enter each vendor's price per crop — your delivery person will never have to type a price.</p>
              {vendors.map((v, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 p-3 space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
                    <input className="input !py-2" placeholder="Vendor name" value={v.name} onChange={(e) => setVendors(vendors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input className="input !py-2" placeholder="Phone" inputMode="tel" value={v.phone} onChange={(e) => setVendors(vendors.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                    <input className="input !py-2" placeholder="Credit days" type="number" value={v.credit_days} onChange={(e) => setVendors(vendors.map((x, j) => (j === i ? { ...x, credit_days: e.target.value } : x)))} />
                  </div>
                  {made.crops.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {made.crops.map((c) => (
                        <label key={c.id} className="text-xs text-slate-500">{c.name} ({cur}/{c.unit})
                          <input className="input !py-1.5 mt-0.5" type="number" inputMode="decimal" value={v.prices[c.id] || ''} onChange={(e) => setVendors(vendors.map((x, j) => (j === i ? { ...x, prices: { ...x.prices, [c.id]: e.target.value } } : x)))} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="btn-light w-full" onClick={() => setVendors([...vendors, { name: '', phone: '', credit_days: '', prices: {} }])}><Icon name="plus-lg" /> Add another vendor</button>
              <Nav onNext={saveVendors} />
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-slate-600">Add your workers and how they are paid. Attendance and wages are then calculated for you.</p>
              {workers.map((w, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_110px_100px] gap-2">
                  <input className="input !py-2" placeholder="Worker name" value={w.name} onChange={(e) => setWorkers(workers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="input !py-2" placeholder="Phone" inputMode="tel" value={w.phone} onChange={(e) => setWorkers(workers.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                  <select className="input !py-2" value={w.pay_type} onChange={(e) => setWorkers(workers.map((x, j) => (j === i ? { ...x, pay_type: e.target.value } : x)))}><option value="daily">Per day</option><option value="monthly">Per month</option><option value="piece">Per kg</option></select>
                  <input className="input !py-2" type="number" inputMode="decimal" placeholder={cur} value={w.wage} onChange={(e) => setWorkers(workers.map((x, j) => (j === i ? { ...x, wage: e.target.value } : x)))} />
                </div>
              ))}
              <button type="button" className="btn-light w-full" onClick={() => setWorkers([...workers, { name: '', phone: '', pay_type: 'daily', wage: '' }])}><Icon name="plus-lg" /> Add another worker</button>
              <Field label="Monthly electricity (current) bill — optional"><input className="input" type="number" inputMode="decimal" value={bills.electricity} onChange={(e) => setBills({ electricity: e.target.value })} placeholder={`${cur} — posted every month automatically`} /></Field>
              <Nav onNext={saveWorkers} />
            </>
          )}

          {step === 4 && (
            <>
              <div className="rounded-2xl bg-brand-50 p-4 text-center">
                <Icon name="check-circle-fill" className="text-4xl text-brand-600" />
                <p className="mt-2 font-semibold">You're ready.</p>
                <p className="text-sm text-slate-600">{made.farms} farm · {made.crops.length} crops · {made.vendors} vendors · {made.workers} workers added</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                {[['/harvest', 'basket', 'Record today\'s harvest'], ['/sell', 'truck', 'Record a sale'], ['/settings', 'person-plus', 'Create team logins']].map(([to, i, l]) => (
                  <button key={to} type="button" disabled={busy} onClick={() => finish(to)} className="card p-4 text-left hover:border-brand-400"><Icon name={i} className="text-xl text-brand-700" /><div className="mt-1 text-sm font-semibold">{l}</div></button>
                ))}
              </div>
              <button type="button" className="btn-primary w-full !py-3" disabled={busy} onClick={() => finish('/')}>{t('Start using Polyhouse OS')} <Icon name="arrow-right" /></button>
            </>
          )}
        </div>
        {step < 4 && <button type="button" className="mt-4 w-full text-sm text-slate-500 underline" onClick={() => finish('/')} disabled={busy}>{t('Skip setup for now')}</button>}
      </div>
    </div>
  );
}
