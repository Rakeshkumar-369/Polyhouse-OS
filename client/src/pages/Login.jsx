// Single login screen for every role (super admin, owner, staff, vendor, labour)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon } from '../components/Ui';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await login(f.login.trim(), f.password); nav('/'); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-800 to-brand-600 text-white p-12">
        <div className="flex items-center gap-3"><img src="/favicon.svg" className="h-10 w-10" alt="" /><span className="text-2xl font-bold">Polyhouse OS</span></div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Every harvest, sale and rupee — in one place.</h1>
          <p className="mt-4 text-brand-100 text-lg">Record it once at the farm. See profit, cost per kg and who owes you — the same day.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {[['bi-basket', 'Harvest by crop & grade'], ['bi-truck', 'Sell to vendors at their price'], ['bi-wallet2', 'Every expense & wage'], ['bi-graph-up-arrow', 'Day / week / month P&L']].map(([i, t]) => (
              <div key={t} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2"><Icon name={i} /> {t}</div>
            ))}
          </div>
        </div>
        <div className="text-brand-200 text-sm">For polyhouses, open fields, FPOs and multi-location farms.</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden flex items-center gap-2 mb-6"><img src="/favicon.svg" className="h-10 w-10" alt="" /><span className="text-2xl font-bold">Polyhouse OS</span></div>
          <div><h2 className="text-2xl font-bold">Welcome back</h2><p className="text-slate-500 text-sm">Login with your phone number or user ID</p></div>
          <div><label className="label">Phone / User ID</label><input className="input" autoFocus autoCapitalize="none" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} required /></div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input className="input pr-11" type={show ? 'text' : 'password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500" onClick={() => setShow(!show)}><Icon name={show ? 'bi-eye-slash' : 'bi-eye'} /></button>
            </div>
          </div>
          {err && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
          <button className="btn-primary w-full !py-3 text-base" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
        </form>
      </div>
    </div>
  );
}
