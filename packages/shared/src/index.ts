export const API_BASE = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000';

const rawWsUrl = import.meta.env?.VITE_WS_URL ?? 'http://localhost:3000/ws';
export const WS_URL = rawWsUrl.endsWith('/ws')
  ? rawWsUrl
  : `${rawWsUrl.replace(/\/$/, '')}/ws`;

export type UserRole = 'user' | 'agent' | 'tenant_admin' | 'platform_admin';
export type StaffRole = 'TENANT_ADMIN' | 'SUPERVISOR' | 'AGENT';

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';

export interface AuthState {
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
  avatar?: string;
  originalName?: string;
  visitorNo?: number;
}

export interface Session {
  id: string;
  status: 'WAITING' | 'ACTIVE' | 'CLOSED';
  conversationId?: string;
  userId: string;
  agentId?: string | null;
  user?: { id: string; nickname: string };
  agent?: { id: string; name: string };
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  closedBy?: 'USER' | 'AGENT' | 'SYSTEM' | null;
  closedReason?: 'MANUAL' | 'TIMEOUT' | 'DISCONNECT' | null;
}

export interface Conversation {
  id: string;
  userId: string;
  user?: { id: string; nickname: string; originalName?: string | null };
  currentSession?: Session | null;
  lastMessage?: Message | null;
  unreadCount?: number;
  updatedAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  senderType: 'USER' | 'AGENT' | 'SYSTEM';
  senderId?: string | null;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';
  content: string;
  file_url?: string;
  file_name?: string | null;
  file_size?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  readAt?: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  _count?: { agents: number; users: number; sessions: number };
}

export async function apiFetch<T>(
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
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

export function formatVisitorDisplay(user?: {
  nickname?: string | null;
  originalName?: string | null;
}) {
  const name = user?.nickname?.trim() || '访客';
  const original = user?.originalName?.trim();
  const originalLabel =
    original && original !== name ? `（原：${original}）` : '';
  return { name, originalLabel };
}

export { MessageContent, getFileDisplayName, formatFileSize } from './message-content';
export { ChatTranscript, type TranscriptMessage } from './chat-transcript';
export { getFileUrl, getFileSize, decodeFileName, fixFileNameEncoding } from './file-message';

export async function uploadFile(
  token: string,
  file: File,
): Promise<{
  url: string;
  file_url: string;
  filename: string;
  file_name: string;
  size: number;
  file_size: number;
  mimeType: string;
}> {
  const form = new FormData();
  form.append('file', file);
  form.append('file_name', file.name);
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export { useChatStore } from './store';
