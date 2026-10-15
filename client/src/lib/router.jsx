// Tiny client-side router (replaces react-router; ~1 KB). navigate('/path'), <Link to>, useLocation(), match()
import { useEffect, useState } from 'react';

const listeners = new Set();
const emit = () => listeners.forEach((f) => f());
if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

export function navigate(to, { replace = false } = {}) {
  if (to === window.location.pathname + window.location.search) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
  emit();
  window.scrollTo(0, 0);
}

export function useLocation() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  return { pathname: window.location.pathname, search: window.location.search, query: new URLSearchParams(window.location.search) };
}

// match('/m/:res', '/m/farms') -> { res: 'farms' }   (null when it doesn't match)
export function match(pattern, path) {
  const a = pattern.split('/').filter(Boolean); const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

const click = (to) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); navigate(to);
};

export function Link({ to, children, ...rest }) {
  return <a href={to} onClick={click(to)} {...rest}>{children}</a>;
}

// className can be a function of isActive
export function NavLink({ to, end, className, children, ...rest }) {
  const { pathname } = useLocation();
  const active = end || to === '/' ? pathname === to : pathname === to || pathname.startsWith(to + '/');
  return <a href={to} onClick={click(to)} className={typeof className === 'function' ? className(active) : className} aria-current={active ? 'page' : undefined} {...rest}>{children}</a>;
}
