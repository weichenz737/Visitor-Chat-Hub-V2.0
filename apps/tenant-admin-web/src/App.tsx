import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from '@cs/shared/src/auth-store';
import { setTokenGetter } from './api/client';
import LoginPage from './pages/Login';
import PageLoader from './components/PageLoader';

// Register before any child useEffect fires (children effects run before parent effects).
setTokenGetter(() => useAuthStore.getState().auth?.token ?? null);

const TenantLayout = lazy(() => import('./layouts/TenantLayout'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const AgentsPage = lazy(() => import('./pages/Agents'));
const SessionsPage = lazy(() => import('./pages/Sessions'));
const FilesPage = lazy(() => import('./pages/Files'));
const QuickRepliesPage = lazy(() => import('./pages/QuickReplies'));
const ApiPage = lazy(() => import('./pages/Api'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuthStore();

  if (!auth || auth.role !== 'tenant_admin') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { auth } = useAuthStore();

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#059669', borderRadius: 8 } }}>
      <AntApp>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={auth?.role === 'tenant_admin' ? <Navigate to="/" replace /> : <LoginPage />} />
              <Route element={<AuthGuard><TenantLayout /></AuthGuard>}>
                <Route index element={<DashboardPage />} />
                <Route path="agents" element={<AgentsPage />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="sessions/messages" element={<Navigate to="/sessions" replace />} />
                <Route path="files" element={<FilesPage />} />
                <Route path="quick-replies" element={<QuickRepliesPage />} />
                <Route path="api" element={<ApiPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
