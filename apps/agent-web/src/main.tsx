import { StrictMode, lazy, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuthStore } from '@cs/shared/src/auth-store';
import { useChatStore } from '@cs/shared/src/store';
import LoginPage from './LoginPage';
import '@cs/shared/src/styles.css';
import './app.css';

const AgentWorkbench = lazy(() => import('./AgentWorkbench'));

function WorkbenchLoader() {
  return (
    <div className="login-page">
      <p>加载工作台...</p>
    </div>
  );
}

function App() {
  const { auth } = useAuthStore();
  const { logout } = useChatStore();

  useEffect(() => {
    if (auth && auth.role !== 'agent') logout();
  }, [auth, logout]);

  if (auth?.role !== 'agent') return <LoginPage />;
  return (
    <Suspense fallback={<WorkbenchLoader />}>
      <AgentWorkbench />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
