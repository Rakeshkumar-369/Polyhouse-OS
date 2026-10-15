// Single login screen for every role. Demo accounts appear as one-tap buttons when DEMO_MODE=true on the server.
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/api';
import { Link, navigate } from '../../lib/router';
import { t } from '../../lib/i18n';
import { Icon } from '../../ui/kit';
import LangSwitch from '../../ui/LangSwitch';

export default function Login() {
  const { login } = useAuth();
  const [f, setF] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const { data: demos } = useApi('/public/demo-accounts');

  const go = async (l, p) => {
    setBusy(true); setErr('');
    try { await login(l.trim(), p); navigate('/'); } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white p-12">
        <Link to="/" className="flex items-center gap-3"><img src="/favicon.svg" className="h-10 w-10" alt="" /><span className="text-2xl font-bold">Polyhouse OS</span></Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Every harvest, sale and rupee — in one place.</h1>
          <p className="mt-4 text-brand-100 text-lg">Record it once at the farm. See profit, cost per kg and who owes you — the same day.</p>
        </div>
        <div className="text-brand-200 text-sm">Polyhouses · Open fields · FPOs · Multi-location farms</div>
      </div>
      <div className="flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="lg:hidden flex items-center gap-2"><img src="/favicon.svg" className="h-9 w-9" alt="" /><span className="text-xl font-bold">Polyhouse OS</span></Link>
            <LangSwitch className="ml-auto" />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); go(f.login, f.password); }} className="space-y-4">
            <div><h2 className="text-2xl font-bold">{t('Welcome back')}</h2><p className="text-slate-500 text-sm">{t('Login with your phone number or user ID')}</p></div>
            <div><label className="label" htmlFor="lg">{t('Phone / User ID')}</label><input id="lg" className="input" autoComplete="username" autoCapitalize="none" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} required /></div>
            <div>
              <label className="label" htmlFor="pw">{t('Password')}</label>
              <div className="relative">
                <input id="pw" className="input pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500" onClick={() => setShow(!show)} aria-label="Show password"><Icon name={show ? 'eye-slash' : 'eye'} /></button>
              </div>
            </div>
            {err && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
            <button className="btn-primary w-full !py-3 text-base" disabled={busy}>{busy ? t('Logging in…') : t('Login')}</button>
          </form>
          {demos?.length > 0 && (
            <div className="mt-8">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t('Try a demo account')}</div>
              <div className="grid grid-cols-2 gap-2">
                {demos.map((d) => (
                  <button key={d.login} disabled={busy} onClick={() => go(d.login, d.password)} className="card text-left px-3 py-2.5 hover:border-brand-400 transition">
                    <div className="text-xs font-semibold text-brand-700">{d.role}</div><div className="text-sm font-medium truncate">{d.name}</div><div className="text-[11px] text-slate-500 truncate">{d.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
