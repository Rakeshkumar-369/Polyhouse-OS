// Generic list + add/edit screen for any resource (route /m/:res).
// Columns, filters and form fields all come from server/src/resources.js via /api/meta.
import { useMemo, useState } from 'react';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLocation } from '../lib/router';
import { money, num, fdate, downloadCSV, cls, initialPeriod } from '../lib/format';
import { t } from '../lib/i18n';
import { Card, Empty, Icon, Modal, PageHeader, Spinner, Badge, ErrorBox } from './kit';
import { ResourceForm, useOptions } from './Form';
import PeriodPicker from './PeriodPicker';

const MONEY = /amount|price|rate|cost|rent|wage|salary|gross|net_paid|bonus|deductions|principal|emi|outstanding|book_value|budget|balance/;
const SUMMABLE = /amount|quantity|culls|rejected_qty|net_paid|gross|cost|trap_count|water_litres/;
const TONE = { done: 'green', accepted: 'green', fulfilled: 'green', present: 'green', disputed: 'red', absent: 'red', high: 'red', open: 'amber', todo: 'amber', half: 'amber', medium: 'amber', cancelled: 'slate', closed: 'slate', harvesting: 'green', growing: 'blue', planned: 'slate' };
const clean = (l) => t(l).replace(/\s*\(.*\)/, '');

export function fmtCell(f, row, cur) {
  const v = row[f.name];
  if (f.type === 'ref') return row[`${f.name}_label`] || '—';
  if (v === null || v === undefined || v === '') return '—';
  if (f.type === 'date') return fdate(v);
  if (f.type === 'bool') return v ? t('Yes') : t('No');
  if (f.type === 'file') return <Icon name="paperclip" />;
  if (f.type === 'color') return <span className="inline-block h-4 w-4 rounded-full align-middle" style={{ background: v }} />;
  if (f.type === 'number') return MONEY.test(f.name) ? money(v, cur) : num(v, 2);
  if (f.type === 'select') return TONE[v] ? <Badge tone={TONE[v]}>{t(v)}</Badge> : t(String(v)).replace(/_/g, ' ');
  return String(v);
}

function FilterSelect({ field, value, onChange }) {
  const opts = useOptions(field.ref, {}, field.type !== 'ref');
  const list = field.type === 'ref' ? opts.map((o) => [o.id, o.label]) : (field.options || []).map((o) => [o, t(o)]);
  return (
    <select className="input !w-auto !py-2 max-w-[200px]" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={clean(field.label)}>
      <option value="">{clean(field.label)}: all</option>
      {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export default function ResourcePage({ resKey, presetFilters, hideHeader, title }) {
  const { query } = useLocation();
  const { meta, cur } = useAuth();
  const def = meta?.resources?.[resKey];
  const [period, setPeriod] = useState(initialPeriod('last_30'));
  const [filters, setFilters] = useState(presetFilters || {});
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(query.get('new') ? 'new' : null);
  const [showFilters, setShowFilters] = useState(false);

  const params = { ...filters, q, limit: 1000, ...(def?.dateField ? { from: period.from, to: period.to } : {}) };
  const { data: rows, error, reload } = useApi(def ? `/r/${resKey}` : null, params);
  const cols = useMemo(() => (def ? def.fields.filter((f) => f.list) : []), [def]);
  const totals = useMemo(() => {
    if (!rows?.length) return null;
    const out = {};
    for (const f of cols) if (f.type === 'number' && SUMMABLE.test(f.name)) out[f.name] = rows.reduce((a, r) => a + Number(r[f.name] || 0), 0);
    return Object.keys(out).length ? out : null;
  }, [rows, cols]);

  if (!def) return <Empty icon="lock" text="This screen is off or not allowed for your role." />;
  const filterFields = def.filters.map((n) => def.fields.find((f) => f.name === n)).filter((f) => f && (f.type === 'ref' || f.type === 'select') && !(presetFilters && n in presetFilters));
  const activeFilters = Object.values(filters).filter(Boolean).length - Object.keys(presetFilters || {}).length;
  const exportCsv = () => downloadCSV(`${def.title} ${def.dateField ? period.from + ' ' + period.to : ''}`, rows, def.fields.filter((f) => f.type !== 'file').map((f) => [f.type === 'ref' ? `${f.name}_label` : f.name, f.label]));

  return (
    <div>
      {!hideHeader && (
        <PageHeader title={t(title || def.title)} subtitle={rows ? `${rows.length} ${t('entries')}` : ''}>
          {rows?.length > 0 && <button className="btn-outline" onClick={exportCsv} title="Download for Excel"><Icon name="download" /> <span className="hidden sm:inline">Excel</span></button>}
          {def.canWrite && <button className="btn-primary hidden sm:inline-flex" onClick={() => setEdit('new')}><Icon name="plus-lg" /> {t('Add')}</button>}
        </PageHeader>
      )}

      <div className="flex flex-wrap gap-2 mb-3 no-print">
        {def.dateField && <PeriodPicker value={period} onChange={setPeriod} showGroup={false} />}
        <div className="relative flex-1 min-w-[150px]">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !py-2 pl-9" placeholder={t('Search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filterFields.length > 0 && (
          <button className="btn-outline md:hidden !py-2" onClick={() => setShowFilters(!showFilters)} aria-label={t('Filters')}>
            <Icon name="funnel" />{activeFilters > 0 && <span className="text-brand-700">{activeFilters}</span>}
          </button>
        )}
        <div className={cls('w-full md:w-auto flex-wrap gap-2', showFilters ? 'flex' : 'hidden md:flex')}>
          {filterFields.map((f) => <FilterSelect key={f.name} field={f} value={filters[f.name]} onChange={(v) => setFilters((x) => ({ ...x, [f.name]: v }))} />)}
        </div>
      </div>

      {error && <ErrorBox text={error} onRetry={reload} />}
      {!rows ? (!error && <Spinner />) : rows.length === 0 ? (
        <Card><Empty text={t('No entries yet')}>{def.canWrite && <button className="btn-primary mt-4" onClick={() => setEdit('new')}><Icon name="plus-lg" /> {t('Add first')}</button>}</Empty></Card>
      ) : (
        <>
          <Card pad={false} className="hidden md:block overflow-x-auto">
            <table className="tbl">
              <thead><tr>{cols.map((f) => <th key={f.name} className={f.type === 'number' ? 'num' : ''}>{clean(f.label)}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setEdit(r)}>
                    {cols.map((f) => <td key={f.name} className={f.type === 'number' ? 'num' : ''}>{fmtCell(f, r, cur)}</td>)}
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot><tr className="font-semibold bg-slate-50">{cols.map((f, i) => <td key={f.name} className={cls('px-3 py-2', f.type === 'number' && 'num')}>{i === 0 ? t('Total') : totals[f.name] !== undefined ? (MONEY.test(f.name) ? money(totals[f.name], cur) : num(totals[f.name], 2)) : ''}</td>)}</tr></tfoot>
              )}
            </table>
          </Card>
          <div className="md:hidden space-y-2">
            {totals && (
              <div className="card px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm bg-brand-50 border-brand-200">
                <span className="font-semibold">{t('Total')}</span>
                {Object.entries(totals).map(([k, v]) => <span key={k}>{clean(cols.find((c) => c.name === k)?.label)}: <b>{MONEY.test(k) ? money(v, cur) : num(v, 2)}</b></span>)}
              </div>
            )}
            {rows.slice(0, 300).map((r) => (
              <button key={r.id} className="card w-full text-left px-4 py-3 active:bg-slate-50" onClick={() => setEdit(r)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold truncate">{fmtCell(cols[0], r, cur)}</div>
                  {cols[1] && <div className="text-sm shrink-0">{fmtCell(cols[1], r, cur)}</div>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-slate-500">
                  {cols.slice(2).filter((f) => r[f.name] !== null && r[f.name] !== '' && r[f.name] !== undefined).map((f) => <span key={f.name}>{clean(f.label)}: <span className="text-slate-800">{fmtCell(f, r, cur)}</span></span>)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {def.canWrite && (
        <button className="md:hidden fixed right-4 bottom-24 z-30 h-14 w-14 rounded-full bg-brand-700 text-white text-2xl shadow-lg grid place-items-center no-print" onClick={() => setEdit('new')} aria-label={t('Add')}>
          <Icon name="plus-lg" />
        </button>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? `${t('Add')} · ${t(def.title)}` : t(def.title)} wide={def.fields.length > 8}>
        {edit && <ResourceForm def={def} row={edit === 'new' ? null : edit} presets={edit === 'new' ? presetFilters : undefined}
          onSaved={() => { setEdit(null); reload(); }} onDeleted={() => { setEdit(null); reload(); }} />}
      </Modal>
    </div>
  );
}
