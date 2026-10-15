// Platform owner: create a new customer (polyhouse / field / FPO ...) with its admin login, manage all customers
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Icon, Modal, Spinner, Badge, Stat, useToast, Empty } from '../components/Ui';
import { money, fdate, num } from '../utils';

const blank = { name: '', company_name: '', customer_type: 'single_polyhouse', owner_name: '', phone: '', email: '', district: '', state: '', admin_login: '', admin_password: '' };

export default function SuperAdmin() {
  const { meta, logout, loginWithToken } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [q, setQ] = useState('');
  const load = () => api.get('/super/orgs').then(setD);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (f.id) await api.put(`/super/orgs/${f.id}`, f); else await api.post('/super/orgs', f);
      toast(f.id ? 'Updated' : `Created ${f.name}. Admin login: ${f.admin_login}`); setF(null); load();
    } catch (e2) { toast(e2.message, 'error'); }
  };
  const resetPw = async (o) => {
    const pw = prompt(`New password for ${o.name} admin (${o.admin_login})`);
    if (!pw) return;
    try { await api.post(`/super/orgs/${o.id}/reset-admin`, { password: pw }); toast('Password reset'); } catch (e) { toast(e.message, 'error'); }
  };
  const openAs = async (o) => {
    const r = await api.post(`/super/orgs/${o.id}/impersonate`);
    localStorage.setItem('pos_super_token', localStorage.getItem('pos_token'));
    await loginWithToken(r.token); window.location.href = '/';
  };
  const toggle = async (o) => { await api.put(`/super/orgs/${o.id}`, { status: o.status === 'active' ? 'suspended' : 'active' }); load(); };

  if (!d) return <Spinner />;
  const types = d.customerTypes;
  const list = d.orgs.filter((o) => (o.name + o.owner_name + o.district + o.admin_login).toLowerCase().includes(q.toLowerCase()));
  const inp = (k, l, t = 'text', req) => <div><label className="label">{l}</label><input type={t} required={req} className="input" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white px-4 lg:px-8 py-3 flex items-center gap-3">
        <img src="/favicon.svg" className="h-8 w-8" alt="" />
        <div className="flex-1"><div className="font-bold">Polyhouse OS · Platform</div><div className="text-xs text-slate-400">{meta.user.name} · super admin</div></div>
        <button className="btn bg-white/10 hover:bg-white/20 text-white" onClick={logout}><Icon name="bi-box-arrow-right" /></button>
      </header>
      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="h-title">Customers</h1>
          <button className="btn-primary" onClick={() => setF({ ...blank })}><Icon name="bi-plus-lg" /> New polyhouse / customer</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Customers" value={d.orgs.length} sub={`${d.orgs.filter((o) => o.status === 'active').length} active`} icon="bi-building" tone="green" />
          <Stat label="Farms" value={num(d.orgs.reduce((a, o) => a + o.farms, 0))} icon="bi-house" />
          <Stat label="Acres" value={num(d.orgs.reduce((a, o) => a + Number(o.acres), 0))} icon="bi-map" />
          <Stat label="Sales tracked (30d)" value={money(d.orgs.reduce((a, o) => a + Number(o.sales_30d), 0))} icon="bi-graph-up" tone="blue" />
        </div>
        <input className="input" placeholder="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
        {!list.length ? <Card><Empty text="No customers yet. Create the first one." /></Card> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((o) => (
              <Card key={o.id}>
                <div className="pt-4 flex justify-between gap-2">
                  <div><div className="font-bold text-lg">{o.name}</div><div className="text-sm text-slate-500">{types[o.customer_type]?.label}</div></div>
                  <Badge tone={o.status === 'active' ? 'green' : 'red'}>{o.status}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-600 space-y-0.5">
                  <div><Icon name="bi-person" /> {o.owner_name || '—'} {o.phone && `· ${o.phone}`}</div>
                  <div><Icon name="bi-geo-alt" /> {[o.district, o.state].filter(Boolean).join(', ') || '—'}</div>
                  <div><Icon name="bi-key" /> admin: <b>{o.admin_login}</b></div>
                  <div className="text-xs text-slate-500">{o.farms} farms · {num(o.acres)} acres · {o.users} users · sales 30d {money(o.sales_30d)} · active {fdate(o.last_active)}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className="btn-light !py-1.5 text-xs" onClick={() => openAs(o)} disabled={o.status !== 'active'}><Icon name="bi-box-arrow-in-right" /> Open</button>
                  <button className="btn-light !py-1.5 text-xs" onClick={() => setF({ ...o })}><Icon name="bi-pencil" /> Edit</button>
                  <button className="btn-light !py-1.5 text-xs" onClick={() => resetPw(o)}><Icon name="bi-key" /> Reset password</button>
                  <button className="btn-light !py-1.5 text-xs" onClick={() => toggle(o)}>{o.status === 'active' ? 'Suspend' : 'Activate'}</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? `Edit ${f.name}` : 'New customer'} wide>
        {f && (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Customer type</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries(types).map(([k, t]) => (
                  <button type="button" key={k} onClick={() => setF({ ...f, customer_type: k })} className={f.customer_type === k ? 'chip-on justify-start !rounded-xl !py-2.5' : 'chip-off justify-start !rounded-xl !py-2.5'}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {inp('name', 'Polyhouse / farm name', 'text', true)}{inp('company_name', 'Company name')}{inp('owner_name', 'Owner name')}{inp('phone', 'Phone')}{inp('email', 'Email')}{inp('district', 'District')}{inp('state', 'State')}
            </div>
            {!f.id && (
              <div className="rounded-2xl bg-brand-50 p-3 grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 text-sm font-semibold text-brand-800">Owner's admin login</div>
                {inp('admin_login', 'Login (phone / user ID)', 'text', true)}{inp('admin_password', 'Password (min 6)', 'text', true)}
              </div>
            )}
            <button className="btn-primary w-full">{f.id ? 'Save' : 'Create customer'}</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
