import { message } from 'antd';
import { API_BASE } from '@cs/shared';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface QuickReplyItem {
  id: string;
  title: string;
  content: string;
  shortcut?: string | null;
  agentId?: string | null;
  createdAt?: string;
}

export interface TenantItem {
  tenantCode: string;
  name: string;
  slug: string;
  apiKey: string;
  adminEmail: string;
  contactName?: string | null;
  contactPhone?: string | null;
  remark?: string | null;
  domain?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  createdAt: string;
  _count?: { agents: number; users: number; sessions: number };
}

export interface AgentItem {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  remark?: string | null;
  role: 'AGENT' | 'SUPERVISOR';
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  createdAt: string;
  activeSessionCount?: number;
  tenant?: { tenantCode: string; name: string };
}

export interface OperationLogItem {
  id: string;
  adminEmail: string;
  action: string;
  target?: string | null;
  detail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

let tokenGetter: (() => string | null) | null = null;

export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

async function request<T>(
  path: string,
  options: RequestInit & { silent?: boolean } = {},
): Promise<T> {
  const { silent, headers, ...rest } = options;
  const token = tokenGetter?.();
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const msg = err.message ?? '请求失败';
    if (!silent) message.error(msg);
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface LoginLogItem {
  id: string;
  account: string;
  role: string;
  tenantCode?: string | null;
  tenantName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  failReason?: string | null;
  createdAt: string;
}

export interface DashboardData {
  stats: {
    tenantCount: number;
    activeTenantCount: number;
    suspendedTenantCount: number;
    totalAgents: number;
    onlineAgents: number;
    totalUsers: number;
    onlineUsers: number;
    todayUsers: number;
    todaySessions: number;
    todayMessages: number;
    activeSessions: number;
    avgResponseTime: number;
    avgSessionDuration: number;
  };
  charts: {
    todayMessageTrend: { hour: string; count: number }[];
    sessionTrend7d: { date: string; count: number }[];
    userTrend7d: { date: string; count: number }[];
    topAgents: { name: string; tenantName: string; count: number }[];
    topTenants: { name: string; tenantCode: string; count: number }[];
  };
  recentTenants: TenantItem[];
  recentAgents: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    tenant?: { name: string; tenantCode: string };
  }[];
  recentLogs: OperationLogItem[];
  recentSessions: unknown[];
}

export const adminApi = {
  dashboard: () => request<DashboardData>('/admin/dashboard'),

  tenants: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<TenantItem>>(`/admin/tenants?${q}`);
  },

  tenant: (tenantCode: string) =>
    request<TenantItem>(`/admin/tenants/${encodeURIComponent(tenantCode)}`),

  createTenant: (data: Record<string, unknown>) =>
    request<TenantItem>('/admin/tenants', { method: 'POST', body: JSON.stringify(data) }),

  updateTenant: (tenantCode: string, data: Record<string, unknown>) =>
    request<TenantItem>(`/admin/tenants/${encodeURIComponent(tenantCode)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateTenantStatus: (tenantCode: string, status: string) =>
    request<TenantItem>(`/admin/tenants/${encodeURIComponent(tenantCode)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteTenant: (tenantCode: string) =>
    request(`/admin/tenants/${encodeURIComponent(tenantCode)}`, { method: 'DELETE' }),

  regenerateApiKey: (tenantCode: string) =>
    request<TenantItem>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/regenerate-api-key`,
      { method: 'POST' },
    ),

  tenantAgents: (tenantCode: string, params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<AgentItem>>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/agents?${q}`,
    );
  },

  createAgent: (tenantCode: string, data: Record<string, unknown>) =>
    request<AgentItem>(`/admin/tenants/${encodeURIComponent(tenantCode)}/agents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAgent: (tenantCode: string, agentId: string, data: Record<string, unknown>) =>
    request<AgentItem>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/agents/${agentId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    ),

  resetAgentPassword: (tenantCode: string, agentId: string, password: string) =>
    request(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/agents/${agentId}/reset-password`,
      { method: 'POST', body: JSON.stringify({ password }) },
    ),

  deleteAgent: (tenantCode: string, agentId: string) =>
    request(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/agents/${agentId}`,
      { method: 'DELETE' },
    ),

  tenantQuickReplies: (tenantCode: string) =>
    request<QuickReplyItem[]>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/quick-replies`,
    ),

  createTenantQuickReply: (
    tenantCode: string,
    data: { title: string; content: string; shortcut?: string },
  ) =>
    request<QuickReplyItem>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/quick-replies`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  updateTenantQuickReply: (
    tenantCode: string,
    id: string,
    data: { title?: string; content?: string; shortcut?: string },
  ) =>
    request<QuickReplyItem>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/quick-replies/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    ),

  deleteTenantQuickReply: (tenantCode: string, id: string) =>
    request(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/quick-replies/${id}`,
      { method: 'DELETE' },
    ),

  agents: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<AgentItem>>(`/admin/agents?${q}`);
  },

  sessions: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<unknown>>(`/admin/sessions?${q}`);
  },

  sessionMessages: (id: string, page = 1) =>
    request<{ session: unknown; messages: unknown[]; total: number }>(
      `/admin/sessions/${id}/messages?page=${page}&limit=50`,
    ),

  chatUsers: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<unknown>>(`/admin/chat-users?${q}`);
  },

  chatUserMessages: (
    userId: string,
    page = 1,
    params?: {
      senderType?: string;
      content?: string;
      startTime?: string;
      endTime?: string;
    },
  ) => {
    const q = new URLSearchParams({ page: String(page), limit: '50' });
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) q.set(k, v);
      });
    }
    return request<{ user: unknown; messages: unknown[]; total: number; page: number; limit: number }>(
      `/admin/chat-users/${userId}/messages?${q}`,
    );
  },

  deleteMessage: (id: string) =>
    request<{ success: boolean }>(`/admin/messages/${id}`, { method: 'DELETE' }),

  updateMessage: (id: string, data: { content?: string; fileName?: string }) =>
    request<{ message: unknown }>(`/admin/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteChatUserMessages: (userId: string) =>
    request<{ deleted: number }>(`/admin/chat-users/${userId}/messages`, { method: 'DELETE' }),

  files: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<unknown>>(`/admin/files?${q}`);
  },

  fileStats: () =>
    request<{
      totalCount: number;
      todayCount: number;
      totalSize: number;
      imageCount: number;
      videoCount: number;
      fileCount: number;
      uploadTrend7d: { date: string; count: number }[];
    }>('/admin/files/stats'),

  deleteFile: (id: string) =>
    request<{ success: boolean }>(`/admin/files/${id}`, { method: 'DELETE' }),

  operationLogs: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<OperationLogItem>>(`/admin/operation-logs?${q}`);
  },

  loginLogs: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<LoginLogItem>>(`/admin/login-logs?${q}`);
  },

  tenantSettings: (tenantCode: string) =>
    request<Record<string, string>>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/settings`,
    ),

  updateTenantSettings: (tenantCode: string, data: Record<string, string>) =>
    request<Record<string, string>>(
      `/admin/tenants/${encodeURIComponent(tenantCode)}/settings`,
      { method: 'PUT', body: JSON.stringify(data) },
    ),

  settings: () => request<Record<string, string>>('/admin/settings'),

  updateSettings: (data: Record<string, string>) =>
    request<Record<string, string>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
