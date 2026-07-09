import { useState } from 'react';
import { useAuthStore } from '@cs/shared/src/auth-store';

const TENANT_CODE = import.meta.env.VITE_TENANT_CODE ?? 'demo001';

export default function LoginPage() {
  const { loginAgent, loading, error } = useAuthStore();
  const [account, setAccount] = useState('agent@demo.com');
  const [password, setPassword] = useState('agent123');
  const [tenantCode, setTenantCode] = useState(TENANT_CODE);

  return (
    <div className="login-page">
      <form
        className="login-form card"
        onSubmit={(e) => {
          e.preventDefault();
          loginAgent(account, password, tenantCode);
        }}
      >
        <h1>客服工作台</h1>
        <p className="login-hint">仅限客服账号登录</p>
        <input placeholder="企业编码" value={tenantCode} onChange={(e) => setTenantCode(e.target.value)} required />
        <input placeholder="账号" value={account} onChange={(e) => setAccount(e.target.value)} required />
        <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="error-text">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
      </form>
    </div>
  );
}
