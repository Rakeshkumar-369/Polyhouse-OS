// Reusable UI pieces: Card, Stat tile, Badge, Modal (bottom sheet on phones), Toast, Toggle, Chips, Tabs, Empty, Skeleton
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Icon from './Icon';
import { cls } from '../lib/format';
import { t } from '../lib/i18n';

export { Icon };

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 no-print">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', pad = true, sub }) {
  return (
    <section className={cls('card', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
          <div className="min-w-0">{title && <h2 className="font-semibold text-slate-800">{title}</h2>}{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
          {action}
        </div>
      )}
      <div className={pad ? 'px-4 pb-4' : 'pb-1'}>{children}</div>
    </section>
  );
}

const TONES = { slate: 'bg-slate-100 text-slate-600', green: 'bg-brand-50 text-brand-700', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600' };

// KPI tile: value, change vs previous period, optional sparkline / footnote
export function Stat({ label, value, sub, delta, good = 'up', icon, tone = 'slate', spark, onClick }) {
  const positive = delta === null || delta === undefined ? null : good === 'up' ? delta >= 0 : delta <= 0;
  return (
    <div className={cls('card p-4 flex flex-col gap-1 min-w-0', onClick && 'cursor-pointer hover:border-brand-300 transition')} onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</span>
        {icon && <span className={cls('h-8 w-8 rounded-xl grid place-items-center shrink-0', TONES[tone])}><Icon name={icon} /></span>}
      </div>
      <div className="text-[22px] sm:text-2xl font-bold tabular-nums text-slate-900 truncate">{value}</div>
      <div className="flex items-center gap-2 text-xs min-h-[16px]">
        {delta !== null && delta !== undefined && (
          <span className={cls('font-semibold inline-flex items-center gap-0.5', positive ? 'text-brand-700' : 'text-red-600')}>
            <Icon name={delta >= 0 ? 'arrow-up-right' : 'arrow-down-right'} />{Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="text-slate-500 truncate">{sub}</span>}
      </div>
      {spark}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }) {
  return <span className={cls('inline-flex items-center self-start shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', TONES[tone])}>{children}</span>;
}

export function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 animate-pulse" aria-label={t('Loading…')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-200/70" />)}</div>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-slate-200/60" />)}
    </div>
  );
}

export const Spinner = ({ text }) => (
  <div className="flex items-center justify-center gap-3 py-12 text-slate-500"><span className="h-5 w-5 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />{text || t('Loading…')}</div>
);

export const Empty = ({ icon = 'inbox', text, children }) => (
  <div className="text-center py-8 text-slate-500"><Icon name={icon} className="text-3xl text-slate-300" /><p className="mt-2 text-sm">{text || t('Nothing here yet')}</p>{children}</div>
);

export const ErrorBox = ({ text, onRetry }) => (
  <div className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm flex items-center justify-between gap-3">
    <span><Icon name="exclamation-circle" /> {text}</span>{onRetry && <button className="font-semibold underline" onClick={onRetry}>Retry</button>}
  </div>
);

// Bottom sheet on phones, centred dialog on desktop
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] fade-in" onClick={onClose} />
      <div className={cls('relative bg-white w-full rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl sheet-in', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-100">
          <h3 className="font-semibold text-lg truncate">{title}</h3>
          <button className="h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center" onClick={onClose} aria-label={t('Close')}><Icon name="x-lg" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[60] top-3 inset-x-0 flex flex-col items-center gap-2 pointer-events-none px-3" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={cls('pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg max-w-md fade-in', i.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white')}>
            <Icon name={i.tone === 'error' ? 'exclamation-circle' : 'check-circle'} className="mr-2" />{i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cls('relative h-7 w-12 rounded-full transition shrink-0', checked ? 'bg-brand-600' : 'bg-slate-300', disabled && 'opacity-50')}>
      <span className={cls('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

// Pick one value from big tappable chips
export function Chips({ options, value, onChange, className = '' }) {
  return (
    <div className={cls('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o;
        return (
          <button type="button" key={v} className={String(value) === String(v) ? 'chip-on' : 'chip-off'} onClick={() => onChange(v)}>
            {typeof o === 'object' && o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />}{t(l)}
          </button>
        );
      })}
    </div>
  );
}

// Horizontal scrolling tab chips
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-print -mx-4 px-4 pb-1 scrollbar-none">
      {tabs.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={cls(k === value ? 'chip-on' : 'chip-off', 'whitespace-nowrap')}>{t(l)}</button>)}
    </div>
  );
}

export function Progress({ value, tone = 'green' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const c = { green: 'bg-brand-600', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-600' }[tone];
  return <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={cls('h-2 rounded-full', c)} style={{ width: v + '%' }} /></div>;
}
