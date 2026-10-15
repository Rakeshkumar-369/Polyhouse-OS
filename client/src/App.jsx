// Routing. Each role lands on its own app; every screen is a lazy chunk so phones download only what they open.
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './lib/auth';
import { useLocation, match, navigate } from './lib/router';
import { useLang } from './lib/i18n';
import { Spinner, Skeleton } from './ui/kit';

const Landing = lazy(() => import('./apps/public/Landing'));
const Login = lazy(() => import('./apps/public/Login'));
const SuperAdmin = lazy(() => import('./apps/super/SuperAdmin'));
const VendorApp = lazy(() => import('./apps/vendor/VendorApp'));
const LabourApp = lazy(() => import('./apps/labour/LabourApp'));
const Shell = lazy(() => import('./ui/Shell'));
const Setup = lazy(() => import('./apps/farm/Setup'));

const FARM = {
  '/': lazy(() => import('./apps/farm/Dashboard')),
  '/sell': lazy(() => import('./apps/farm/Sell')),
  '/harvest': lazy(() => import('./apps/farm/Harvest')),
  '/spend': lazy(() => import('./apps/farm/Spend')),
  '/reports': lazy(() => import('./apps/farm/Reports')),
  '/vendors': lazy(() => import('./apps/farm/Vendors')),
  '/labour': lazy(() => import('./apps/farm/Labour')),
  '/alerts': lazy(() => import('./apps/farm/Alerts')),
  '/settings': lazy(() => import('./apps/farm/Settings')),
  '/account': lazy(() => import('./apps/farm/Account')),
  '/more': lazy(() => import('./ui/Shell').then((m) => ({ default: m.MorePage }))),
};
const ResourcePage = lazy(() => import('./ui/ResourcePage'));

function Redirect({ to }) { useEffect(() => { navigate(to, { replace: true }); }, [to]); return null; }

function FarmRoutes({ pathname, role, meta }) {
  if (role === 'admin' && !meta.org.settings.setup_done && pathname !== '/setup') return <Redirect to="/setup" />;
  if (pathname === '/setup') return <Setup />;
  if (role === 'delivery' && pathname === '/') return <Redirect to="/sell" />;
  const m = match('/m/:res', pathname);
  const Page = m ? null : FARM[pathname];
  if (!m && !Page) return <Redirect to="/" />;
  return (
    <Shell>
      <Suspense fallback={<Skeleton />}>
        {m ? <ResourcePage key={m.res} resKey={m.res} /> : <Page />}
      </Suspense>
    </Shell>
  );
}

export default function App() {
  const { meta, loading, role } = useAuth();
  const { pathname } = useLocation();
  useLang();
  if (loading) return <Spinner />;

  let view;
  if (!meta) view = pathname === '/login' ? <Login /> : pathname === '/' ? <Landing /> : <Redirect to="/login" />;
  else if (pathname === '/welcome') view = <Landing />;
  else if (pathname === '/login') view = <Redirect to="/" />;
  else if (role === 'superadmin') view = <SuperAdmin />;
  else if (role === 'vendor') view = <VendorApp />;
  else if (role === 'labour') view = <LabourApp />;
  else view = <FarmRoutes pathname={pathname} role={role} meta={meta} />;

  return <Suspense fallback={<Spinner />}>{view}</Suspense>;
}
