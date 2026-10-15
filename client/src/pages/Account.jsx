// Change own password
import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, PageHeader, useToast } from '../components/Ui';

export default function Account() {
  const { meta } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '' });
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/auth/change-password', f); toast('Password changed'); setF({ current: '', next: '' }); } catch (e2) { toast(e2.message, 'error'); }
  };
  return (
    <div className="max-w-md">
      <PageHeader title="My account" subtitle={`${meta.user.name} · ${meta.user.login} · ${meta.user.role}`} />
      <Card title="Change password">
        <form onSubmit={save} className="space-y-3">
          <div><label className="label">Current password</label><input type="password" className="input" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></div>
          <div><label className="label">New password (min 6)</label><input type="password" className="input" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required minLength={6} /></div>
          <button className="btn-primary w-full">Change password</button>
        </form>
      </Card>
    </div>
  );
}
