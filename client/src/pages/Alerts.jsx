// All alerts: things that need action today
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Card, Empty, Icon, PageHeader, Spinner } from '../components/Ui';
import { cls } from '../utils';

export const LEVEL = {
  red: { icon: 'bi-exclamation-octagon-fill', cls: 'border-l-red-500 bg-red-50/50', ic: 'text-red-600', label: 'Act now' },
  amber: { icon: 'bi-exclamation-triangle-fill', cls: 'border-l-amber-500 bg-amber-50/50', ic: 'text-amber-600', label: 'Watch' },
  info: { icon: 'bi-info-circle-fill', cls: 'border-l-blue-500 bg-blue-50/40', ic: 'text-blue-600', label: 'Info' },
};

export function AlertList({ alerts, limit }) {
  if (!alerts.length) return <Empty icon="bi-emoji-smile" text="All clear — nothing needs attention." />;
  return (
    <div className="space-y-2">
      {alerts.slice(0, limit || alerts.length).map((a, i) => {
        const L = LEVEL[a.level];
        return (
          <Link key={i} to={a.link || '#'} className={cls('flex gap-3 rounded-xl border border-slate-200 border-l-4 px-3 py-2.5 hover:shadow-sm', L.cls)}>
            <Icon name={L.icon} className={cls('mt-0.5', L.ic)} />
            <div className="min-w-0"><div className="font-semibold text-sm">{a.title} <span className="sr-only">({L.label})</span></div><div className="text-xs text-slate-600">{a.detail}</div></div>
          </Link>
        );
      })}
    </div>
  );
}

export default function Alerts() {
  const [a, setA] = useState(null);
  useEffect(() => { api.get('/alerts').then(setA); }, []);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Alerts" subtitle="Exceptions caught from today's records" />
      <Card>{a ? <AlertList alerts={a} /> : <Spinner />}</Card>
    </div>
  );
}
