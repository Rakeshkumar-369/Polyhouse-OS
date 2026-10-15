// Small reusable UI building blocks (cards, stat tiles, modal sheet, toast, badges ...)
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cls } from '../utils';

export const Icon = ({ name, className = '' }) => <i className={cls('bi', name, className)} aria-hidden="true" />;

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="h-title">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 no-print">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', pad = true }) {
  return (
    <section className={cls('card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          {title && <h2 className="font-semibold text-slate-800">{title}</h2>}
          {action}
        </div>
      )}
      <div className={pad ? 'px-4 pb-4' : ''}>{children}</div>
    </section>
  );
}

// KPI tile with comparison vs previous period
export function Stat({ label, value, sub, delta, good = 'up', icon, tone = 'slate', onClick }) {
  const tones = { slate: 'bg-slate-100 text-slate-600', green: 'bg-brand-100 text-brand-700', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700' };
  const positive = delta === null || delta === undefined ? null : good === 'up' ? delta >= 0 : delta <= 0;
  return (
    <div className={cls('card p-4 flex flex-col gap-1', onClick && 'cursor-pointer hover:border-brand-300')} onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {icon && <span className={cls('h-8 w-8 rounded-lg grid place-items-center', tones[tone])}><Icon name={icon} /></span>}
      </div>
      <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="flex items-center gap-2 text-xs">
        {delta !== null && delta !== undefined && (
          <span className={cls('font-semibold', positive ? 'text-brand-700' : 'text-red-600')}>
            <Icon name={delta >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'} /> {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const t = { slate: 'bg-slate-100 text-slate-700', green: 'bg-brand-100 text-brand-800', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-700' };
  return <span className={cls('inline-flex items-center self-start shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', t[tone])}>{children}</span>;
}

export const Spinner = ({ text = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-slate-500"><span className="h-5 w-5 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />{text}</div>
);

export const Empty = ({ icon = 'bi-inbox', text = 'Nothing here yet', children }) => (
  <div className="text-center py-10 text-slate-500"><Icon name={icon} className="text-4xl text-slate-300" /><p className="mt-2">{text}</p>{children}</div>
);

// Bottom sheet on phones, centred dialog on desktop
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className={cls('relative bg-white w-full rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button className="h-9 w-9 rounded-full hover:bg-slate-100" onClick={onClose} aria-label="Close"><Icon name="bi-x-lg" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  );
}

// Toast notifications: const toast = useToast(); toast('Saved')
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[60] top-3 inset-x-0 flex flex-col items-center gap-2 pointer-events-none px-3">
        {items.map((i) => (
          <div key={i.id} className={cls('pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg max-w-md', i.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white')}>
            <Icon name={i.tone === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'} className="mr-2" />{i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// Toggle switch (used for module on/off)
export function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={cls('relative h-7 w-12 rounded-full transition shrink-0', checked ? 'bg-brand-600' : 'bg-slate-300', disabled && 'opacity-50')}>
      <span className={cls('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

// Segmented chips to pick one value
export function Chips({ options, value, onChange, className = '' }) {
  return (
    <div className={cls('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o;
        return (
          <button type="button" key={v} className={value == v ? 'chip-on' : 'chip-off'} onClick={() => onChange(v)}>
            {typeof o === 'object' && o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />}{l}
          </button>
        );
      })}
    </div>
  );
}
