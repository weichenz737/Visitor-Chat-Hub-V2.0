import { create } from 'zustand';

const API_BASE = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000';

type UserRole = 'user' | 'agent' | 'tenant_admin' | 'platform_admin';
type StaffRole = 'TENANT_ADMIN' | 'SUPERVISOR' | 'AGENT';
type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';

interface AuthState {
  token: string;
  role: UserRole;
  tenantId?: string;
  tenantCode?: string;
  staffRole?: StaffRole;
  userId: string;
  name?: string;
  agentCode?: string;
  agentStatus?: AgentStatus;
  phone?: string;
}

async function authFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      useAuthStore.getState().clearAuth();
      throw new Error('Unauthorized');
    }
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

interface AuthStore {
  auth: AuthState | null;
  loading: boolean;
  error: string | null;
  loginAgent: (account: string, password: string, tenantCode: string) => Promise<void>;
  loginTenantAdmin: (account: string, password: string, tenantCode: string) => Promise<void>;
  loginPlatformAdmin: (email: string, password: string) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  auth: null,
  loading: false,
  error: null,

  loginAgent: async (account, password, tenantCode) => {
    set({ loading: true, error: null });
    try {
      const data = await authFetch<{
        accessToken: string;
        agent: {
          id: string;
          name: string;
          tenantCode: string;
          staffRole: string;
          agentCode?: string;
          status?: string;
          phone?: string;
        };
      }>('/auth/agent/login', {
        method: 'POST',
        body: JSON.stringify({ email: account, password, tenantCode }),
      });
      set({
        auth: {
          token: data.accessToken,
          role: 'agent',
          tenantId: data.agent.tenantCode,
          tenantCode: data.agent.tenantCode,
          staffRole: 'AGENT',
          userId: data.agent.id,
          name: data.agent.name,
          agentCode: data.agent.agentCode,
          agentStatus: (data.agent.status as AgentStatus) ?? 'OFFLINE',
          phone: data.agent.phone,
        },
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  loginTenantAdmin: async (account, password, tenantCode) => {
    set({ loading: true, error: null });
    try {
      const data = await authFetch<{
        accessToken: string;
        user: {
          id: string;
          name: string;
          tenantCode: string;
          tenantName: string;
          staffRole: StaffRole;
        };
      }>('/auth/tenant/login', {
        method: 'POST',
        body: JSON.stringify({ email: account, password, tenantCode }),
      });
      set({
        auth: {
          token: data.accessToken,
          role: 'tenant_admin',
          tenantId: data.user.tenantCode,
          tenantCode: data.user.tenantCode,
          staffRole: data.user.staffRole,
          userId: data.user.id,
          name: data.user.name,
        },
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  loginPlatformAdmin: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await authFetch<{
        accessToken: string;
        admin: { id: string; name: string };
      }>('/auth/platform/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      set({
        auth: {
          token: data.accessToken,
          role: 'platform_admin',
          userId: data.admin.id,
          name: data.admin.name,
        },
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  loginAdmin: async (email, password) => get().loginPlatformAdmin(email, password),

  clearAuth: () => set({ auth: null, loading: false, error: null }),
}));
