import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from '@cs/shared/src/auth-store';
import { setMediaTokenGetter } from '@cs/shared';
import { setTokenGetter } from './api/client';
import LoginPage from './pages/Login';
import PageLoader from './components/PageLoader';

// Register before any child useEffect fires (children effects run before parent effects).
setTokenGetter(() => useAuthStore.getState().auth?.token ?? null);
setMediaTokenGetter(() => useAuthStore.getState().auth?.token ?? null);

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const TenantListPage = lazy(() => import('./pages/tenants/TenantList'));
const TenantDetailPage = lazy(() => import('./pages/tenants/TenantDetail'));
const AgentListPage = lazy(() => import('./pages/agents/AgentList'));
const SessionListPage = lazy(() => import('./pages/sessions/SessionList'));
const FilesPage = lazy(() => import('./pages/files/Files'));
const OperationLogsPage = lazy(() => import('./pages/logs/OperationLogs'));
const LoginLogsPage = lazy(() => import('./pages/logs/LoginLogs'));
const SettingsPage = lazy(() => import('./pages/settings/Settings'));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuthStore();

  if (!auth || auth.role !== 'platform_admin') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { auth } = useAuthStore();

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#4f46e5', borderRadius: 8 } }}>
      <AntApp>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={auth ? <Navigate to="/" replace /> : <LoginPage />} />
              <Route
                element={
                  <AuthGuard>
                    <AdminLayout />
                  </AuthGuard>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="tenants" element={<TenantListPage />} />
                <Route path="tenants/:tenantCode" element={<TenantDetailPage />} />
                <Route path="agents" element={<AgentListPage />} />
                <Route path="agents/online" element={<Navigate to="/agents" replace />} />
                <Route path="agents/suspended" element={<Navigate to="/agents" replace />} />
                <Route path="sessions" element={<SessionListPage />} />
                <Route path="sessions/current" element={<Navigate to="/sessions" replace />} />
                <Route path="sessions/closed" element={<Navigate to="/sessions" replace />} />
                <Route path="sessions/messages" element={<Navigate to="/sessions" replace />} />
                <Route path="files" element={<FilesPage />} />
                <Route path="logs" element={<OperationLogsPage />} />
                <Route path="login-logs" element={<LoginLogsPage />} />
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
