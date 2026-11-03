// App shell for farm staff.
//   Desktop: sidebar (main links + collapsible groups) and a "+ New" button.
//   Phone:   top bar (back button on inner screens), bottom tabs with a centre "+" for quick entries, "More" screen with search.
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { NavLink, navigate, useLocation } from '../lib/router';
import { MAIN, GROUPS, QUICK, visible, mobileTabs } from '../lib/nav';
import { t, useLang } from '../lib/i18n';
import { cls } from '../lib/format';
import { Icon, Modal } from './kit';
import LangSwitch from './LangSwitch';

export { LangSwitch };

function SideLink({ item }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} className={(a) => cls('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', a ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>
      <Icon name={item.icon} className="text-base" /> {t(item.label)}
    </NavLink>
  );
}

// Groups fold away so the menu stays short; the group holding the open screen is always unfolded
function SideGroup({ g, pathname }) {
  const key = 'pos_nav_' + g.title;
  const has = g.items.some((i) => pathname.startsWith(i.to.split('?')[0]));
  const [open, setOpen] = useState(() => has || localStorage.getItem(key) === '1');
  useEffect(() => { if (has) setOpen(true); }, [has]);
  const toggle = () => { localStorage.setItem(key, open ? '0' : '1'); setOpen(!open); };
  return (
    <div className="pt-2">
      <button onClick={toggle} className="w-full flex items-center justify-between px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600" aria-expanded={open}>
        {t(g.title)} <Icon name={open ? 'chevron-down' : 'chevron-right'} />
      </button>
      {open && g.items.map((i) => <SideLink key={i.to} item={i} />)}
    </div>
  );
}

// One "+" for every daily entry
export function QuickAdd({ open, onClose }) {
  const { meta, role } = useAuth();
  const items = QUICK.filter((i) => visible(i, meta, role));
  const go = (to) => { onClose(); navigate(to); };
  return (
    <Modal open={open} onClose={onClose} title={t('Quick entry')}>
      <div className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <button key={i.to} onClick={() => go(i.to)} className="card flex flex-col items-center gap-1.5 py-4 px-1 text-center hover:border-brand-400 active:bg-slate-50">
            <span className="h-11 w-11 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center text-xl"><Icon name={i.icon} /></span>
            <span className="text-xs font-semibold leading-tight">{t(i.label)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true); const down = () => setOn(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}

export default function Shell({ children }) {
  const { meta, role, logout } = useAuth();
  const { pathname } = useLocation();
  useLang();
  const online = useOnline();
  const [quick, setQuick] = useState(false);
  const main = MAIN.filter((m) => visible(m, meta, role));
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, meta, role)) })).filter((g) => g.items.length);
  const tabs = mobileTabs(meta, role);
  const isTabRoot = pathname === '/more' || tabs.some((tb) => tb.to === pathname);
  const impersonating = !!localStorage.getItem('pos_super_token');
  const showBell = visible({ to: '/alerts', roles: ['admin', 'manager', 'supervisor'], module: 'alerts' }, meta, role);
  const back = () => (window.history.length > 1 ? window.history.back() : navigate('/more'));
  const bottom = [...tabs.slice(0, 2), { to: '#quick' }, ...tabs.slice(2, 3), { to: '/more', label: 'More', icon: 'grid' }];

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200/80 bg-white no-print">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2"><img src="/favicon.svg" className="h-8 w-8" alt="" /><span className="font-bold text-lg tracking-tight">Polyhouse OS</span></div>
          <div className="text-xs text-slate-500 mt-1 truncate">{meta.org?.name}</div>
          <button className="btn-primary w-full mt-3 !py-2" onClick={() => setQuick(true)}><Icon name="plus-lg" /> {t('New entry')}</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {main.map((m) => <SideLink key={m.to} item={m} />)}
          {groups.map((g) => <SideGroup key={g.title} g={g} pathname={pathname} />)}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-2">
          <LangSwitch />
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-800 grid place-items-center font-bold">{meta.user.name[0]}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{meta.user.name}</div><div className="text-xs text-slate-500 capitalize">{role}</div></div>
            <button className="h-9 w-9 rounded-lg hover:bg-slate-100 grid place-items-center" title={t('Logout')} onClick={logout}><Icon name="box-arrow-right" /></button>
          </div>
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200/80 px-3 py-2.5 flex items-center gap-2 no-print">
        {isTabRoot
          ? <img src="/favicon.svg" className="h-8 w-8 ml-1" alt="" />
          : <button onClick={back} className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100" aria-label={t('Back')}><Icon name="chevron-left" className="text-xl" /></button>}
        <div className="flex-1 min-w-0"><div className="font-bold leading-tight truncate">{meta.org?.name}</div><div className="text-[11px] text-slate-500 capitalize truncate">{meta.user.name} · {role}</div></div>
        <LangSwitch className="!px-2.5" />
        {showBell && <NavLink to="/alerts" className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100" aria-label={t('Alerts')}><Icon name="bell" className="text-lg" /></NavLink>}
      </header>

      {!online && <div className="bg-slate-800 text-white text-sm px-4 py-2 text-center no-print"><Icon name="cloud-check" /> You are offline — screens you opened before still show; saving needs internet.</div>}
      {impersonating && (
        <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 flex items-center justify-between gap-2 no-print">
          <span><Icon name="incognito" /> Viewing as {meta.org?.name}</span>
          <button className="font-semibold underline" onClick={() => { localStorage.setItem('pos_token', localStorage.getItem('pos_super_token')); localStorage.removeItem('pos_super_token'); window.location.href = '/'; }}>Back to super admin</button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-4 lg:px-8 lg:py-6 pb-28 lg:pb-10 fade-in">{children}</main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 safe-bottom no-print">
        <div className="grid items-end" style={{ gridTemplateColumns: `repeat(${bottom.length}, minmax(0,1fr))` }}>
          {bottom.map((tb) => (tb.to === '#quick' ? (
            <button key="quick" onClick={() => setQuick(true)} className="flex flex-col items-center pb-2" aria-label={t('New entry')}>
              <span className="-mt-5 h-14 w-14 rounded-full bg-brand-700 text-white grid place-items-center text-2xl shadow-lg ring-4 ring-white"><Icon name="plus-lg" /></span>
            </button>
          ) : (
            <NavLink key={tb.to} to={tb.to} end={tb.to === '/'} className={(a) => cls('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', a ? 'text-brand-700' : 'text-slate-500')}>
              <Icon name={tb.icon} className="text-[22px]" />{t(tb.label)}
            </NavLink>
          )))}
        </div>
      </nav>
      <QuickAdd open={quick} onClose={() => setQuick(false)} />
    </div>
  );
}

export function MorePage() {
  const { meta, role, logout } = useAuth();
  const [q, setQ] = useState('');
  useLang();
  const main = MAIN.filter((m) => visible(m, meta, role));
  const match = (i) => !q || t(i.label).toLowerCase().includes(q.toLowerCase()) || i.label.toLowerCase().includes(q.toLowerCase());
  const groups = [{ title: 'Main', items: main }, ...GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, meta, role)) }))]
    .map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length);
  return (
    <div className="space-y-5">
      <div className="relative">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder={t('Find a screen…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {groups.map((g) => (
        <div key={g.title}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t(g.title)}</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} className="card flex flex-col items-center justify-center gap-1.5 py-4 px-2 text-center active:bg-slate-50">
                <Icon name={i.icon} className="text-2xl text-brand-700" /><span className="text-xs font-medium leading-tight">{t(i.label)}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && <p className="text-center text-sm text-slate-500 py-6">No screen matches “{q}”.</p>}
      <button className="btn-outline w-full" onClick={logout}><Icon name="box-arrow-right" /> {t('Logout')}</button>
    </div>
  );
}
