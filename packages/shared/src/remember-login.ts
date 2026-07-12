export type RememberLoginRole = 'agent' | 'platform' | 'tenant';

export type RememberedLogin = {
  remember: true;
  account: string;
  password: string;
  tenantCode?: string;
};

const KEYS: Record<RememberLoginRole, string> = {
  agent: 'cs.login.agent',
  platform: 'cs.login.platform',
  tenant: 'cs.login.tenant',
};

const TENANT_CODE_KEYS: Partial<Record<RememberLoginRole, string>> = {
  agent: 'cs.login.agent.tenantCode',
  tenant: 'cs.login.tenant.tenantCode',
};

export function loadRememberedLogin(role: RememberLoginRole): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(KEYS[role]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedLogin;
    if (!parsed?.remember || !parsed.account) return null;
    return {
      remember: true,
      account: parsed.account,
      password: parsed.password ?? '',
      tenantCode: parsed.tenantCode,
    };
  } catch {
    return null;
  }
}

export function saveRememberedLogin(
  role: RememberLoginRole,
  payload: { account: string; password: string; tenantCode?: string },
): void {
  try {
    const data: RememberedLogin = {
      remember: true,
      account: payload.account,
      password: payload.password,
      ...(payload.tenantCode != null && payload.tenantCode !== ''
        ? { tenantCode: payload.tenantCode }
        : {}),
    };
    localStorage.setItem(KEYS[role], JSON.stringify(data));
    if (payload.tenantCode) saveLastTenantCode(role, payload.tenantCode);
  } catch {
    // ignore
  }
}

export function clearRememberedLogin(role: RememberLoginRole): void {
  try {
    localStorage.removeItem(KEYS[role]);
  } catch {
    // ignore
  }
}

/** Always persist last used tenant code (independent of "remember password"). */
export function saveLastTenantCode(role: RememberLoginRole, tenantCode: string): void {
  const key = TENANT_CODE_KEYS[role];
  if (!key || !tenantCode.trim()) return;
  try {
    localStorage.setItem(key, tenantCode.trim());
  } catch {
    // ignore
  }
}

export function loadLastTenantCode(role: RememberLoginRole): string {
  const key = TENANT_CODE_KEYS[role];
  if (!key) return '';
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
