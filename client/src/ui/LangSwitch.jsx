// English <-> Telugu switch (saved on the device and on the user's profile)
import { useAuth } from '../lib/auth';
import { useLang } from '../lib/i18n';
import { cls } from '../lib/format';
import Icon from './Icon';

export default function LangSwitch({ className = '' }) {
  const { changeLang } = useAuth();
  const lang = useLang();
  return (
    <button type="button" className={cls('inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-500', className)}
      onClick={() => changeLang(lang === 'en' ? 'te' : 'en')} title="Language / భాష">
      <Icon name="translate" /> {lang === 'en' ? 'తెలుగు' : 'English'}
    </button>
  );
}
