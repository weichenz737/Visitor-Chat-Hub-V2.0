import { message } from 'antd';
import { API_BASE } from '@cs/shared';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

let tokenGetter: (() => string | null) | null = null;

export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenGetter?.();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      try {
        const { useAuthStore } = await import('@cs/shared/src/auth-store');
        useAuthStore.getState().clearAuth();
      } catch {
        /* ignore */
      }
      throw new Error('Unauthorized');
    }
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const msg = err.message ?? '请求失败';
    message.error(msg);
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const tenantApi = {
  dashboard: () => request<{
    tenant: Record<string, unknown>;
    stats: Record<string, number>;
    topAgentsToday: { name: string; count: number }[];
    recentSessions: unknown[];
    recentAgents: unknown[];
  }>('/tenant-admin/dashboard'),

  profile: () => request<Record<string, unknown>>('/tenant-admin/profile'),

  updateProfile: (data: Record<string, unknown>) =>
    request('/tenant-admin/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  settings: () => request<Record<string, string>>('/tenant-admin/settings'),

  updateSettings: (data: Record<string, string>) =>
    request<Record<string, string>>('/tenant-admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  regenerateApiKey: () =>
    request<Record<string, unknown>>('/tenant-admin/regenerate-api-key', { method: 'POST' }),

  agents: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<Record<string, unknown>>>(`/tenant-admin/agents?${q}`);
  },

  createAgent: (data: Record<string, unknown>) =>
    request('/tenant-admin/agents', { method: 'POST', body: JSON.stringify(data) }),

  updateAgent: (id: string, data: Record<string, unknown>) =>
    request(`/tenant-admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  resetPassword: (id: string, password: string) =>
    request(`/tenant-admin/agents/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  deleteAgent: (id: string) =>
    request(`/tenant-admin/agents/${id}`, { method: 'DELETE' }),

  sessions: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<unknown>>(`/tenant-admin/sessions?${q}`);
  },

  sessionMessages: (id: string) =>
    request<{ session: unknown; messages: unknown[] }>(`/tenant-admin/sessions/${id}/messages`),

  chatUsers: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<unknown>>(`/tenant-admin/chat-users?${q}`);
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
      `/tenant-admin/chat-users/${userId}/messages?${q}`,
    );
  },

  deleteMessage: (id: string) =>
    request<{ success: boolean }>(`/tenant-admin/messages/${id}`, { method: 'DELETE' }),

  updateMessage: (id: string, data: { content?: string; fileName?: string }) =>
    request<{ success: boolean }>(`/tenant-admin/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  replaceMessageMedia: async (id: string, file: File, fileName?: string) => {
    const token = tokenGetter?.();
    const form = new FormData();
    form.append('file', file);
    if (fileName) form.append('file_name', fileName);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/tenant-admin/messages/${id}/media`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });
    } catch {
      const msg = '无法连接服务器，请确认后端已启动';
      message.error(msg);
      throw new Error(msg);
    }
    if (!res.ok) {
      if (res.status === 401) {
        try {
          const { useAuthStore } = await import('@cs/shared/src/auth-store');
          useAuthStore.getState().clearAuth();
        } catch {
          /* ignore */
        }
        throw new Error('Unauthorized');
      }
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const msg = err.message ?? '请求失败';
      message.error(msg);
      throw new Error(msg);
    }
    return res.json() as Promise<{ message: unknown }>;
  },

  deleteChatUserMessages: (userId: string) =>
    request<{ deleted: number }>(`/tenant-admin/chat-users/${userId}/messages`, { method: 'DELETE' }),

  transferSession: (sessionId: string, toAgentId: string, reason?: string) =>
    request<{ session: unknown }>(`/tenant-admin/sessions/${sessionId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ toAgentId, reason }),
    }),

  files: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return request<Paginated<unknown>>(`/tenant-admin/files?${q}`);
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
    }>('/tenant-admin/files/stats'),

  deleteFile: (id: string) =>
    request<{ success: boolean }>(`/tenant-admin/files/${id}`, { method: 'DELETE' }),

  quickReplies: () => request<unknown[]>('/tenant-admin/quick-replies'),

  createQuickReply: (data: Record<string, unknown>) =>
    request('/tenant-admin/quick-replies', { method: 'POST', body: JSON.stringify(data) }),

  updateQuickReply: (id: string, data: Record<string, unknown>) =>
    request(`/tenant-admin/quick-replies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteQuickReply: (id: string) =>
    request(`/tenant-admin/quick-replies/${id}`, { method: 'DELETE' }),

  authorizations: () =>
    request<{
      allowDeleteMessages: boolean;
      allowDeleteSessions: boolean;
      allowDeleteFiles: boolean;
      allowEditMessages: boolean;
      allowAdminTransfer: boolean;
      allowAgentTransfer: boolean;
      maxAgentCount: number;
      currentAgentCount: number;
      canCreateAgent: boolean;
    }>('/tenant-admin/authorizations'),

  removeVisitorSession: (userId: string) =>
    request<{ removed: number }>(`/tenant-admin/chat-users/${userId}/session`, { method: 'DELETE' }),
};
