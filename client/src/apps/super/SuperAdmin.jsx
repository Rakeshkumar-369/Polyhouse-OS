// Platform owner: create a customer + its admin login in one step, share the login on WhatsApp, manage customers & demo leads
import { useState } from 'react';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card, Icon, Modal, Spinner, Badge, Stat, useToast, Empty, Tabs } from '../../ui/kit';
import { money, fdate, num } from '../../lib/format';
import { PasswordForm } from '../farm/Account';

const blank = { name: '', company_name: '', customer_type: 'single_polyhouse', owner_name: '', phone: '', email: '', district: '', state: 'Telangana', admin_login: '', admin_password: '' };
const genPassword = () => Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000);
const shareText = (o) => `Namaste ${o.owner_name || ''}, your Polyhouse OS account for ${o.name} is ready.\n\nOpen: ${window.location.origin}/login\nUser ID: ${o.admin_login}\nPassword: ${o.admin_password}\n\nLog in and follow the 5-step setup. Please change the password from My account.`;

export default function SuperAdmin() {
  const { meta, logout, loginWithToken } = useAuth();
  const toast = useToast();
  const { data: d, reload } = useApi('/super/orgs');
  const leads = useApi('/super/leads');
  const [tab, setTab] = useState('orgs');
  const [f, setF] = useState(null);
  const [created, setCreated] = useState(null);
  const [q, setQ] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try {
      if (f.id) { await api.put(`/super/orgs/${f.id}`, f); toast('Updated'); } else {
        const r = await api.post('/super/orgs', f);
        if (f.lead_id) await api.put(`/super/leads/${f.lead_id}`, { status: 'converted' });
        setCreated({ ...f, id: r.id });
      }
      setF(null); reload(); leads.reload();
    } catch (e2) { toast(e2.message, 'error'); }
  };
  const resetPw = async (o) => {
    const pw = window.prompt(`New password for ${o.name} admin (${o.admin_login})`, genPassword());
    if (!pw) return;
    try { await api.post(`/super/orgs/${o.id}/reset-admin`, { password: pw }); setCreated({ ...o, admin_password: pw, reset: true }); } catch (e) { toast(e.message, 'error'); }
  };
  const openAs = async (id) => {
    const r = await api.post(`/super/orgs/${id}/impersonate`);
    localStorage.setItem('pos_super_token', localStorage.getItem('pos_token'));
    api.clear(); await loginWithToken(r.token); window.location.href = '/';
  };
  const toggle = async (o) => { await api.put(`/super/orgs/${o.id}`, { status: o.status === 'active' ? 'suspended' : 'active' }); reload(); };
  const fromLead = (l) => setF({ ...blank, name: l.name.includes('FPO') ? l.name : `${l.name} Farms`, owner_name: l.name, phone: l.phone, email: l.email || '', customer_type: l.farm_type || 'single_polyhouse', district: l.location || '', admin_login: l.phone, admin_password: genPassword(), lead_id: l.id });

  if (!d) return <Spinner />;
  const types = d.customerTypes;
  const list = d.orgs.filter((o) => `${o.name} ${o.owner_name} ${o.district} ${o.admin_login}`.toLowerCase().includes(q.toLowerCase()));
  const inp = (k, l, req, p = {}) => <div><label className="label">{l}</label><input required={req} className="input" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...p} /></div>;

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-3">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <div className="flex-1"><div className="font-bold">Polyhouse OS · Platform</div><div className="text-xs text-slate-400">{meta.user.name} · super admin</div></div>
          <button className="btn bg-white/10 hover:bg-white/20 text-white" onClick={logout} aria-label="Logout"><Icon name="box-arrow-right" /></button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[22px] font-bold tracking-tight">Customers</h1>
          <button className="btn-primary" onClick={() => setF({ ...blank, admin_password: genPassword() })}><Icon name="plus-lg" /> New customer + admin login</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Customers" value={d.orgs.length} sub={`${d.orgs.filter((o) => o.status === 'active').length} active`} icon="building" tone="green" />
          <Stat label="Farms · acres" value={`${num(d.orgs.reduce((a, o) => a + o.farms, 0))} · ${num(d.orgs.reduce((a, o) => a + Number(o.acres), 0))}`} icon="map" />
          <Stat label="Sales tracked (30d)" value={money(d.orgs.reduce((a, o) => a + Number(o.sales_30d), 0))} icon="graph-up" tone="blue" />
          <Stat label="New leads" value={d.newLeads} sub="from the website" icon="megaphone" tone={d.newLeads ? 'amber' : 'slate'} onClick={() => setTab('leads')} />
        </div>

        {created && (
          <div className="card p-4 border-brand-300 bg-brand-50">
            <div className="flex items-start gap-3">
              <Icon name="check-circle-fill" className="text-2xl text-brand-600 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{created.reset ? 'Password reset' : `${created.name} is ready`} — the owner can log in now.</div>
                <div className="mt-1 text-sm font-mono bg-white rounded-lg px-3 py-2 border border-brand-200 break-all">{window.location.origin}/login · User ID: <b>{created.admin_login}</b> · Password: <b>{created.admin_password}</b></div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a className="btn-primary !py-1.5" target="_blank" rel="noreferrer" href={`https://wa.me/${(created.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(shareText(created))}`}><Icon name="whatsapp" /> Send on WhatsApp</a>
                  <button className="btn-outline !py-1.5" onClick={() => { navigator.clipboard?.writeText(shareText(created)); toast('Copied'); }}><Icon name="copy" /> Copy</button>
                  {!created.reset && <button className="btn-outline !py-1.5" onClick={() => openAs(created.id)}><Icon name="box-arrow-in-right" /> Open & set up for them</button>}
                  <button className="btn-light !py-1.5" onClick={() => setCreated(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Tabs tabs={[['orgs', 'Customers'], ['leads', `Leads${d.newLeads ? ` (${d.newLeads})` : ''}`], ['account', 'My account']]} value={tab} onChange={setTab} />

        {tab === 'orgs' && (
          <>
            <input className="input" placeholder="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
            {!list.length ? <Card><Empty text="No customers yet. Create the first one." /></Card> : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((o) => (
                  <Card key={o.id}>
                    <div className="pt-4 flex justify-between gap-2">
                      <div className="min-w-0"><div className="font-bold text-lg truncate">{o.name}</div><div className="text-sm text-slate-500">{types[o.customer_type]?.label}</div></div>
                      <Badge tone={o.status === 'active' ? 'green' : 'red'}>{o.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-600 space-y-0.5">
                      <div><Icon name="person" /> {o.owner_name || '—'} {o.phone && `· ${o.phone}`}</div>
                      <div><Icon name="geo-alt" /> {[o.district, o.state].filter(Boolean).join(', ') || '—'}</div>
                      <div><Icon name="key" /> admin: <b>{o.admin_login}</b></div>
                      <div className="text-xs text-slate-500">{o.farms} farms · {num(o.acres)} acres · {o.users} users · sales 30d {money(o.sales_30d)} · active {fdate(o.last_active)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button className="btn-light !py-1.5 text-xs" onClick={() => openAs(o.id)} disabled={o.status !== 'active'}><Icon name="box-arrow-in-right" /> Open</button>
                      <button className="btn-light !py-1.5 text-xs" onClick={() => setF({ ...o })}><Icon name="pencil" /> Edit</button>
                      <button className="btn-light !py-1.5 text-xs" onClick={() => resetPw(o)}><Icon name="key" /> Reset password</button>
                      <button className="btn-light !py-1.5 text-xs" onClick={() => toggle(o)}>{o.status === 'active' ? 'Suspend' : 'Activate'}</button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'leads' && (
          !leads.data ? <Spinner /> : !leads.data.length ? <Card><Empty icon="megaphone" text="No demo requests yet. They arrive from the website's “Request a demo” form." /></Card> : (
            <div className="grid gap-3 md:grid-cols-2">
              {leads.data.map((l) => (
                <Card key={l.id}>
                  <div className="pt-4 flex justify-between gap-2"><div><div className="font-semibold">{l.name}</div><div className="text-sm text-slate-500">{l.farm_type?.replace('_', ' ')} · {l.acres || '?'} acres · {l.location || '—'}</div></div><Badge tone={{ new: 'amber', contacted: 'blue', converted: 'green', closed: 'slate' }[l.status]}>{l.status}</Badge></div>
                  {l.message && <p className="text-sm text-slate-600 mt-2">“{l.message}”</p>}
                  <div className="text-xs text-slate-500 mt-1">{fdate(l.created_at)}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a className="btn-light !py-1.5 text-xs" href={`tel:${l.phone}`}><Icon name="telephone" /> {l.phone}</a>
                    <a className="btn-light !py-1.5 text-xs" target="_blank" rel="noreferrer" href={`https://wa.me/${l.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`}><Icon name="whatsapp" /> WhatsApp</a>
                    {l.status === 'new' && <button className="btn-light !py-1.5 text-xs" onClick={async () => { await api.put(`/super/leads/${l.id}`, { status: 'contacted' }); leads.reload(); reload(); }}>Mark contacted</button>}
                    {l.status !== 'converted' && <button className="btn-primary !py-1.5 text-xs" onClick={() => fromLead(l)}><Icon name="person-plus" /> Create account</button>}
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {tab === 'account' && <Card title="Change my password" className="max-w-md"><PasswordForm /></Card>}
      </main>

      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? `Edit ${f.name}` : 'New customer'} wide>
        {f && (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Customer type</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries(types).map(([k, tp]) => <button type="button" key={k} onClick={() => setF({ ...f, customer_type: k })} className={(f.customer_type === k ? 'chip-on' : 'chip-off') + ' justify-start !rounded-xl !py-2.5'}>{tp.label}</button>)}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {inp('name', 'Polyhouse / farm name (e.g. XYZ Polyhouse)', true)}{inp('owner_name', 'Owner name')}{inp('phone', 'Owner phone', false, { inputMode: 'tel' })}{inp('company_name', 'Company name')}{inp('email', 'Email')}{inp('district', 'District')}{inp('state', 'State')}
              {f.id && <div><label className="label">Status</label><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">active</option><option value="suspended">suspended</option></select></div>}
            </div>
            {!f.id && (
              <div className="rounded-2xl bg-brand-50 p-3 grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 text-sm font-semibold text-brand-800"><Icon name="key" /> Owner's admin login</div>
                <div><label className="label">User ID (phone works best)</label><input required className="input" autoCapitalize="none" value={f.admin_login} onChange={(e) => setF({ ...f, admin_login: e.target.value })} placeholder={f.phone || 'e.g. 9876543210'} /></div>
                <div><label className="label">Password (min 6)</label><div className="flex gap-2"><input required minLength={6} className="input" value={f.admin_password} onChange={(e) => setF({ ...f, admin_password: e.target.value })} /><button type="button" className="btn-light" onClick={() => setF({ ...f, admin_password: genPassword() })} aria-label="Generate"><Icon name="arrow-clockwise" /></button></div></div>
              </div>
            )}
            <button className="btn-primary w-full !py-3">{f.id ? 'Save' : 'Create customer & login'}</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
