// Admin settings: company profile & vision, module on/off toggles, alert limits, user logins
import { useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Link, navigate } from '../../lib/router';
import { t } from '../../lib/i18n';
import { fdate } from '../../lib/format';
import { Card, Icon, Modal, PageHeader, Spinner, Toggle, useToast, Badge, Tabs } from '../../ui/kit';
import { useOptions } from '../../ui/Form';

const ROLES = {
  admin: 'Owner / admin — everything', manager: 'Manager — everything except settings', supervisor: 'Supervisor — harvest, sell, labour, crop logs',
  delivery: 'Delivery — sell & harvest entry only', vendor: 'Vendor — own deliveries, dues, orders', labour: 'Labour — own attendance & earnings',
};

// WhatsApp message with the login details, so the person can start immediately
export const shareLogin = (name, login, password, org) => `https://wa.me/?text=${encodeURIComponent(`Namaste ${name}, your Polyhouse OS login for ${org}:\n\nLink: ${window.location.origin}/login\nUser ID: ${login}\nPassword: ${password}\n\nPlease change the password after your first login.`)}`;

function Profile({ org, reload }) {
  const toast = useToast();
  const [f, setF] = useState({ name: org.name, company_name: org.company_name || '', owner_name: org.owner_name || '', phone: org.phone || '', email: org.email || '', address: org.address || '', district: org.district || '', state: org.state || '', gstin: org.gstin || '',
    sale_frequency: org.settings.sale_frequency, currency: org.settings.currency, grades: (org.settings.grades || []).join(', '), opening_cash: org.settings.opening_cash || 0, books_start: org.settings.books_start || '' });
  const save = async (e) => {
    e.preventDefault();
    const { sale_frequency, currency, grades, opening_cash, books_start, ...profile } = f;
    try {
      await api.put('/settings', { ...profile, settings: { sale_frequency, currency, opening_cash, books_start, grades: grades.split(',').map((g) => g.trim()).filter(Boolean) } });
      toast(t('Saved')); reload();
    } catch (e2) { toast(e2.message, 'error'); }
  };
  const inp = (k, l, type = 'text') => <div><label className="label">{t(l)}</label><input type={type} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <form onSubmit={save} className="space-y-4">
      <Card title="Company">
        <div className="grid sm:grid-cols-2 gap-3">{inp('name', 'Farm / brand name')}{inp('company_name', 'Company name')}{inp('owner_name', 'Owner name')}{inp('phone', 'Phone')}{inp('email', 'Email')}{inp('gstin', 'GSTIN')}{inp('address', 'Address')}{inp('district', 'District')}{inp('state', 'State')}</div>
        <p className="text-sm text-slate-500 mt-3">Acres, length, width, height, rent and lease are set per farm under <Link className="text-brand-700 underline" to="/m/farms">Farms</Link>. Workers & salaries under <Link className="text-brand-700 underline" to="/m/workers">Workers</Link>, crops under <Link className="text-brand-700 underline" to="/m/crops">Crops</Link>, vendor prices under <Link className="text-brand-700 underline" to="/m/price_list">Vendor price list</Link>.</p>
      </Card>
      <Card title="How you run the farm">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">How often you sell produce</label><select className="input" value={f.sale_frequency} onChange={(e) => setF({ ...f, sale_frequency: e.target.value })}>{['daily', 'alternate days', 'twice a week', 'weekly', 'fortnightly', 'monthly', 'seasonal'].map((x) => <option key={x}>{x}</option>)}</select></div>
          {inp('grades', 'Grades used (comma separated)')}{inp('currency', 'Currency symbol')}{inp('opening_cash', 'Opening cash & bank balance', 'number')}{inp('books_start', 'Books start date (cash tracked from)', 'date')}
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary"><Icon name="check2" /> {t('Save')}</button>
        <button type="button" className="btn-outline" onClick={async () => { await api.put('/settings', { settings: { setup_done: false } }); await reload(); navigate('/setup'); }}><Icon name="rocket-takeoff" /> Run setup wizard again</button>
      </div>
    </form>
  );
}

function Modules({ data, reload }) {
  const toast = useToast();
  const [mods, setMods] = useState(data.org.settings.modules);
  const flip = async (k, v) => {
    setMods({ ...mods, [k]: v });
    try { await api.put('/settings', { settings: { modules: { [k]: v } } }); reload(); toast(`${data.modules.find((m) => m.key === k).label}: ${v ? 'ON' : 'OFF'}`); } catch (e) { toast(e.message, 'error'); }
  };
  const groups = [...new Set(data.modules.map((m) => m.group))];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Turn on only what your farm uses. Turning a module off hides its screens for everyone — data is kept and comes back when you turn it on.</p>
      {groups.map((g) => (
        <Card key={g} title={t(g)} pad={false}>
          {data.modules.filter((m) => m.group === g).map((m) => (
            <div key={m.key} className="flex items-center gap-3 px-4 py-3 border-t border-slate-100">
              <div className="flex-1 min-w-0"><div className="font-medium">{m.label}</div><div className="text-xs text-slate-500">{m.desc}</div></div>
              <Toggle checked={mods[m.key] !== false} onChange={(v) => flip(m.key, v)} label={m.label} />
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function Thresholds({ org, reload }) {
  const toast = useToast();
  const [th, setTh] = useState(org.settings.thresholds);
  const labels = { ec_min: 'EC min (dS/m)', ec_max: 'EC max', ph_min: 'pH min', ph_max: 'pH max', drain_ec_margin: 'Drain EC above feed by (salt alert)', temp_min: 'Temperature min °C', temp_max: 'Temperature max °C', hum_min: 'Humidity min %', hum_max: 'Humidity max %', trap_count: 'Trap count alert above', asset_due_days: 'Asset service alert (days before)', doc_expiry_days: 'Document expiry alert (days before)' };
  const save = async (e) => { e.preventDefault(); try { await api.put('/settings', { settings: { thresholds: th } }); toast(t('Saved')); reload(); } catch (e2) { toast(e2.message, 'error'); } };
  return (
    <form onSubmit={save}>
      <Card title="Alert limits" sub="Crop recipes override EC / pH per crop">
        <div className="grid sm:grid-cols-3 gap-3">{Object.keys(labels).map((k) => <div key={k}><label className="label">{labels[k]}</label><input className="input" type="number" step="any" value={th[k]} onChange={(e) => setTh({ ...th, [k]: e.target.value })} /></div>)}</div>
        <button className="btn-primary mt-4">{t('Save')}</button>
      </Card>
    </form>
  );
}

function Users({ org }) {
  const toast = useToast();
  const { data: rows, reload } = useApi('/users');
  const [edit, setEdit] = useState(null);
  const [created, setCreated] = useState(null);
  const workers = useOptions('workers');
  const parties = useOptions('parties', { kind: 'buyer' });
  const save = async (e) => {
    e.preventDefault();
    try {
      if (edit.id) await api.put(`/users/${edit.id}`, edit); else { await api.post('/users', edit); setCreated({ name: edit.name, login: edit.login, password: edit.password }); }
      toast(t('Saved')); setEdit(null); reload();
    } catch (e2) { toast(e2.message, 'error'); }
  };
  const remove = async () => { if (!window.confirm('Delete this login?')) return; try { await api.del(`/users/${edit.id}`); setEdit(null); reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2"><p className="text-sm text-slate-500">Create logins for your team, vendors and workers.</p><button className="btn-primary" onClick={() => setEdit({ role: 'delivery', name: '', login: '', password: '' })}><Icon name="person-plus" /> Add login</button></div>
      {created && (
        <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 text-sm">
          <b>Login created for {created.name}.</b> User ID <code className="font-mono">{created.login}</code> · Password <code className="font-mono">{created.password}</code>
          <div className="mt-2 flex gap-2"><a className="btn-primary !py-1.5" target="_blank" rel="noreferrer" href={shareLogin(created.name, created.login, created.password, org.name)}><Icon name="whatsapp" /> Send on WhatsApp</a><button className="btn-light !py-1.5" onClick={() => setCreated(null)}>{t('Close')}</button></div>
        </div>
      )}
      {!rows ? <Spinner /> : (
        <Card pad={false}>
          {rows.map((u) => (
            <button key={u.id} onClick={() => setEdit({ ...u, password: '' })} className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50">
              <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-800 grid place-items-center font-bold shrink-0">{u.name[0]}</div>
              <div className="flex-1 min-w-0"><div className="font-medium truncate">{u.name} {!u.active && <Badge tone="red">disabled</Badge>}</div><div className="text-xs text-slate-500 truncate">{u.login}{u.worker_name ? ` · ${u.worker_name}` : ''}{u.party_name ? ` · ${u.party_name}` : ''} · last login {fdate(u.last_login)}</div></div>
              <Badge tone={u.role === 'admin' ? 'green' : 'slate'}>{u.role}</Badge>
            </button>
          ))}
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit login' : 'New login'}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <div><label className="label">Role</label><select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            {edit.role === 'labour' && <div><label className="label">Which worker?</label><select className="input" required value={edit.worker_id || ''} onChange={(e) => { const w = workers.find((x) => String(x.id) === e.target.value); setEdit({ ...edit, worker_id: e.target.value, name: edit.name || w?.label || '' }); }}><option value="">—</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>}
            {edit.role === 'vendor' && <div><label className="label">Which vendor?</label><select className="input" required value={edit.party_id || ''} onChange={(e) => { const p = parties.find((x) => String(x.id) === e.target.value); setEdit({ ...edit, party_id: e.target.value, name: edit.name || p?.label || '' }); }}><option value="">—</option>{parties.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>}
            <div><label className="label">{t('Name')}</label><input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label className="label">{t('Phone / User ID')}</label><input className="input" required disabled={!!edit.id} autoCapitalize="none" value={edit.login} onChange={(e) => setEdit({ ...edit, login: e.target.value })} /></div>
            <div><label className="label">{edit.id ? 'New password (leave blank to keep)' : 'Password (min 6)'}</label><input className="input" type="text" required={!edit.id} minLength={6} value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
            {edit.id && <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>}
            <div className="flex gap-2"><button className="btn-primary flex-1">{t('Save')}</button>{edit.id && <button type="button" className="btn-danger" onClick={remove} aria-label={t('Delete')}><Icon name="trash" /></button>}</div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default function Settings() {
  const { reload: reloadMeta } = useAuth();
  const { data, reload } = useApi('/settings');
  const [tab, setTab] = useState('profile');
  const refresh = () => { reload(); reloadMeta(); };
  if (!data) return <Spinner />;
  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader title={t('Settings')} subtitle="Set up your farm your way" />
      <Tabs tabs={[['profile', 'Farm profile'], ['modules', 'Modules on/off'], ['limits', 'Alert limits'], ['users', 'Users & logins']]} value={tab} onChange={setTab} />
      {tab === 'profile' && <Profile org={data.org} reload={refresh} />}
      {tab === 'modules' && <Modules data={data} reload={refresh} />}
      {tab === 'limits' && <Thresholds org={data.org} reload={refresh} />}
      {tab === 'users' && <Users org={data.org} />}
    </div>
  );
}
