import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  API_BASE,
  WS_URL,
  apiFetch,
  uploadFile,
  decodeFileName,
  type AuthState,
  type AgentStatus,
  type Conversation,
  type Message,
  type Session,
  type StaffRole,
} from '@cs/shared';

interface ChatStore {
  auth: AuthState | null;
  conversation: Conversation | null;
  conversations: Conversation[];
  session: Session | null;
  sessions: Session[];
  messages: Message[];
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
  sendFile: (file: File) => Promise<void>;
  loadConversationMessages: (conversationId: string, page?: number) => Promise<void>;
  loadMessages: (sessionId: string, page?: number) => Promise<void>;
  loadConversations: (archived?: boolean) => Promise<void>;
  loadAgentSessions: () => Promise<void>;
  assignSession: (sessionId: string) => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  closeSession: (sessionId?: string) => Promise<void>;
  startNewConsultation: (agentCode?: string) => Promise<void>;
  setSession: (session: Session | null) => void;
  logout: () => void;
}

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
  const index = conversations.findIndex((c) => c.currentSession?.id === msg.sessionId);
  if (index < 0) return null;

  const updated: Conversation = {
    ...conversations[index],
    lastMessage: msg,
    updatedAt: msg.createdAt,
  };
  return [updated, ...conversations.slice(0, index), ...conversations.slice(index + 1)];
};

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

  return {
  auth: null,
  conversation: null,
  conversations: [],
  session: null,
  sessions: [],
  messages: [],
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
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{
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
      queueMicrotask(() => {
        get().connectWs();
        get().loadConversations();
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  loginTenantAdmin: async (account, password, tenantCode) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{
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
      const message = (e as Error).message;
      set({ loading: false, error: message });
      throw e;
    }
  },

  loginPlatformAdmin: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{
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
      const message = (e as Error).message;
      set({ loading: false, error: message });
      throw e;
    }
  },

  loginAdmin: async (email, password) => {
    return get().loginPlatformAdmin(email, password);
  },

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

    const s = io(WS_URL, {
      auth: { token: auth.token },
      transports: ['websocket'],
    });

    s.on('connect', () => {
      set({ connected: true });
      if (get().auth?.role === 'agent') syncAgentOnline(s);
    });
    s.on('disconnect', () => set({ connected: false }));

    s.on('message', (msg: Message) => {
      set((state) => {
        const hasMsg = state.messages.some((m) => m.id === msg.id);

        if (state.auth?.role !== 'agent') {
          return hasMsg ? state : { messages: [...state.messages, msg] };
        }

        // Same message may arrive via session room + agent inbox room.
        if (hasMsg) return state;

        const messages = [...state.messages, msg];
        const reordered = bumpConversationWithMessage(state.conversations, msg);
        if (!reordered) {
          queueMicrotask(() => get().loadConversations());
          return { messages };
        }

        const convId = reordered[0].id;
        const isActive = state.conversation?.id === convId;
        const unreadByConversation = { ...state.unreadByConversation };
        if (msg.senderType === 'USER' && !isActive) {
          unreadByConversation[convId] = (unreadByConversation[convId] ?? 0) + 1;
        }

        const conversation =
          state.conversation?.id === convId
            ? { ...state.conversation, lastMessage: msg, updatedAt: msg.createdAt }
            : state.conversation;

        return {
          messages,
          conversations: reordered,
          conversation,
          unreadByConversation,
        };
      });
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

    const payload = {
      sessionId,
      type,
      content,
      file_name: fileInfo?.file_name,
      file_size: fileInfo?.file_size,
    };

    if (socket?.connected) {
      socket.emit(
        'message',
        payload,
        (res: { message?: Message; session?: Session; error?: string }) => {
          if (res?.message) {
            set((state) => {
              if (state.messages.some((m) => m.id === res.message!.id)) return state;
              const messages = [...state.messages, res.message!];
              const reordered = bumpConversationWithMessage(state.conversations, res.message!);
              if (!reordered) return { messages };
              const convId = reordered[0].id;
              const conversation =
                state.conversation?.id === convId
                  ? {
                      ...state.conversation,
                      lastMessage: res.message!,
                      updatedAt: res.message!.createdAt,
                    }
                  : state.conversation;
              return { messages, conversations: reordered, conversation };
            });
          }
          if (res?.session && res.session.id !== sessionId) {
            set((state) => ({
              session: res.session!,
              conversation: state.conversation
                ? { ...state.conversation, currentSession: res.session! }
                : state.conversation,
            }));
            get().socket?.emit('user_connect', { sessionId: res.session!.id });
          }
        },
      );
    } else {
      const result = await apiFetch<{ message: Message; session: Session }>('/messages', {
        method: 'POST',
        token: auth.token,
        body: JSON.stringify(payload),
      });
      set((state) => ({
        messages: [...state.messages, result.message],
        session: result.session,
        conversation: state.conversation
          ? { ...state.conversation, currentSession: result.session }
          : state.conversation,
      }));
    }
  },

  sendFile: async (file) => {
    const { auth } = get();
    if (!auth) return;
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
  },

  loadConversationMessages: async (conversationId, page = 1) => {
    const { auth } = get();
    if (!auth) return;
    const data = await apiFetch<{ items: Message[] }>(
      `/conversations/${conversationId}/messages?page=${page}&limit=100`,
      { token: auth.token },
    );
    set({ messages: data.items });
  },

  loadMessages: async (sessionId, page = 1) => {
    const { auth, conversation } = get();
    if (!auth) return;
    if (conversation?.id) {
      return get().loadConversationMessages(conversation.id, page);
    }
    const data = await apiFetch<{ items: Message[] }>(
      `/messages/session/${sessionId}?page=${page}&limit=50`,
      { token: auth.token },
    );
    set({ messages: data.items });
  },

  loadConversations: async (archived = false) => {
    const { auth } = get();
    if (!auth) return;
    const q = archived ? '&archived=1' : '';
    const data = await apiFetch<{ items: Conversation[] }>(
      `/conversations/agent?page=1&limit=50${q}`,
      { token: auth.token },
    );
    set((state) => ({
      conversations: data.items,
      unreadByConversation: mergeUnreadFromConversations(
        data.items,
        state.conversation?.id,
      ),
    }));
  },

  loadAgentSessions: async () => {
    return get().loadConversations();
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
    if (currentSession?.status === 'WAITING') {
      currentSession = await apiFetch<Session>(`/sessions/${currentSession.id}/assign`, {
        method: 'PATCH',
        token: auth.token,
        body: JSON.stringify({}),
      });
    }
    const unreadByConversation = { ...get().unreadByConversation };
    delete unreadByConversation[conv.id];
    set({
      conversation: { ...conv, currentSession },
      session: currentSession,
      unreadByConversation,
    });
    if (currentSession) {
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
    set({
      auth: null,
      conversation: null,
      conversations: [],
      session: null,
      sessions: [],
      messages: [],
      unreadByConversation: {},
    });
  },
};
});

export { API_BASE };
