import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useChatStore } from '@cs/shared/src/store';
import { setTokenGetter } from './api/client';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import TenantListPage from './pages/tenants/TenantList';
import TenantDetailPage from './pages/tenants/TenantDetail';
import AgentListPage from './pages/agents/AgentList';
import SessionListPage from './pages/sessions/SessionList';
import FilesPage from './pages/files/Files';
import OperationLogsPage from './pages/logs/OperationLogs';
import LoginLogsPage from './pages/logs/LoginLogs';
import SettingsPage from './pages/settings/Settings';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => {
    setTokenGetter(() => useChatStore.getState().auth?.token ?? null);
  }, []);

  useEffect(() => {
    if (!auth || auth.role !== 'platform_admin') navigate('/login');
  }, [auth, navigate]);

  if (!auth || auth.role !== 'platform_admin') return null;
  return <>{children}</>;
}

export default function App() {
  const { auth } = useChatStore();

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#4f46e5', borderRadius: 8 } }}>
      <AntApp>
        <BrowserRouter>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
