// Admin settings: company profile & vision, module on/off toggles, alert thresholds, user logins
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, Modal, PageHeader, Spinner, Toggle, useToast, Badge } from '../components/Ui';
import { useOptions } from '../components/Form';
import { fdate } from '../utils';

const ROLES = {
  admin: 'Owner / admin — everything', manager: 'Manager — everything except settings', supervisor: 'Supervisor — harvest, sell, labour, crop logs',
  delivery: 'Delivery — sell & harvest entry only', vendor: 'Vendor — own deliveries, dues, orders', labour: 'Labour — own attendance & earnings',
};

function Profile({ data, reload }) {
  const toast = useToast();
  const o = data.org;
  const [f, setF] = useState({ name: o.name, company_name: o.company_name || '', owner_name: o.owner_name || '', phone: o.phone || '', email: o.email || '', address: o.address || '', district: o.district || '', state: o.state || '', gstin: o.gstin || '',
    sale_frequency: o.settings.sale_frequency, currency: o.settings.currency, grades: (o.settings.grades || []).join(', '), opening_cash: o.settings.opening_cash || 0, books_start: o.settings.books_start || '' });
  const save = async (e) => {
    e.preventDefault();
    const { sale_frequency, currency, grades, opening_cash, books_start, ...profile } = f;
    try {
      await api.put('/settings', { ...profile, settings: { sale_frequency, currency, opening_cash, books_start, grades: grades.split(',').map((g) => g.trim()).filter(Boolean) } });
      toast('Saved'); reload();
    } catch (e2) { toast(e2.message, 'error'); }
  };
  const inp = (k, l, t = 'text') => <div><label className="label">{l}</label><input type={t} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <form onSubmit={save} className="space-y-4">
      <Card title="Company">
        <div className="grid sm:grid-cols-2 gap-3">
          {inp('name', 'Farm / brand name')}{inp('company_name', 'Company name')}{inp('owner_name', 'Owner name')}{inp('phone', 'Phone')}{inp('email', 'Email')}{inp('gstin', 'GSTIN')}{inp('address', 'Address')}{inp('district', 'District')}{inp('state', 'State')}
        </div>
        <p className="text-sm text-slate-500 mt-3">Acres, length, width, height, rent and lease of each polyhouse / field are set under <Link className="text-brand-700 underline" to="/m/farms">Farms</Link>. Labour & salaries under <Link className="text-brand-700 underline" to="/m/workers">Workers</Link>, crops under <Link className="text-brand-700 underline" to="/m/crops">Crops</Link>, vendors under <Link className="text-brand-700 underline" to="/vendors">Vendors</Link>.</p>
      </Card>
      <Card title="How you run the farm">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">How often you sell produce</label>
            <select className="input" value={f.sale_frequency} onChange={(e) => setF({ ...f, sale_frequency: e.target.value })}>{['daily', 'alternate days', 'twice a week', 'weekly', 'fortnightly', 'monthly', 'seasonal'].map((x) => <option key={x}>{x}</option>)}</select>
          </div>
          {inp('grades', 'Grades used (comma separated)')}
          {inp('currency', 'Currency symbol')}
          {inp('opening_cash', 'Opening cash & bank balance', 'number')}
          {inp('books_start', 'Books start date (cash tracked from)', 'date')}
        </div>
      </Card>
      <button className="btn-primary w-full sm:w-auto"><Icon name="bi-check2" /> Save settings</button>
    </form>
  );
}

function Modules({ data, reload }) {
  const toast = useToast();
  const [mods, setMods] = useState(data.org.settings.modules);
  const flip = async (k, v) => {
    const next = { ...mods, [k]: v }; setMods(next);
    try { await api.put('/settings', { settings: { modules: { [k]: v } } }); reload(); toast(`${data.modules.find((m) => m.key === k).label} turned ${v ? 'ON' : 'OFF'}`); } catch (e) { toast(e.message, 'error'); }
  };
  const groups = [...new Set(data.modules.map((m) => m.group))];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Turn on only what your farm uses. Turning a module off hides its screens for everyone — data is kept and comes back when you turn it on.</p>
      {groups.map((g) => (
        <Card key={g} title={g} pad={false}>
          {data.modules.filter((m) => m.group === g).map((m) => (
            <div key={m.key} className="flex items-center gap-3 px-4 py-3 border-t border-slate-100">
              <div className="flex-1"><div className="font-medium">{m.label}</div><div className="text-xs text-slate-500">{m.desc}</div></div>
              <Toggle checked={mods[m.key] !== false} onChange={(v) => flip(m.key, v)} />
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function Thresholds({ data, reload }) {
  const toast = useToast();
  const [t, setT] = useState(data.org.settings.thresholds);
  const labels = { ec_min: 'EC min (dS/m)', ec_max: 'EC max', ph_min: 'pH min', ph_max: 'pH max', drain_ec_margin: 'Drain EC above feed by (salt alert)', temp_min: 'Temperature min °C', temp_max: 'Temperature max °C', hum_min: 'Humidity min %', hum_max: 'Humidity max %', trap_count: 'Trap count alert above', asset_due_days: 'Asset service alert (days before)', doc_expiry_days: 'Document expiry alert (days before)' };
  const save = async (e) => { e.preventDefault(); try { await api.put('/settings', { settings: { thresholds: t } }); toast('Saved'); reload(); } catch (e2) { toast(e2.message, 'error'); } };
  return (
    <form onSubmit={save}>
      <Card title="Alert limits" action={<span className="text-xs text-slate-400">Crop recipes override EC/pH per crop</span>}>
        <div className="grid sm:grid-cols-3 gap-3">
          {Object.keys(labels).map((k) => <div key={k}><label className="label">{labels[k]}</label><input className="input" type="number" step="any" value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></div>)}
        </div>
        <button className="btn-primary mt-4">Save limits</button>
      </Card>
    </form>
  );
}

function Users() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const workers = useOptions('workers');
  const parties = useOptions('parties', { kind: 'buyer' });
  const load = () => api.get('/users').then(setRows);
  useEffect(() => { load(); }, []);
  const save = async (e) => {
    e.preventDefault();
    try {
      if (edit.id) await api.put(`/users/${edit.id}`, edit); else await api.post('/users', edit);
      toast('Saved'); setEdit(null); load();
    } catch (e2) { toast(e2.message, 'error'); }
  };
  const remove = async () => { if (!confirm('Delete this login?')) return; try { await api.del(`/users/${edit.id}`); setEdit(null); load(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center"><p className="text-sm text-slate-500">Create logins for your team, vendors and workers.</p><button className="btn-primary" onClick={() => setEdit({ role: 'delivery', name: '', login: '', password: '' })}><Icon name="bi-person-plus" /> Add login</button></div>
      {!rows ? <Spinner /> : (
        <Card pad={false}>
          {rows.map((u) => (
            <button key={u.id} onClick={() => setEdit({ ...u, password: '' })} className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50">
              <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-800 grid place-items-center font-bold">{u.name[0]}</div>
              <div className="flex-1 min-w-0"><div className="font-medium">{u.name} {!u.active && <Badge tone="red">disabled</Badge>}</div><div className="text-xs text-slate-500">{u.login}{u.worker_name ? ` · ${u.worker_name}` : ''}{u.party_name ? ` · ${u.party_name}` : ''} · last login {fdate(u.last_login)}</div></div>
              <Badge tone={u.role === 'admin' ? 'green' : 'slate'}>{u.role}</Badge>
            </button>
          ))}
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit login' : 'New login'}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <div><label className="label">Role</label>
              <select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
            {edit.role === 'labour' && <div><label className="label">Which worker?</label><select className="input" required value={edit.worker_id || ''} onChange={(e) => { const w = workers.find((x) => x.id == e.target.value); setEdit({ ...edit, worker_id: e.target.value, name: edit.name || w?.label || '' }); }}><option value="">—</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>}
            {edit.role === 'vendor' && <div><label className="label">Which vendor?</label><select className="input" required value={edit.party_id || ''} onChange={(e) => { const p = parties.find((x) => x.id == e.target.value); setEdit({ ...edit, party_id: e.target.value, name: edit.name || p?.label || '' }); }}><option value="">—</option>{parties.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>}
            <div><label className="label">Name</label><input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label className="label">Login (phone or user ID)</label><input className="input" required disabled={!!edit.id} value={edit.login} onChange={(e) => setEdit({ ...edit, login: e.target.value })} /></div>
            <div><label className="label">{edit.id ? 'New password (leave blank to keep)' : 'Password (min 6)'}</label><input className="input" type="text" required={!edit.id} minLength={6} value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
            {edit.id && <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>}
            <div className="flex gap-2"><button className="btn-primary flex-1">Save</button>{edit.id && <button type="button" className="btn-danger" onClick={remove}><Icon name="bi-trash" /></button>}</div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default function Settings() {
  const { reload: reloadMeta } = useAuth();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('profile');
  const load = () => api.get('/settings').then(setData);
  useEffect(() => { load(); }, []);
  const reload = () => { load(); reloadMeta(); };
  if (!data) return <Spinner />;
  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader title="Settings" subtitle="Set up your farm your way" />
      <div className="flex gap-1 overflow-x-auto">{[['profile', 'Farm profile'], ['modules', 'Modules on/off'], ['limits', 'Alert limits'], ['users', 'Users & logins']].map(([k, l]) => <button key={k} className={k === tab ? 'chip-on whitespace-nowrap' : 'chip-off whitespace-nowrap'} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'profile' && <Profile data={data} reload={reload} />}
      {tab === 'modules' && <Modules data={data} reload={reload} />}
      {tab === 'limits' && <Thresholds data={data} reload={reload} />}
      {tab === 'users' && <Users />}
    </div>
  );
}
