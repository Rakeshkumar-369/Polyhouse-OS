// API client with a stale-while-revalidate cache: screens you've visited render instantly while fresh data loads.
import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'pos_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

const cache = new Map();
const qs = (params) => {
  if (!params) return '';
  const e = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return e.length ? '?' + new URLSearchParams(e).toString() : '';
};

async function req(method, url, body) {
  let res;
  try {
    res = await fetch('/api' + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No internet connection. Please try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/auth/login')) { setToken(null); cache.clear(); window.location.href = '/login'; }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  if (method !== 'GET') cache.clear(); // any change -> all cached reads are refreshed on next view
  return data;
}

export const api = {
  get: async (u, params) => { const url = u + qs(params); const d = await req('GET', url); cache.set(url, d); return d; },
  post: (u, b) => req('POST', u, b || {}),
  put: (u, b) => req('PUT', u, b || {}),
  del: (u) => req('DELETE', u),
  clear: () => cache.clear(),
  async upload(file) {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/ops/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  fileUrl: (name) => `/api/ops/file/${encodeURIComponent(name)}?token=${getToken()}`,
};

// const { data, error, loading, reload } = useApi('/dashboard', { from, to })   (url null = skip)
export function useApi(url, params) {
  const full = url ? url + qs(params) : null;
  const [state, setState] = useState(() => ({ data: full ? cache.get(full) : undefined, error: null, loading: !!full }));
  const live = useRef(full);
  const load = useCallback(async () => {
    if (!full) return;
    live.current = full;
    setState((s) => ({ data: cache.get(full) ?? (s.key === full ? s.data : undefined), error: null, loading: true, key: full }));
    try {
      const d = await req('GET', full); cache.set(full, d);
      if (live.current === full) setState({ data: d, error: null, loading: false, key: full });
    } catch (e) {
      if (live.current === full) setState((s) => ({ ...s, error: e.message, loading: false }));
    }
  }, [full]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
