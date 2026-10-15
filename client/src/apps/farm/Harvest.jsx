// Quick harvest entry: crop -> grade -> quantity (+ farm / bay / picker). Respects spray harvest-lock.
import { useEffect, useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { num, todayISO } from '../../lib/format';
import { Card, Chips, Icon, PageHeader, useToast, Empty, Badge } from '../../ui/kit';
import { useOptions } from '../../ui/Form';

export default function Harvest() {
  const { role, on, meta } = useAuth();
  const toast = useToast();
  const grades = meta.org.settings.grades || ['A', 'B', 'C'];
  const blank = { date: todayISO(), crop_id: '', grade: grades[0] || 'A', quantity: '', culls: '', farm_id: '', bay_id: '', worker_id: '', notes: '' };
  const [f, setF] = useState(blank);
  const [lockErr, setLockErr] = useState('');
  const [busy, setBusy] = useState(false);
  const crops = (useApi('/r/crops').data || []).filter((c) => c.active);
  const farms = useOptions('farms');
  const bays = useOptions('bays', { farm_id: f.farm_id }, !f.farm_id);
  const workers = useOptions('workers', {}, !on('labour'));
  const list = useApi('/r/harvests', { from: f.date, to: f.date });
  const locks = useApi(on('scouting') ? '/ops/locks' : null, { date: f.date });

  useEffect(() => { if (farms.length === 1 && !f.farm_id) setF((x) => ({ ...x, farm_id: farms[0].id })); }, [farms]); // eslint-disable-line

  const save = async (e, override) => {
    e?.preventDefault();
    if (!f.crop_id || !(Number(f.quantity) > 0)) return toast('Pick crop and enter quantity', 'error');
    setBusy(true); setLockErr('');
    try {
      await api.post('/r/harvests', { ...f, override_lock: override ? 1 : undefined });
      toast(`${t('Saved')}: ${num(f.quantity)} ${crops.find((c) => String(c.id) === String(f.crop_id))?.unit || ''}`);
      setF((x) => ({ ...x, quantity: '', culls: '', notes: '' }));
      list.reload();
    } catch (e2) {
      if (e2.message.startsWith('Harvest locked')) setLockErr(e2.message); else toast(e2.message, 'error');
    } finally { setBusy(false); }
  };

  const crop = crops.find((c) => String(c.id) === String(f.crop_id));
  const rows = list.data || [];
  const byCrop = Object.values(rows.reduce((a, h) => { const k = `${h.crop_id_label} ${h.grade}`; a[k] = a[k] || { k, qty: 0 }; a[k].qty += Number(h.quantity); return a; }, {}));
  const lk = locks.data || [];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <PageHeader title={t('Harvest')} subtitle={t('Record what was plucked — by crop and grade')} />
        {lk.length > 0 && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            <b><Icon name="lock-fill" /> {t('Do not pick:')}</b> {lk.map((l) => `${l.farm_name}${l.bay_name ? ' / ' + l.bay_name : ''} (till ${l.lock_until})`).join(', ')}
          </div>
        )}
        <Card>
          <form onSubmit={save} className="space-y-4 pt-4">
            <div><label className="label">{t('Crop')}</label>
              {crops.length ? <Chips options={crops.map((c) => ({ value: c.id, label: c.name, color: c.color }))} value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v })} /> : <p className="text-sm text-slate-500">No crops yet. The owner must add crops first.</p>}
            </div>
            <div><label className="label">{t('Grade')}</label><Chips options={grades} value={f.grade} onChange={(v) => setF({ ...f, grade: v })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t('Quantity')} ({crop?.unit || 'kg'})</label><input className="input !text-2xl !font-bold" type="number" step="any" inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="0" /></div>
              <div><label className="label">{t('Culls / waste')}</label><input className="input !text-2xl" type="number" step="any" inputMode="decimal" value={f.culls} onChange={(e) => setF({ ...f, culls: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className="label">{t('Farm')}</label><select className="input" value={f.farm_id} onChange={(e) => setF({ ...f, farm_id: e.target.value, bay_id: '' })}><option value="">—</option>{farms.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
              <div><label className="label">{t('Bay')}</label><select className="input" value={f.bay_id} onChange={(e) => setF({ ...f, bay_id: e.target.value })} disabled={!f.farm_id}><option value="">—</option>{bays.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
              {on('labour') && <div><label className="label">{t('Picked by')}</label><select className="input" value={f.worker_id} onChange={(e) => setF({ ...f, worker_id: e.target.value })}><option value="">—</option>{workers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>}
              <div><label className="label">{t('Date')}</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            </div>
            {lockErr && (
              <div className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">
                <Icon name="lock" /> {lockErr}
                {['admin', 'manager'].includes(role) && <button type="button" className="ml-2 underline font-semibold" onClick={() => save(null, true)}>Save anyway (owner override)</button>}
              </div>
            )}
            <button className="btn-primary w-full !py-3 text-base" disabled={busy}><Icon name="check2-circle" /> {t('Save harvest')}</button>
          </form>
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-4 lg:pt-[60px]">
        <Card title={f.date === todayISO() ? t('Plucked today') : `${t('Harvest')} ${f.date}`}>
          {byCrop.length > 0 && <div className="flex flex-wrap gap-1.5 mb-3">{byCrop.map((b) => <Badge key={b.k} tone="green">{b.k}: {num(b.qty)}</Badge>)}</div>}
          {rows.length ? rows.map((h) => (
            <div key={h.id} className="flex justify-between gap-2 py-2 border-b border-slate-100 last:border-0 text-sm">
              <div className="min-w-0"><div className="font-medium">{h.crop_id_label} · {h.grade}</div><div className="text-slate-500 truncate">{[h.farm_id_label, h.bay_id_label, h.worker_id_label].filter(Boolean).join(' · ')}</div></div>
              <div className="font-semibold tabular-nums">{num(h.quantity)}</div>
            </div>
          )) : <Empty text="Nothing recorded yet" />}
        </Card>
      </div>
    </div>
  );
}
