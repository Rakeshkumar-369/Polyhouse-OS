// Form fields generated from the server's resource definitions (server/src/resources.js)
import { useEffect, useState } from 'react';
import { api } from '../api';
import { todayISO } from '../utils';
import { Icon, useToast } from './Ui';

// ---- dropdown options with a small cache ----
const cache = new Map();
export const bustOptions = (res) => { for (const k of cache.keys()) if (k.startsWith(`/r/${res}/`)) cache.delete(k); };

export function useOptions(res, params = {}, skip = false) {
  const url = `/r/${res}/options?` + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const [opts, setOpts] = useState(cache.get(url) || []);
  useEffect(() => {
    if (skip || !res) return;
    let live = true;
    const p = cache.get(url) ? Promise.resolve(cache.get(url)) : api.get(url.split('?')[0], Object.fromEntries(new URLSearchParams(url.split('?')[1])));
    p.then((o) => { cache.set(url, o); if (live) setOpts(o); }).catch(() => {});
    return () => { live = false; };
  }, [url, skip, res]);
  return opts;
}

export function FieldInput({ field: f, value, onChange, form = {} }) {
  const params = f.dependsOn && form[f.dependsOn] ? { [f.dependsOn]: form[f.dependsOn] } : {};
  const opts = useOptions(f.ref, params, f.type !== 'ref');
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const v = value ?? '';
  const common = { className: 'input', disabled: f.readonly, value: v, onChange: (e) => onChange(e.target.value), required: f.required };

  switch (f.type) {
    case 'textarea': return <textarea rows={3} {...common} />;
    case 'number': return <input type="number" step="any" inputMode="decimal" {...common} />;
    case 'date': return <input type="date" {...common} />;
    case 'time': return <input type="time" {...common} />;
    case 'color': return <input type="color" className="h-11 w-20 rounded-xl border border-slate-300" value={v || '#16a34a'} onChange={(e) => onChange(e.target.value)} />;
    case 'bool': return (
      <label className="flex items-center gap-2 py-2"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={v === 1 || v === true || v === '1'} onChange={(e) => onChange(e.target.checked ? 1 : 0)} /> <span className="text-sm">Yes</span></label>
    );
    case 'select': return (
      <select {...common}><option value="">— select —</option>{f.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}</select>
    );
    case 'ref': return (
      <select {...common}><option value="">— select —</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
    );
    case 'file': return (
      <div className="flex items-center gap-2">
        <label className="btn-outline cursor-pointer">
          <Icon name={busy ? 'bi-hourglass-split' : 'bi-camera'} /> {v ? 'Replace' : 'Photo / PDF'}
          <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={async (e) => {
            const file = e.target.files[0]; if (!file) return;
            setBusy(true);
            try { onChange((await api.upload(file)).path); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
          }} />
        </label>
        {v && <a className="text-sm text-brand-700 underline truncate" href={api.fileUrl(v)} target="_blank" rel="noreferrer">View file</a>}
      </div>
    );
    default: return <input type="text" {...common} />;
  }
}

export function initialValues(def, row) {
  const o = {};
  for (const f of def.fields) {
    if (row && row[f.name] !== undefined) o[f.name] = row[f.name] ?? '';
    else if (!row && f.default !== undefined) o[f.name] = f.default === 'today' ? todayISO() : f.default;
    else o[f.name] = '';
  }
  return o;
}

// Add / edit form for any resource
export function ResourceForm({ def, row, onSaved, onDeleted, presets }) {
  const [form, setForm] = useState(() => ({ ...initialValues(def, row), ...(presets || {}) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();
  const set = (k, v) => setForm((f) => {
    const n = { ...f, [k]: v };
    for (const x of def.fields) if (x.dependsOn === k) n[x.name] = '';
    return n;
  });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = Object.fromEntries(def.fields.filter((f) => !f.readonly && !f.virtual).map((f) => [f.name, form[f.name]]));
      const saved = row ? await api.put(`/r/${def.key}/${row.id}`, body) : await api.post(`/r/${def.key}`, body);
      bustOptions(def.key); toast(row ? 'Updated' : 'Saved'); onSaved?.(saved);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setBusy(true);
    try { await api.del(`/r/${def.key}/${row.id}`); bustOptions(def.key); toast('Deleted'); onDeleted?.(); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {def.fields.filter((f) => !(f.virtual && !row) && !(f.readonly && !row)).map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="label">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
            <FieldInput field={f} value={form[f.name]} onChange={(v) => set(f.name, v)} form={form} />
            {f.help && <p className="text-xs text-slate-400 mt-1">{f.help}</p>}
          </div>
        ))}
      </div>
      {err && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2"><Icon name="bi-exclamation-triangle" /> {err}</div>}
      {def.canWrite && (
        <div className="flex gap-2 pt-1">
          <button className="btn-primary flex-1" disabled={busy}><Icon name="bi-check2" /> {row ? 'Save changes' : 'Save'}</button>
          {row && <button type="button" className="btn-danger" onClick={remove} disabled={busy}><Icon name="bi-trash" /></button>}
        </div>
      )}
    </form>
  );
}
