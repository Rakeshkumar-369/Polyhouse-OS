// My account: change password, language
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Card, PageHeader, useToast } from '../../ui/kit';
import LangSwitch from '../../ui/LangSwitch';

export function PasswordForm() {
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '' });
  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/auth/change-password', f); toast('Password changed'); setF({ current: '', next: '' }); } catch (e2) { toast(e2.message, 'error'); }
  };
  return (
    <form onSubmit={save} className="space-y-3">
      <div><label className="label">Current password</label><input type="password" autoComplete="current-password" className="input" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></div>
      <div><label className="label">New password (min 6)</label><input type="password" autoComplete="new-password" className="input" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required minLength={6} /></div>
      <button className="btn-primary w-full">Change password</button>
    </form>
  );
}

export default function Account() {
  const { meta } = useAuth();
  return (
    <div className="max-w-md space-y-4">
      <PageHeader title={t('My account')} subtitle={`${meta.user.name} · ${meta.user.login} · ${meta.user.role}`} />
      <Card title={t('Language')}><LangSwitch /></Card>
      <Card title="Change password"><PasswordForm /></Card>
    </div>
  );
}
