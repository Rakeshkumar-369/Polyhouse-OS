// App shell: sidebar on desktop, top bar + bottom tab bar on phones
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { MAIN, GROUPS, visible, mobileTabs } from '../nav';
import { Icon } from './Ui';
import { cls } from '../utils';

function SideLink({ item }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => cls('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100')}>
      <Icon name={item.icon} className="text-base" /> {item.label}
    </NavLink>
  );
}

export default function Layout() {
  const { meta, role, logout } = useAuth();
  const loc = useLocation();
  const main = MAIN.filter((m) => visible(m, meta, role));
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, meta, role)) })).filter((g) => g.items.length);
  const tabs = mobileTabs(meta, role);
  const impersonating = !!localStorage.getItem('pos_super_token');

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200 bg-white no-print">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2"><img src="/favicon.svg" className="h-8 w-8" alt="" /><span className="font-bold text-lg">Polyhouse OS</span></div>
          <div className="text-xs text-slate-500 mt-1 truncate">{meta.org?.name}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {main.map((m) => <SideLink key={m.to} item={m} />)}
          {groups.map((g) => (
            <div key={g.title} className="pt-3">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.title}</div>
              {g.items.map((i) => <SideLink key={i.to} item={i} />)}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-800 grid place-items-center font-bold">{meta.user.name[0]}</div>
          <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{meta.user.name}</div><div className="text-xs text-slate-500 capitalize">{role}</div></div>
          <button className="h-9 w-9 rounded-lg hover:bg-slate-100" title="Logout" onClick={logout}><Icon name="bi-box-arrow-right" /></button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-2 no-print">
        <img src="/favicon.svg" className="h-7 w-7" alt="" />
        <div className="flex-1 min-w-0"><div className="font-bold leading-tight truncate">{meta.org?.name}</div><div className="text-[11px] text-slate-500 capitalize">{meta.user.name} · {role}</div></div>
        {visible({ to: '/alerts', roles: ['admin', 'manager', 'supervisor'], module: 'alerts' }, meta, role) && <NavLink to="/alerts" className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100"><Icon name="bi-bell" className="text-lg" /></NavLink>}
      </header>

      {impersonating && (
        <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 flex items-center justify-between no-print">
          <span><Icon name="bi-incognito" /> Super admin viewing as {meta.org?.name}</span>
          <button className="font-semibold underline" onClick={() => { localStorage.setItem('pos_token', localStorage.getItem('pos_super_token')); localStorage.removeItem('pos_super_token'); window.location.href = '/super'; }}>Back to super admin</button>
        </div>
      )}

      <main key={loc.pathname} className="max-w-7xl mx-auto px-4 py-4 lg:px-8 lg:py-6 pb-28 lg:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 safe-bottom no-print">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0,1fr))` }}>
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => cls('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}>
              <Icon name={t.icon} className="text-xl" />{t.label}
            </NavLink>
          ))}
          <NavLink to="/more" className={({ isActive }) => cls('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}>
            <Icon name="bi-grid" className="text-xl" />More
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

// "More" screen on phones: every menu entry as big tappable tiles
export function MorePage() {
  const { meta, role, logout } = useAuth();
  const main = MAIN.filter((m) => visible(m, meta, role));
  const groups = [{ title: 'Main', items: main }, ...GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, meta, role)) }))].filter((g) => g.items.length);
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{g.title}</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} className="card flex flex-col items-center justify-center gap-1.5 py-4 px-2 text-center active:bg-slate-50">
                <Icon name={i.icon} className="text-2xl text-brand-700" /><span className="text-xs font-medium leading-tight">{i.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-outline w-full" onClick={logout}><Icon name="bi-box-arrow-right" /> Logout</button>
    </div>
  );
}
