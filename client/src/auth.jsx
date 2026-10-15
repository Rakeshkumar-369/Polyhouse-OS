// Login state + /api/meta (user, org, enabled modules, resource definitions) for the whole app
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const load = useCallback(async () => {
    if (!getToken()) { setMeta(null); setLoading(false); return; }
    try { setMeta(await api.get('/meta')); } catch { setMeta(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const login = async (login, password) => {
    const r = await api.post('/auth/login', { login, password });
    setToken(r.token); setLoading(true); await load();
  };
  const loginWithToken = async (token) => { setToken(token); setLoading(true); await load(); };
  const logout = () => { setToken(null); localStorage.removeItem('pos_super_token'); setMeta(null); window.location.href = '/login'; };

  const on = (key) => !key || !meta?.org || meta.org.settings.modules[key] !== false;
  const role = meta?.user?.role;
  const cur = meta?.org?.settings?.currency || '₹';
  return <Ctx.Provider value={{ meta, loading, login, loginWithToken, logout, reload: load, on, role, cur }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
