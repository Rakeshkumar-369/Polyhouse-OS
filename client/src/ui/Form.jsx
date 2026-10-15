// Form fields generated from the server's resource definitions (server/src/resources.js)
import { useState } from 'react';
import { api, useApi } from '../lib/api';
import { todayISO } from '../lib/format';
import { t } from '../lib/i18n';
import { Icon, useToast } from './kit';

// Dropdown options for a resource, e.g. useOptions('farms') -> [{id,label}]   (cached; refreshed after any save)
export function useOptions(res, params = {}, skip = false) {
  const { data } = useApi(skip || !res ? null : `/r/${res}/options`, params);
  return data || [];
}

const prettify = (o) => t(String(o)).replace(/_/g, ' ');

export function FieldInput({ field: f, value, onChange, form = {} }) {
  const params = f.dependsOn && form[f.dependsOn] ? { [f.dependsOn]: form[f.dependsOn] } : {};
  const opts = useOptions(f.ref, params, f.type !== 'ref');
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const v = value ?? '';
  const common = { className: 'input', disabled: f.readonly, value: v, onChange: (e) => onChange(e.target.value), required: f.required, 'aria-label': t(f.label) };

  switch (f.type) {
    case 'textarea': return <textarea rows={3} {...common} />;
    case 'number': return <input type="number" step="any" inputMode="decimal" {...common} />;
    case 'date': return <input type="date" {...common} />;
    case 'time': return <input type="time" {...common} />;
    case 'color': return <input type="color" className="h-11 w-20 rounded-xl border border-slate-300 bg-white" value={v || '#16a34a'} onChange={(e) => onChange(e.target.value)} />;
    case 'bool': return (
      <label className="flex items-center gap-2 py-2"><input type="checkbox" className="h-5 w-5 accent-green-700" checked={v === 1 || v === true || v === '1'} onChange={(e) => onChange(e.target.checked ? 1 : 0)} /> <span className="text-sm">{t('Yes')}</span></label>
    );
    case 'select': return <select {...common}><option value="">—</option>{f.options.map((o) => <option key={o} value={o}>{prettify(o)}</option>)}</select>;
    case 'ref': return <select {...common}><option value="">—</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>;
    case 'file': return (
      <div className="flex items-center gap-2">
        <label className="btn-outline cursor-pointer">
          <Icon name={busy ? 'hourglass-split' : 'camera'} /> {v ? 'Replace' : 'Photo / PDF'}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
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

// Add / edit / delete form for any resource
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
      toast(t(row ? 'Updated' : 'Saved')); onSaved?.(saved);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    setBusy(true);
    try { await api.del(`/r/${def.key}/${row.id}`); toast(t('Deleted')); onDeleted?.(); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const fields = def.fields.filter((f) => !((f.virtual || f.readonly) && !row));
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {fields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="label">{t(f.label)}{f.required && <span className="text-red-500"> *</span>}</label>
            <FieldInput field={f} value={form[f.name]} onChange={(v) => set(f.name, v)} form={form} />
            {f.help && <p className="text-xs text-slate-400 mt-1">{f.help}</p>}
          </div>
        ))}
      </div>
      {err && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2"><Icon name="exclamation-triangle-fill" /> {err}</div>}
      {def.canWrite && (
        <div className="flex gap-2 pt-1 sticky bottom-0 bg-white pb-1">
          <button className="btn-primary flex-1 !py-3" disabled={busy}><Icon name="check2" /> {t(row ? 'Save changes' : 'Save')}</button>
          {row && <button type="button" className="btn-danger" onClick={remove} disabled={busy} aria-label={t('Delete')}><Icon name="trash" /></button>}
        </div>
      )}
    </form>
  );
}
