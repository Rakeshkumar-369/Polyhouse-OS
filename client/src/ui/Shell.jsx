// App shell for farm staff: sidebar on desktop, top bar + bottom tab bar on phones, "More" screen
import { useAuth } from '../lib/auth';
import { NavLink } from '../lib/router';
import { MAIN, GROUPS, visible, mobileTabs } from '../lib/nav';
import { t, useLang } from '../lib/i18n';
import { cls } from '../lib/format';
import { Icon } from './kit';
import LangSwitch from './LangSwitch';

export { LangSwitch };

function SideLink({ item }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} className={(a) => cls('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', a ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>
      <Icon name={item.icon} className="text-base" /> {t(item.label)}
    </NavLink>
  );
}

export default function Shell({ children }) {
  const { meta, role, logout } = useAuth();
  useLang();
  const main = MAIN.filter((m) => visible(m, meta, role));
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, meta, role)) })).filter((g) => g.items.length);
  const tabs = mobileTabs(meta, role);
  const impersonating = !!localStorage.getItem('pos_super_token');
  const showBell = visible({ to: '/alerts', roles: ['admin', 'manager', 'supervisor'], module: 'alerts' }, meta, role);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200/80 bg-white no-print">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2"><img src="/favicon.svg" className="h-8 w-8" alt="" /><span className="font-bold text-lg tracking-tight">Polyhouse OS</span></div>
          <div className="text-xs text-slate-500 mt-1 truncate">{meta.org?.name}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {main.map((m) => <SideLink key={m.to} item={m} />)}
          {groups.map((g) => (
            <div key={g.title} className="pt-3">
              <div className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{t(g.title)}</div>
              {g.items.map((i) => <SideLink key={i.to} item={i} />)}
            </div>
          ))}
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

      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200/80 px-4 py-2.5 flex items-center gap-2 no-print">
        <img src="/favicon.svg" className="h-8 w-8" alt="" />
        <div className="flex-1 min-w-0"><div className="font-bold leading-tight truncate">{meta.org?.name}</div><div className="text-[11px] text-slate-500 capitalize truncate">{meta.user.name} · {role}</div></div>
        <LangSwitch className="!px-2.5" />
        {showBell && <NavLink to="/alerts" className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100" aria-label={t('Alerts')}><Icon name="bell" className="text-lg" /></NavLink>}
      </header>

      {impersonating && (
        <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 flex items-center justify-between gap-2 no-print">
          <span><Icon name="incognito" /> Viewing as {meta.org?.name}</span>
          <button className="font-semibold underline" onClick={() => { localStorage.setItem('pos_token', localStorage.getItem('pos_super_token')); localStorage.removeItem('pos_super_token'); window.location.href = '/'; }}>Back to super admin</button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-4 lg:px-8 lg:py-6 pb-28 lg:pb-10 fade-in">{children}</main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 safe-bottom no-print">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0,1fr))` }}>
          {[...tabs, { to: '/more', label: 'More', icon: 'grid' }].map((tb) => (
            <NavLink key={tb.to} to={tb.to} end={tb.to === '/'} className={(a) => cls('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', a ? 'text-brand-700' : 'text-slate-500')}>
              <Icon name={tb.icon} className="text-[22px]" />{t(tb.label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function MorePage() {
  const { meta, role, logout } = useAuth();
  useLang();
  const main = MAIN.filter((m) => visible(m, meta, role));
  const groups = [{ title: 'Main', items: main }, ...GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, meta, role)) }))].filter((g) => g.items.length);
  return (
    <div className="space-y-5">
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
      <button className="btn-outline w-full" onClick={logout}><Icon name="box-arrow-right" /> {t('Logout')}</button>
    </div>
  );
}
