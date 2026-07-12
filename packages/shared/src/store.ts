import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import {
  API_BASE,
  WS_URL,
  apiFetch,
  uploadFile,
  decodeFileName,
  type AuthState,
  type Conversation,
  type Message,
  type Session,
} from '@cs/shared';
import { setMediaTokenGetter } from './auth-media';
import { useAuthStore } from './auth-store';

interface ChatStore {
  auth: AuthState | null;
  conversation: Conversation | null;
  conversations: Conversation[];
  session: Session | null;
  sessions: Session[];
  messages: Message[];
  messagesPage: number;
  messagesHasMore: boolean;
  messagesLoading: boolean;
  messagesLoadingOlder: boolean;
  messagesFirstItemIndex: number;
  conversationsPage: number;
  conversationsHasMore: boolean;
  conversationsLoadingMore: boolean;
  sendError: string | null;
  socket: Socket | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  unreadByConversation: Record<string, number>;

  initUser: (apiKey: string) => Promise<void>;
  loginAgent: (account: string, password: string, tenantCode: string) => Promise<void>;
  loginTenantAdmin: (account: string, password: string, tenantCode: string) => Promise<void>;
  loginPlatformAdmin: (email: string, password: string) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loadMyConversation: (agentCode?: string) => Promise<void>;
  createSession: (agentCode?: string) => Promise<void>;
  connectWs: () => void;
  disconnectWs: () => void;
  sendMessage: (
    content: string,
    type?: Message['type'],
    fileInfo?: { file_name: string; file_size: number },
  ) => Promise<void>;
  retryFailedMessage: (clientId: string) => Promise<void>;
  sendFile: (file: File) => Promise<void>;
  loadConversationMessages: (conversationId: string, page?: number) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  loadMessages: (sessionId: string, page?: number) => Promise<void>;
  loadConversations: (archived?: boolean, opts?: { append?: boolean }) => Promise<void>;
  loadMoreConversations: (archived?: boolean) => Promise<void>;
  loadAgentSessions: () => Promise<void>;
  assignSession: (sessionId: string) => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  closeSession: (sessionId?: string) => Promise<void>;
  startNewConsultation: (agentCode?: string) => Promise<void>;
  markVisibleMessagesRead: () => void;
  setSession: (session: Session | null) => void;
  logout: () => void;
}

const MESSAGE_PAGE_SIZE = 50;
const CONVERSATION_PAGE_SIZE = 50;
const FIRST_ITEM_INDEX_BASE = 100_000;

const createRandomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getDeviceId = () => {
  const key = 'cs_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `device_${createRandomId()}`;
    localStorage.setItem(key, id);
  }
  return id;
};

const patchConversationSession = (
  conv: Conversation,
  sessionId: string,
  patch: Partial<Session>,
): Conversation => {
  if (conv.currentSession?.id !== sessionId) return conv;
  return {
    ...conv,
    currentSession: { ...conv.currentSession, ...patch },
  };
};

const bumpConversationWithMessage = (
  conversations: Conversation[],
  msg: Message,
): Conversation[] | null => {
  const index = conversations.findIndex(
    (c) =>
      c.currentSession?.id === msg.sessionId ||
      (!!msg.conversationId && c.id === msg.conversationId),
  );
  if (index < 0) return null;

  const prev = conversations[index];
  const updated: Conversation = {
    ...prev,
    lastMessage: msg,
    updatedAt: msg.createdAt,
    currentSession:
      prev.currentSession && prev.currentSession.id !== msg.sessionId
        ? { ...prev.currentSession, id: msg.sessionId }
        : prev.currentSession,
  };
  return [updated, ...conversations.slice(0, index), ...conversations.slice(index + 1)];
};

/** Same WS payload can arrive via session room + agent room + tenant room. */
const handledRealtimeMessageIds = new Set<string>();
function claimRealtimeMessage(id: string): boolean {
  if (handledRealtimeMessageIds.has(id)) return false;
  handledRealtimeMessageIds.add(id);
  if (handledRealtimeMessageIds.size > 500) {
    handledRealtimeMessageIds.clear();
    handledRealtimeMessageIds.add(id);
  }
  return true;
}

let conversationRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAgentConversationRefresh(load: () => void) {
  if (conversationRefreshTimer) clearTimeout(conversationRefreshTimer);
  conversationRefreshTimer = setTimeout(() => {
    conversationRefreshTimer = null;
    load();
  }, 400);
}

export const useChatStore = create<ChatStore>((set, get) => {
  const mergeUnreadFromConversations = (
    items: Conversation[],
    currentConversationId?: string | null,
  ) => {
    const unreadByConversation: Record<string, number> = {};
    for (const item of items) {
      if (item.id === currentConversationId) continue;
      const serverCount = item.unreadCount ?? 0;
      if (serverCount > 0) unreadByConversation[item.id] = serverCount;
    }
    return unreadByConversation;
  };

  const syncAgentOnline = (socket: Socket) => {
    socket.emit('agent_connect', {}, (res: { conversations?: Conversation[]; error?: string }) => {
      if (res?.error) return;
      set((state) => ({
        auth: state.auth ? { ...state.auth, agentStatus: 'ONLINE' } : state.auth,
      }));
    });
    get().loadConversations();
  };

  const rejoinRooms = (socket: Socket) => {
    const state = get();
    const sessionId =
      state.session?.id ?? state.conversation?.currentSession?.id ?? null;
    if (!sessionId) return;
    if (state.auth?.role === 'user') {
      socket.emit('user_connect', { sessionId });
    } else if (state.auth?.role === 'agent') {
      socket.emit('join_session', { sessionId });
    }
  };

  return {
  auth: null,
  conversation: null,
  conversations: [],
  session: null,
  sessions: [],
  messages: [],
  messagesPage: 1,
  messagesHasMore: false,
  messagesLoading: false,
  messagesLoadingOlder: false,
  messagesFirstItemIndex: FIRST_ITEM_INDEX_BASE,
  conversationsPage: 1,
  conversationsHasMore: false,
  conversationsLoadingMore: false,
  sendError: null,
  socket: null,
  connected: false,
  loading: false,
  error: null,
  unreadByConversation: {},

  initUser: async (apiKey) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get('utm_source') ?? undefined;
      const utmMedium = params.get('utm_medium') ?? undefined;
      const utmCampaign = params.get('utm_campaign') ?? undefined;
      const data = await apiFetch<{
        accessToken: string;
        user: {
          id: string;
          nickname: string;
          originalName?: string;
          visitorNo?: number;
          tenantId: string;
          tenantName: string;
        };
      }>('/auth/user/init', {
        method: 'POST',
        body: JSON.stringify({
          apiKey,
          deviceId: getDeviceId(),
          pageUrl: window.location.href,
          referer: document.referrer || undefined,
          source: document.title || '访客页面',
          utmSource,
          utmMedium,
          utmCampaign,
        }),
      });
      set({
        auth: {
          token: data.accessToken,
          role: 'user',
          tenantId: data.user.tenantId,
          userId: data.user.id,
          name: data.user.nickname,
          originalName: data.user.originalName,
          visitorNo: data.user.visitorNo,
        },
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  loginAgent: async (account, password, tenantCode) => {
    await useAuthStore.getState().loginAgent(account, password, tenantCode);
    queueMicrotask(() => {
      get().connectWs();
      get().loadConversations();
    });
  },

  loginTenantAdmin: (account, password, tenantCode) =>
    useAuthStore.getState().loginTenantAdmin(account, password, tenantCode),

  loginPlatformAdmin: (email, password) =>
    useAuthStore.getState().loginPlatformAdmin(email, password),

  loginAdmin: (email, password) =>
    useAuthStore.getState().loginAdmin(email, password),

  loadMyConversation: async (agentCode) => {
    const { auth } = get();
    if (!auth) return;
    try {
      const path = agentCode
        ? `/conversations/me?agentCode=${encodeURIComponent(agentCode)}`
        : '/conversations/me';
      const data = await apiFetch<Conversation & { currentSession: Session | null }>(path, {
        token: auth.token,
      });
      set({
        conversation: data,
        session: data.currentSession ?? null,
        error: null,
      });
      get().connectWs();
      await get().loadConversationMessages(data.id);
      const socket = get().socket;
      const sid = data.currentSession?.id;
      if (socket && sid) {
        socket.emit('user_connect', { sessionId: sid });
      }
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  createSession: async (agentCode) => {
    return get().loadMyConversation(agentCode);
  },

  connectWs: () => {
    const { auth, socket } = get();
    if (!auth) return;

    if (socket?.connected) {
      if (auth.role === 'agent') syncAgentOnline(socket);
      return;
    }

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    void import('socket.io-client').then(({ io }) => {
      if (get().auth?.token !== auth.token) return;

      const s = io(WS_URL, {
        auth: { token: auth.token },
        transports: ['websocket'],
      });

      s.on('connect', () => {
        set({ connected: true });
        if (get().auth?.role === 'agent') syncAgentOnline(s);
        rejoinRooms(s);
      });
      s.on('disconnect', () => set({ connected: false }));

      s.on('read_receipt', (data: { messageId: string; readAt?: string }) => {
        if (!data?.messageId) return;
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === data.messageId
              ? { ...m, readAt: data.readAt ?? new Date().toISOString() }
              : m,
          ),
        }));
      });

    s.on('message', (msg: Message) => {
      if (!msg?.id) return;

      const role = get().auth?.role;
      if (role === 'agent' && !claimRealtimeMessage(msg.id)) {
        return;
      }

      let shouldRefreshUnread = false;
      set((state) => {
        const hasMsg = state.messages.some((m) => m.id === msg.id);

        if (state.auth?.role !== 'agent') {
          return hasMsg ? state : { messages: [...state.messages, msg] };
        }

        if (hasMsg) return state;

        const reordered = bumpConversationWithMessage(state.conversations, msg);
        if (!reordered) {
          shouldRefreshUnread = true;
          return state;
        }

        const convId = reordered[0].id;
        const isActive = state.conversation?.id === convId;
        const activeSessionId =
          state.session?.id ?? state.conversation?.currentSession?.id;
        const sessionChanged =
          isActive && !!activeSessionId && activeSessionId !== msg.sessionId;

        const unreadByConversation = { ...state.unreadByConversation };
        if (msg.senderType === 'USER' && !isActive) {
          // Optimistic +1 once (deduped above); refresh reconciles with server.
          unreadByConversation[convId] = (unreadByConversation[convId] ?? 0) + 1;
          shouldRefreshUnread = true;
        }

        const conversation =
          isActive
            ? {
                ...state.conversation!,
                lastMessage: msg,
                updatedAt: msg.createdAt,
                currentSession: state.conversation!.currentSession
                  ? {
                      ...state.conversation!.currentSession,
                      id: msg.sessionId,
                    }
                  : state.conversation!.currentSession,
              }
            : state.conversation;

        const session =
          isActive && state.session
            ? { ...state.session, id: msg.sessionId }
            : state.session;

        const messages =
          isActive && !hasMsg
            ? [...state.messages, msg]
            : state.messages;

        if (sessionChanged) {
          queueMicrotask(() => {
            get().socket?.emit('join_session', { sessionId: msg.sessionId });
          });
        }

        return {
          messages,
          conversations: reordered,
          conversation,
          session,
          unreadByConversation,
        };
      });

      if (shouldRefreshUnread) {
        scheduleAgentConversationRefresh(() => get().loadConversations());
      }
    });

    s.on('message_deleted', (data: { sessionId?: string; messageId?: string }) => {
      if (!data?.messageId) return;
      let shouldReloadInbox = false;
      set((state) => {
        shouldReloadInbox =
          state.auth?.role === 'agent' &&
          state.conversations.some((c) => c.lastMessage?.id === data.messageId);

        const messages = state.messages.filter((m) => m.id !== data.messageId);
        const patchLast = (c: Conversation | null) => {
          if (!c || c.lastMessage?.id !== data.messageId) return c;
          const fallback =
            [...messages]
              .filter((m) => !data.sessionId || m.sessionId === data.sessionId)
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              )
              .at(-1) ?? null;
          return { ...c, lastMessage: fallback };
        };
        return {
          messages,
          conversation: patchLast(state.conversation),
          conversations: state.conversations.map(
            (c) => patchLast(c) as Conversation,
          ),
        };
      });
      if (shouldReloadInbox) {
        queueMicrotask(() => get().loadConversations());
      }
    });

    s.on('message_updated', (raw: Message & {
      fileName?: string | null;
      fileSize?: number | null;
      file_url?: string;
    }) => {
      if (!raw?.id) return;
      const msg: Message = {
        ...raw,
        file_name: raw.file_name ?? raw.fileName ?? null,
        file_size: raw.file_size ?? raw.fileSize ?? null,
        file_url: raw.file_url ?? (raw.type === 'FILE' ? raw.content : raw.file_url),
      };
      if (msg.file_name && msg.metadata && typeof msg.metadata === 'object') {
        msg.metadata = {
          ...(msg.metadata as Record<string, unknown>),
          file_name: msg.file_name,
          file_size: msg.file_size,
        };
      }
      set((state) => {
        const hasMsg = state.messages.some((m) => m.id === msg.id);
        const messages = hasMsg
          ? state.messages.map((m) =>
              m.id === msg.id
                ? {
                    ...m,
                    ...msg,
                    // Ensure media fields always refresh for Virtuoso/FileCard
                    content: msg.content ?? m.content,
                    file_name: msg.file_name ?? m.file_name,
                    file_size: msg.file_size ?? m.file_size,
                    file_url: msg.file_url ?? msg.content ?? m.file_url,
                    localStatus: undefined,
                  }
                : m,
            )
          : state.messages;
        const patchLast = (c: Conversation | null) => {
          if (!c || c.lastMessage?.id !== msg.id) return c;
          return {
            ...c,
            lastMessage: {
              ...c.lastMessage,
              ...msg,
              file_name: msg.file_name ?? c.lastMessage.file_name,
              file_size: msg.file_size ?? c.lastMessage.file_size,
              file_url: msg.file_url ?? msg.content ?? c.lastMessage.file_url,
            },
            updatedAt: msg.createdAt ?? c.updatedAt,
          };
        };
        return {
          messages,
          conversation: patchLast(state.conversation),
          conversations: state.conversations.map(
            (c) => patchLast(c) as Conversation,
          ),
        };
      });
    });

    s.on('messages_cleared', (data: { sessionId?: string }) => {
      if (!data?.sessionId) return;
      set((state) => {
        const messages = state.messages.filter(
          (m) => m.sessionId !== data.sessionId,
        );
        const patchLast = (c: Conversation | null) => {
          if (!c?.lastMessage || c.lastMessage.sessionId !== data.sessionId) {
            return c;
          }
          return { ...c, lastMessage: null };
        };
        return {
          messages,
          conversation: patchLast(state.conversation),
          conversations: state.conversations.map(
            (c) => patchLast(c) as Conversation,
          ),
        };
      });
      if (get().auth?.role === 'agent') {
        queueMicrotask(() => get().loadConversations());
      }
    });

    s.on('session_resume', (data: { conversationId: string; session: Session }) => {
      set((state) => {
        const conv =
          state.conversation?.id === data.conversationId
            ? { ...state.conversation, currentSession: data.session }
            : state.conversation;
        const conversations = state.conversations.map((c) =>
          c.id === data.conversationId
            ? { ...c, currentSession: data.session }
            : c,
        );
        return {
          conversation: conv,
          conversations,
          session: data.session,
        };
      });
      get().socket?.emit('user_connect', { sessionId: data.session.id });
      if (get().auth?.role === 'agent') get().loadConversations();
    });

    s.on('session_close', (data: {
      sessionId: string;
      conversationId?: string;
      closedBy: 'USER' | 'AGENT' | 'SYSTEM';
      session?: Session;
    }) => {
      const isRemoved = data.session?.status === 'REMOVED';
      set((state) => {
        if (isRemoved) {
          const conversations = state.conversations.filter(
            (c) =>
              c.id !== data.conversationId &&
              c.currentSession?.id !== data.sessionId,
          );
          const conversation =
            state.conversation?.id === data.conversationId ||
            state.conversation?.currentSession?.id === data.sessionId
              ? null
              : state.conversation;
          const session =
            state.session?.id === data.sessionId ? null : state.session;
          return { conversation, conversations, session };
        }
        const closedSession = {
          ...(data.session ?? state.session ?? {}),
          id: data.sessionId,
          status: (data.session?.status ?? 'CLOSED') as Session['status'],
          closedBy: data.closedBy,
        };
        const conversation = state.conversation
          ? patchConversationSession(state.conversation, data.sessionId, closedSession)
          : state.conversation;
        const conversations = state.conversations.map((c) => {
          if (c.currentSession?.id === data.sessionId) {
            return { ...c, currentSession: closedSession as Session };
          }
          return c;
        });
        const session =
          state.session?.id === data.sessionId ? closedSession as Session : state.session;
        return { conversation, conversations, session };
      });
      if (get().auth?.role === 'agent') get().loadConversations();
    });

    s.on('session_assigned', (data: {
      sessionId: string;
      agent?: Session['agent'];
      status?: Session['status'];
    }) => {
      const { auth } = get();
      if (auth?.role === 'agent') {
        get().loadConversations();
        return;
      }
      set((state) => {
        const patch = { agent: data.agent, status: data.status ?? 'ACTIVE' as const };
        const session =
          state.session?.id === data.sessionId
            ? { ...state.session, ...patch, agentId: data.agent?.id }
            : state.session;
        const conversation = state.conversation?.currentSession?.id === data.sessionId
          ? patchConversationSession(state.conversation, data.sessionId, patch)
          : state.conversation;
        return { session, conversation };
      });
    });

    s.on('user_profile_updated', (data: {
      userId: string;
      nickname: string;
      originalName?: string | null;
    }) => {
      set((state) => {
        const patchUser = (u?: { id: string; nickname: string; originalName?: string | null }) =>
          u?.id === data.userId
            ? { ...u, nickname: data.nickname, originalName: data.originalName ?? u.originalName }
            : u;

        const auth =
          state.auth?.userId === data.userId
            ? {
                ...state.auth,
                name: data.nickname,
                originalName: data.originalName ?? state.auth.originalName,
              }
            : state.auth;

        const conversations = state.conversations.map((c) =>
          c.userId === data.userId ? { ...c, user: patchUser(c.user) } : c,
        );

        const conversation =
          state.conversation?.userId === data.userId
            ? { ...state.conversation, user: patchUser(state.conversation.user) }
            : state.conversation;

        return { auth, conversations, conversation };
      });
    });

    s.on('transfer_session', (data: { session: Session }) => {
      set((state) => {
        const session =
          state.session?.id === data.session.id ? data.session : state.session;
        const conversation = state.conversation?.currentSession?.id === data.session.id
          ? { ...state.conversation, currentSession: data.session }
          : state.conversation;
        const conversations = state.conversations.map((c) =>
          c.currentSession?.id === data.session.id
            ? { ...c, currentSession: data.session }
            : c,
        );
        return { session, conversation, conversations };
      });
    });

    set({ socket: s });
    });
  },

  disconnectWs: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false });
  },

  sendMessage: async (content, type = 'TEXT', fileInfo) => {
    const { auth, session, conversation, messages, socket } = get();
    if (!auth) return;
    const sessionId =
      session?.id ??
      conversation?.currentSession?.id ??
      messages[messages.length - 1]?.sessionId;
    if (!sessionId) return;

    const clientId = createRandomId();
    const optimistic: Message = {
      id: `local-${clientId}`,
      clientId,
      sessionId,
      senderType: auth.role === 'agent' ? 'AGENT' : 'USER',
      senderId: auth.userId,
      type,
      content,
      file_name: fileInfo?.file_name,
      file_size: fileInfo?.file_size,
      createdAt: new Date().toISOString(),
      localStatus: 'pending',
    };
    set((state) => ({
      messages: [...state.messages, optimistic],
      sendError: null,
    }));

    const payload = {
      sessionId,
      type,
      content,
      file_name: fileInfo?.file_name,
      file_size: fileInfo?.file_size,
    };

    const applySuccess = (msg: Message, nextSession?: Session) => {
      set((state) => {
        const withoutLocal = state.messages.filter((m) => m.clientId !== clientId);
        const messages = withoutLocal.some((m) => m.id === msg.id)
          ? withoutLocal
          : [...withoutLocal, msg];
        const reordered = bumpConversationWithMessage(state.conversations, msg);
        const convId = reordered?.[0]?.id;
        const conversation =
          convId && state.conversation?.id === convId
            ? {
                ...state.conversation,
                lastMessage: msg,
                updatedAt: msg.createdAt,
                ...(nextSession ? { currentSession: nextSession } : {}),
              }
            : nextSession && state.conversation
              ? { ...state.conversation, currentSession: nextSession }
              : state.conversation;
        return {
          messages,
          conversations: reordered ?? state.conversations,
          conversation,
          session: nextSession ?? state.session,
          sendError: null,
        };
      });
    };

    const applyFailure = (errorMsg: string) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.clientId === clientId ? { ...m, localStatus: 'failed' as const } : m,
        ),
        sendError: errorMsg,
      }));
    };

    if (socket?.connected) {
      socket.emit(
        'message',
        payload,
        (res: { message?: Message; session?: Session; error?: string }) => {
          if (res?.error || !res?.message) {
            applyFailure(res?.error ?? '发送失败');
            return;
          }
          applySuccess(res.message, res.session);
          if (res.session && res.session.id !== sessionId) {
            get().socket?.emit('user_connect', { sessionId: res.session.id });
          }
        },
      );
      return;
    }

    try {
      const result = await apiFetch<{ message: Message; session: Session }>('/messages', {
        method: 'POST',
        token: auth.token,
        body: JSON.stringify(payload),
      });
      applySuccess(result.message, result.session);
    } catch (e) {
      applyFailure((e as Error).message || '发送失败');
    }
  },

  retryFailedMessage: async (clientId) => {
    const failed = get().messages.find(
      (m) => m.clientId === clientId && m.localStatus === 'failed',
    );
    if (!failed) return;
    set((state) => ({
      messages: state.messages.filter((m) => m.clientId !== clientId),
    }));
    await get().sendMessage(failed.content, failed.type, {
      file_name: failed.file_name ?? '',
      file_size: failed.file_size ?? 0,
    });
  },

  sendFile: async (file) => {
    const { auth } = get();
    if (!auth) return;
    try {
      const uploaded = await uploadFile(auth.token, file);
      const type = file.type.startsWith('image/')
        ? 'IMAGE'
        : file.type.startsWith('video/')
          ? 'VIDEO'
          : 'FILE';
      await get().sendMessage(uploaded.url, type as Message['type'], {
        file_name: decodeFileName(file.name) ?? file.name,
        file_size: uploaded.file_size ?? uploaded.size,
      });
    } catch (e) {
      set({ sendError: (e as Error).message || '上传失败' });
    }
  },

  loadConversationMessages: async (conversationId, page = 1) => {
    const { auth } = get();
    if (!auth) return;
    set({ messagesLoading: true });
    try {
      const data = await apiFetch<{ items: Message[]; total: number; page?: number; limit?: number }>(
        `/conversations/${conversationId}/messages?page=${page}&limit=${MESSAGE_PAGE_SIZE}`,
        { token: auth.token },
      );
      const limit = data.limit ?? MESSAGE_PAGE_SIZE;
      const total = data.total ?? data.items.length;
      set({
        messages: data.items,
        messagesPage: page,
        messagesHasMore: page * limit < total,
        messagesFirstItemIndex: FIRST_ITEM_INDEX_BASE,
        messagesLoading: false,
      });
      queueMicrotask(() => get().markVisibleMessagesRead());
    } catch (e) {
      set({ messagesLoading: false, error: (e as Error).message });
    }
  },

  loadOlderMessages: async () => {
    const {
      auth,
      conversation,
      session,
      messagesPage,
      messagesHasMore,
      messagesLoadingOlder,
      messages,
      messagesFirstItemIndex,
    } = get();
    if (!auth || !messagesHasMore || messagesLoadingOlder) return;

    const conversationId = conversation?.id;
    const sessionId = session?.id ?? conversation?.currentSession?.id;
    if (!conversationId && !sessionId) return;

    set({ messagesLoadingOlder: true });
    const nextPage = messagesPage + 1;
    try {
      const path = conversationId
        ? `/conversations/${conversationId}/messages?page=${nextPage}&limit=${MESSAGE_PAGE_SIZE}`
        : `/messages/session/${sessionId}?page=${nextPage}&limit=${MESSAGE_PAGE_SIZE}`;
      const data = await apiFetch<{ items: Message[]; total: number; limit?: number }>(path, {
        token: auth.token,
      });
      const existingIds = new Set(messages.map((m) => m.id));
      const older = data.items.filter((m) => !existingIds.has(m.id));
      const limit = data.limit ?? MESSAGE_PAGE_SIZE;
      const total = data.total ?? 0;
      set({
        messages: older.length ? [...older, ...messages] : messages,
        messagesPage: nextPage,
        // Stop paging if this page contributed nothing (avoids Virtuoso startReached loops).
        messagesHasMore: older.length > 0 && nextPage * limit < total,
        messagesFirstItemIndex:
          older.length > 0 ? messagesFirstItemIndex - older.length : messagesFirstItemIndex,
        messagesLoadingOlder: false,
      });
    } catch {
      set({ messagesLoadingOlder: false });
    }
  },

  loadMessages: async (sessionId, page = 1) => {
    const { auth, conversation } = get();
    if (!auth) return;
    if (conversation?.id) {
      return get().loadConversationMessages(conversation.id, page);
    }
    set({ messagesLoading: true });
    try {
      const data = await apiFetch<{ items: Message[]; total: number; limit?: number }>(
        `/messages/session/${sessionId}?page=${page}&limit=${MESSAGE_PAGE_SIZE}`,
        { token: auth.token },
      );
      const limit = data.limit ?? MESSAGE_PAGE_SIZE;
      const total = data.total ?? data.items.length;
      set({
        messages: data.items,
        messagesPage: page,
        messagesHasMore: page * limit < total,
        messagesFirstItemIndex: FIRST_ITEM_INDEX_BASE,
        messagesLoading: false,
      });
      queueMicrotask(() => get().markVisibleMessagesRead());
    } catch (e) {
      set({ messagesLoading: false, error: (e as Error).message });
    }
  },

  loadConversations: async (archived = false, opts) => {
    const { auth } = get();
    if (!auth) return;
    const append = opts?.append ?? false;
    const page = append ? get().conversationsPage + 1 : 1;
    if (append) set({ conversationsLoadingMore: true });
    const q = archived ? '&archived=1' : '';
    try {
      const data = await apiFetch<{ items: Conversation[]; total?: number; limit?: number }>(
        `/conversations/agent?page=${page}&limit=${CONVERSATION_PAGE_SIZE}${q}`,
        { token: auth.token },
      );
      const limit = data.limit ?? CONVERSATION_PAGE_SIZE;
      const total = data.total ?? data.items.length;
      set((state) => {
        const conversations = append
          ? [
              ...state.conversations,
              ...data.items.filter(
                (item) => !state.conversations.some((c) => c.id === item.id),
              ),
            ]
          : data.items;
        const selectedId = state.conversation?.id;
        const refreshed = selectedId
          ? conversations.find((c) => c.id === selectedId)
          : null;
        const nextSession = refreshed?.currentSession ?? state.session;
        const sessionChanged =
          !!refreshed?.currentSession?.id &&
          refreshed.currentSession.id !==
            (state.session?.id ?? state.conversation?.currentSession?.id);
        if (sessionChanged && refreshed?.currentSession?.id) {
          queueMicrotask(() => {
            get().socket?.emit('join_session', {
              sessionId: refreshed.currentSession!.id,
            });
          });
        }
        return {
          conversations,
          conversationsPage: page,
          conversationsHasMore: page * limit < total,
          conversationsLoadingMore: false,
          unreadByConversation: mergeUnreadFromConversations(
            conversations,
            state.conversation?.id,
          ),
          conversation: refreshed
            ? { ...refreshed, currentSession: refreshed.currentSession }
            : state.conversation,
          session: refreshed ? nextSession : state.session,
        };
      });
    } catch (e) {
      set({ conversationsLoadingMore: false, error: (e as Error).message });
    }
  },

  loadMoreConversations: async (archived = false) => {
    const { conversationsHasMore, conversationsLoadingMore } = get();
    if (!conversationsHasMore || conversationsLoadingMore) return;
    await get().loadConversations(archived, { append: true });
  },

  loadAgentSessions: async () => {
    return get().loadConversations();
  },

  markVisibleMessagesRead: () => {
    const { auth, messages, socket, session, conversation } = get();
    if (!auth || !socket?.connected) return;
    const activeSessionId =
      session?.id ?? conversation?.currentSession?.id ?? null;
    const latestOther = [...messages]
      .reverse()
      .find(
        (m) =>
          !m.localStatus &&
          (!activeSessionId || m.sessionId === activeSessionId) &&
          ((auth.role === 'agent' && m.senderType === 'USER') ||
            (auth.role === 'user' && m.senderType === 'AGENT')),
      );
    if (!latestOther || latestOther.readAt) return;
    socket.emit('read_receipt', {
      messageId: latestOther.id,
      sessionId: latestOther.sessionId,
    });
  },

  assignSession: async (sessionId) => {
    const { auth } = get();
    if (!auth) return;
    const session = await apiFetch<Session>(`/sessions/${sessionId}/assign`, {
      method: 'PATCH',
      token: auth.token,
      body: JSON.stringify({}),
    });
    set({ session });
    get().socket?.emit('join_session', { sessionId });
    const conv = get().conversations.find((c) => c.currentSession?.id === sessionId);
    if (conv) await get().loadConversationMessages(conv.id);
  },

  selectConversation: async (conv) => {
    const { auth } = get();
    if (!auth) return;
    let currentSession = conv.currentSession ?? null;
    const unreadByConversation = { ...get().unreadByConversation };
    delete unreadByConversation[conv.id];
    // Show conversation immediately (important on mobile before assign/messages finish).
    set({
      conversation: { ...conv, currentSession },
      session: currentSession,
      unreadByConversation,
      messages: [],
      messagesPage: 1,
      messagesHasMore: false,
      messagesFirstItemIndex: FIRST_ITEM_INDEX_BASE,
    });
    if (currentSession?.status === 'WAITING') {
      currentSession = await apiFetch<Session>(`/sessions/${currentSession.id}/assign`, {
        method: 'PATCH',
        token: auth.token,
        body: JSON.stringify({}),
      });
      set({
        conversation: { ...conv, currentSession },
        session: currentSession,
      });
    }
    if (currentSession && currentSession.status !== 'CLOSED' && currentSession.status !== 'REMOVED') {
      get().socket?.emit('join_session', { sessionId: currentSession.id });
    }
    await get().loadConversationMessages(conv.id);
    try {
      await apiFetch(`/conversations/${conv.id}/read`, {
        method: 'PATCH',
        token: auth.token,
      });
    } catch {
      // ignore read sync errors
    }
  },

  selectSession: async (sessionId) => {
    const conv = get().conversations.find((c) => c.currentSession?.id === sessionId);
    if (conv) return get().selectConversation(conv);
    const { auth } = get();
    if (!auth) return;
    const session = await apiFetch<Session>(`/sessions/${sessionId}`, {
      token: auth.token,
    });
    set({ session });
    get().socket?.emit('join_session', { sessionId });
    if (session.conversationId) {
      await get().loadConversationMessages(session.conversationId);
    }
  },

  closeSession: async (sessionId) => {
    const { auth, session } = get();
    const id = sessionId ?? session?.id;
    if (!auth || !id) return;
    const result = await apiFetch<{ session: Session }>(
      `/sessions/${id}/close`,
      { method: 'PATCH', token: auth.token },
    );
    set((state) => {
      const conversation = state.conversation
        ? patchConversationSession(state.conversation, id, result.session)
        : state.conversation;
      const conversations = state.conversations.map((c) =>
        c.currentSession?.id === id
          ? { ...c, currentSession: result.session }
          : c,
      );
      const nextSession =
        state.session?.id === id ? result.session : state.session;
      return { conversation, conversations, session: nextSession };
    });
    if (auth.role === 'agent') get().loadConversations();
  },

  startNewConsultation: async (agentCode) => {
    return get().loadMyConversation(agentCode);
  },

  setSession: (session) => set({ session }),

  logout: () => {
    const { auth } = get();
    if (auth?.role === 'agent' && auth.token) {
      void apiFetch('/agents/me/logout', {
        method: 'POST',
        token: auth.token,
      }).catch(() => undefined);
    }
    get().disconnectWs();
    useAuthStore.getState().clearAuth();
    set({
      conversation: null,
      conversations: [],
      session: null,
      sessions: [],
      messages: [],
      messagesPage: 1,
      messagesHasMore: false,
      messagesLoading: false,
      messagesLoadingOlder: false,
      messagesFirstItemIndex: FIRST_ITEM_INDEX_BASE,
      conversationsPage: 1,
      conversationsHasMore: false,
      conversationsLoadingMore: false,
      sendError: null,
      unreadByConversation: {},
    });
  },
};
});

useAuthStore.subscribe((state, prev) => {
  useChatStore.setState({
    auth: state.auth,
    loading: state.loading,
    error: state.error,
  });
  if (prev.auth && !state.auth) {
    const chat = useChatStore.getState();
    chat.socket?.disconnect();
    useChatStore.setState({
      socket: null,
      connected: false,
      conversation: null,
      conversations: [],
      session: null,
      sessions: [],
      messages: [],
      messagesPage: 1,
      messagesHasMore: false,
      conversationsPage: 1,
      conversationsHasMore: false,
      sendError: null,
      unreadByConversation: {},
    });
  }
});

// Hydrate chat store once on boot (subscribe does not fire for initial state).
useChatStore.setState({
  auth: useAuthStore.getState().auth,
});

setMediaTokenGetter(
  () =>
    useChatStore.getState().auth?.token ??
    useAuthStore.getState().auth?.token ??
    null,
);

export { API_BASE };
