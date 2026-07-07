import { apiFetch, type AgentStatus } from '@cs/shared';

const USER_WEB_URL = import.meta.env.VITE_USER_WEB_URL ?? 'http://localhost:5173';

export type AgentProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  agentCode?: string | null;
  status: AgentStatus;
};

export type AgentStats = {
  todaySessions: number;
  activeSessions: number;
  todayMessages: number;
};

export type ShareLink = {
  url: string;
  agentCode: string;
  agentName: string;
  tenantCode: string;
  tenantName: string;
};

export type UserDetail = {
  id: string;
  nickname?: string | null;
  originalName?: string | null;
  visitorNo?: number | null;
  deviceId?: string | null;
  displayName?: string | null;
  visitorLabel?: string | null;
  source?: string;
  referer?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  myRemark?: { id: string; content: string; tags: string[] } | null;
  allTags?: string[];
};

export const STATUS_OPTIONS: { value: AgentStatus; label: string; dot: string }[] = [
  { value: 'ONLINE', label: '在线', dot: 'status-online' },
  { value: 'BUSY', label: '忙碌', dot: 'status-busy' },
  { value: 'AWAY', label: '离开', dot: 'status-away' },
  { value: 'OFFLINE', label: '离线', dot: 'status-offline' },
];

export const SESSION_STATUS_LABELS: Record<string, string> = {
  WAITING: '等待中',
  ACTIVE: '进行中',
  CLOSED: '已结束',
  REMOVED: '已移除',
};

export function agentApi(token: string) {
  const headers = { 'X-User-Web-Url': USER_WEB_URL };
  return {
    profile: () => apiFetch<AgentProfile>('/agents/me/profile', { token }),
    stats: () => apiFetch<AgentStats>('/agents/me/stats', { token }),
    shareLink: () =>
      apiFetch<ShareLink>('/agents/me/share-link', { token, headers }),
    updateProfile: (data: { name?: string; phone?: string; avatar?: string }) =>
      apiFetch<AgentProfile>('/agents/me/profile', {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      }),
    changePassword: (oldPassword: string, newPassword: string) =>
      apiFetch<{ ok: boolean }>('/agents/me/password', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ oldPassword, newPassword }),
      }),
    updateStatus: (status: AgentStatus) =>
      apiFetch<{ status: AgentStatus }>('/agents/me/status', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      }),
    getUser: (userId: string) =>
      apiFetch<UserDetail>(`/users/${userId}`, { token }),
    visitorTags: () =>
      apiFetch<{ tags: string[] }>('/agents/me/visitor-tags', { token }),
    saveRemark: (userId: string, content: string, tags: string[]) =>
      apiFetch(`/remarks/user/${userId}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ content, tags }),
      }),
  };
}
