import { useEffect, useState } from 'react';
import { useAuthStore } from '@cs/shared/src/auth-store';
import {
  clearRememberedLogin,
  loadLastTenantCode,
  loadRememberedLogin,
  saveLastTenantCode,
  saveRememberedLogin,
} from '@cs/shared/src/remember-login';

export default function LoginPage() {
  const { loginAgent, loading, error } = useAuthStore();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [tenantCode, setTenantCode] = useState('');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const saved = loadRememberedLogin('agent');
    const lastTenant = loadLastTenantCode('agent');
    if (saved) {
      setAccount(saved.account);
      setPassword(saved.password);
      setTenantCode(saved.tenantCode || lastTenant || '');
      setRemember(true);
    } else if (lastTenant) {
      setTenantCode(lastTenant);
    }
  }, []);

  return (
    <div className="login-page">
      <form
        className="login-form card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await loginAgent(account, password, tenantCode);
            saveLastTenantCode('agent', tenantCode);
            if (remember) {
              saveRememberedLogin('agent', { account, password, tenantCode });
            } else {
              clearRememberedLogin('agent');
            }
          } catch {
            // error shown via store
          }
        }}
      >
        <h1>客服工作台</h1>
        <p className="login-hint">仅限客服账号登录</p>
        <input
          placeholder="企业编码"
          value={tenantCode}
          onChange={(e) => setTenantCode(e.target.value)}
          autoComplete="organization"
          required
        />
        <input
          placeholder="账号"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <label className="remember-row">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          记住密码
        </label>
        {error && <div className="error-text">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
      </form>
    </div>
  );
}
