// Login state + /api/meta (user, org, enabled modules, resource field definitions) for the whole app
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { setLang, getLang } from './i18n';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const load = useCallback(async () => {
    if (!getToken()) { setMeta(null); setLoading(false); return; }
    try {
      const m = await api.get('/meta');
      if (m.user.lang && m.user.lang !== getLang()) setLang(m.user.lang);
      setMeta(m);
    } catch { setMeta(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const login = async (login, password) => {
    const r = await api.post('/auth/login', { login, password });
    setToken(r.token); setLoading(true); await load();
    return r.user;
  };
  const loginWithToken = async (token) => { setToken(token); setLoading(true); await load(); };
  const logout = () => { setToken(null); localStorage.removeItem('pos_super_token'); api.clear(); setMeta(null); window.location.href = '/login'; };
  const changeLang = (l) => { setLang(l); if (getToken()) api.put('/auth/lang', { lang: l }).catch(() => {}); };

  const on = (key) => !key || !meta?.org || meta.org.settings.modules[key] !== false;
  const role = meta?.user?.role;
  const cur = meta?.org?.settings?.currency || '₹';
  return <Ctx.Provider value={{ meta, loading, login, loginWithToken, logout, reload: load, on, role, cur, changeLang }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
