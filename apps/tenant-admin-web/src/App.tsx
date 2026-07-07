import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useChatStore } from '@cs/shared/src/store';
import { setTokenGetter } from './api/client';
import TenantLayout from './layouts/TenantLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import AgentsPage from './pages/Agents';
import SessionsPage from './pages/Sessions';
import FilesPage from './pages/Files';
import QuickRepliesPage from './pages/QuickReplies';
import ApiPage from './pages/Api';
import SettingsPage from './pages/Settings';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => {
    setTokenGetter(() => useChatStore.getState().auth?.token ?? null);
  }, []);

  useEffect(() => {
    if (!auth || auth.role !== 'tenant_admin') navigate('/login');
  }, [auth, navigate]);

  if (!auth || auth.role !== 'tenant_admin') return null;
  return <>{children}</>;
}

export default function App() {
  const { auth } = useChatStore();

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#059669', borderRadius: 8 } }}>
      <AntApp>
        <BrowserRouter>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
