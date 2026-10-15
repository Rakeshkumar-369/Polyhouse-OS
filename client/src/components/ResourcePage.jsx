// Generic list + add/edit screen for any resource (route /m/:res).
// Columns, filters and form fields all come from server/src/resources.js via /api/meta.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { money, num, fdate, downloadCSV, cls } from '../utils';
import { Card, Empty, Icon, Modal, PageHeader, Spinner, Badge } from './Ui';
import { ResourceForm, useOptions } from './Form';
import PeriodPicker, { initialPeriod } from './PeriodPicker';

const MONEY = /amount|price|rate|cost|rent|wage|salary|gross|net_paid|bonus|deductions|principal|emi|outstanding|book_value|budget|balance/;
const SUMMABLE = /amount|quantity|culls|rejected_qty|net_paid|gross|cost|trap_count|water_litres/;

export function fmtCell(f, row) {
  const v = row[f.name];
  if (f.type === 'ref') return row[`${f.name}_label`] || '—';
  if (v === null || v === undefined || v === '') return '—';
  if (f.type === 'date') return fdate(v);
  if (f.type === 'bool') return v ? 'Yes' : 'No';
  if (f.type === 'file') return <Icon name="bi-paperclip" />;
  if (f.type === 'color') return <span className="inline-block h-4 w-4 rounded-full" style={{ background: v }} />;
  if (f.type === 'number') return MONEY.test(f.name) ? money(v) : num(v, 2);
  if (f.type === 'select') {
    const tone = { done: 'green', accepted: 'green', fulfilled: 'green', present: 'green', disputed: 'red', absent: 'red', high: 'red', open: 'amber', todo: 'amber', half: 'amber', medium: 'amber', cancelled: 'slate', closed: 'slate' }[v];
    return tone ? <Badge tone={tone}>{v}</Badge> : String(v).replace(/_/g, ' ');
  }
  return String(v);
}

function FilterSelect({ field, value, onChange }) {
  const opts = useOptions(field.ref, {}, field.type !== 'ref');
  const list = field.type === 'ref' ? opts.map((o) => [o.id, o.label]) : (field.options || []).map((o) => [o, o]);
  return (
    <select className="input !w-auto !py-2" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">All {field.label.replace(/\s*\(.*\)/, '').toLowerCase()}</option>
      {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export default function ResourcePage({ resKey, presetFilters, hideHeader, title }) {
  const params = useParams();
  const [sp] = useSearchParams();
  const key = resKey || params.res;
  const { meta } = useAuth();
  const def = meta?.resources?.[key];
  const [period, setPeriod] = useState(initialPeriod('last_30'));
  const [filters, setFilters] = useState({});
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null); // null | 'new' | row
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { setFilters(presetFilters || {}); setRows(null); if (sp.get('new')) setEdit('new'); }, [key]); // eslint-disable-line

  const load = useCallback(async () => {
    if (!def) return;
    const p = { ...filters, q, limit: 1000 };
    if (def.dateField && period.key !== 'all') { p.from = period.from; p.to = period.to; }
    setRows(await api.get(`/r/${key}`, p));
  }, [def, key, filters, q, period]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const cols = useMemo(() => (def ? def.fields.filter((f) => f.list) : []), [def]);
  const totals = useMemo(() => {
    if (!rows?.length) return null;
    const t = {};
    for (const f of cols) if (f.type === 'number' && SUMMABLE.test(f.name)) t[f.name] = rows.reduce((a, r) => a + Number(r[f.name] || 0), 0);
    return Object.keys(t).length ? t : null;
  }, [rows, cols]);

  if (!def) return <Empty icon="bi-lock" text="This screen is not available (module off or not allowed for your role)." />;
  const filterFields = def.filters.map((n) => def.fields.find((f) => f.name === n)).filter((f) => f && (f.type === 'ref' || f.type === 'select') && !(presetFilters && n in presetFilters));

  const exportCsv = () => downloadCSV(`${def.title} ${period.from || ''} ${period.to || ''}`, rows, def.fields.filter((f) => f.type !== 'file').map((f) => [f.type === 'ref' ? `${f.name}_label` : f.name, f.label]));

  return (
    <div>
      {!hideHeader && (
        <PageHeader title={title || def.title} subtitle={rows ? `${rows.length} entries` : ''}>
          {rows?.length > 0 && <button className="btn-outline" onClick={exportCsv}><Icon name="bi-download" /> <span className="hidden sm:inline">Excel/CSV</span></button>}
          {def.canWrite && <button className="btn-primary hidden sm:inline-flex" onClick={() => setEdit('new')}><Icon name="bi-plus-lg" /> Add</button>}
        </PageHeader>
      )}

      <div className="flex flex-wrap gap-2 mb-3 no-print">
        {def.dateField && <PeriodPicker value={period} onChange={setPeriod} showGroup={false} />}
        <div className="relative flex-1 min-w-[160px]">
          <Icon name="bi-search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !py-2 pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filterFields.length > 0 && (
          <button className="btn-outline md:hidden !py-2" onClick={() => setShowFilters(!showFilters)}>
            <Icon name="bi-funnel" /> {Object.values(filters).filter(Boolean).length || ''}
          </button>
        )}
        <div className={cls('w-full md:w-auto flex-wrap gap-2', showFilters ? 'flex' : 'hidden md:flex')}>
          {filterFields.map((f) => <FilterSelect key={f.name} field={f} value={filters[f.name]} onChange={(v) => setFilters((x) => ({ ...x, [f.name]: v }))} />)}
        </div>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Card><Empty text={`No ${def.title.toLowerCase()} yet`}>{def.canWrite && <button className="btn-primary mt-4" onClick={() => setEdit('new')}><Icon name="bi-plus-lg" /> Add first</button>}</Empty></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card pad={false} className="hidden md:block overflow-x-auto">
            <table className="tbl">
              <thead><tr>{cols.map((f) => <th key={f.name} className={f.type === 'number' ? 'num' : ''}>{f.label}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setEdit(r)}>
                    {cols.map((f) => <td key={f.name} className={f.type === 'number' ? 'num' : ''}>{fmtCell(f, r)}</td>)}
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot><tr className="font-semibold bg-slate-50">{cols.map((f, i) => <td key={f.name} className={cls('px-3 py-2', f.type === 'number' && 'num')}>{i === 0 ? 'Total' : totals[f.name] !== undefined ? (MONEY.test(f.name) ? money(totals[f.name]) : num(totals[f.name], 2)) : ''}</td>)}</tr></tfoot>
              )}
            </table>
          </Card>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {totals && (
              <div className="card px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm bg-brand-50 border-brand-200">
                <span className="font-semibold">Total</span>
                {Object.entries(totals).map(([k, v]) => <span key={k}>{cols.find((c) => c.name === k)?.label}: <b>{MONEY.test(k) ? money(v) : num(v, 2)}</b></span>)}
              </div>
            )}
            {rows.map((r) => (
              <button key={r.id} className="card w-full text-left px-4 py-3 active:bg-slate-50" onClick={() => setEdit(r)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold truncate">{fmtCell(cols[0], r)}</div>
                  {cols[1] && <div className="text-sm shrink-0">{fmtCell(cols[1], r)}</div>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-500">
                  {cols.slice(2).filter((f) => r[f.name] !== null && r[f.name] !== '' && r[f.name] !== undefined).map((f) => <span key={f.name}>{f.label.replace(/\s*\(.*\)/, '')}: <span className="text-slate-800">{fmtCell(f, r)}</span></span>)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {def.canWrite && (
        <button className="md:hidden fixed right-4 bottom-24 z-30 h-14 w-14 rounded-full bg-brand-700 text-white text-2xl shadow-lg no-print" onClick={() => setEdit('new')} aria-label="Add">
          <Icon name="bi-plus-lg" />
        </button>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? `Add - ${def.title}` : def.title} wide={def.fields.length > 8}>
        {edit && <ResourceForm def={def} row={edit === 'new' ? null : edit} presets={edit === 'new' ? presetFilters : undefined}
          onSaved={() => { setEdit(null); load(); }} onDeleted={() => { setEdit(null); load(); }} />}
      </Modal>
    </div>
  );
}
