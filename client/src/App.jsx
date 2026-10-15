// Routes. Each role lands on its own home screen.
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout, { MorePage } from './components/Layout';
import ResourcePage from './components/ResourcePage';
import { Spinner } from './components/Ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sell from './pages/Sell';
import Harvest from './pages/Harvest';
import Spend from './pages/Spend';
import Reports from './pages/Reports';
import Vendors from './pages/Vendors';
import Labour from './pages/Labour';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import Account from './pages/Account';
import SuperAdmin from './pages/SuperAdmin';
import VendorPortal from './pages/VendorPortal';
import LabourPortal from './pages/LabourPortal';

export default function App() {
  const { meta, loading, role } = useAuth();
  if (loading) return <Spinner />;
  if (!meta) return <Routes><Route path="*" element={<Login />} /></Routes>;

  if (role === 'superadmin') return <Routes><Route path="*" element={<SuperAdmin />} /></Routes>;
  if (role === 'vendor') return <Routes><Route path="*" element={<VendorPortal />} /></Routes>;
  if (role === 'labour') return <Routes><Route path="*" element={<LabourPortal />} /></Routes>;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={role === 'delivery' ? <Navigate to="/sell" replace /> : <Dashboard />} />
        <Route path="sell" element={<Sell />} />
        <Route path="harvest" element={<Harvest />} />
        <Route path="spend" element={<Spend />} />
        <Route path="reports" element={<Reports />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="labour" element={<Labour />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="account" element={<Account />} />
        <Route path="more" element={<MorePage />} />
        <Route path="m/:res" element={<ResourcePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
