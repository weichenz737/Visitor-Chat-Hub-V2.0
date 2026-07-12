import { forwardRef, useEffect, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from 'react';
import { useChatStore } from '@cs/shared/src/store';
import {
  apiFetch,
  formatVisitorDisplay,
  getFileDisplayName,
  MessageContent,
  VirtualMessageList,
  type AgentStatus,
  type Conversation,
  type Message,
  type VirtualMessageListHandle,
} from '@cs/shared';
import { AgentHeader } from './AgentHeader';
import { UserPanel } from './UserPanel';
import { SESSION_STATUS_LABELS } from './api';

const MOBILE_MQ = '(max-width: 959px)';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

function formatMessagePreview(msg?: Message | null): string {
  if (!msg) return '暂无消息';
  if (msg.senderType === 'SYSTEM') return msg.content;
  switch (msg.type) {
    case 'IMAGE':
      return '[图片]';
    case 'VIDEO':
      return '[视频]';
    case 'FILE':
      return `[文件] ${getFileDisplayName(msg)}`;
    default:
      return msg.content;
  }
}

function formatMessageTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return isToday
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

type QuickReply = {
  id: string;
  title: string;
  content: string;
  shortcut?: string | null;
  agentId?: string | null;
};

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`qr-collapse ${open ? 'open' : ''}`}>
      <div className="qr-collapse-header">
        <button type="button" className="qr-collapse-toggle" onClick={onToggle}>
          <span className="qr-collapse-arrow" aria-hidden>▸</span>
          <span>{title}</span>
          <span className="qr-collapse-count">{count}</span>
        </button>
        {action}
      </div>
      {open && <div className="qr-collapse-body">{children}</div>}
    </div>
  );
}

function QuickReplyManager({
  auth,
  quickReplies,
  onChange,
}: {
  auth: { token: string; userId: string };
  quickReplies: QuickReply[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [saving, setSaving] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);

  const personal = quickReplies.filter((qr) => qr.agentId === auth.userId);
  const shared = quickReplies.filter((qr) => !qr.agentId);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setShortcut('');
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const body = { title: title.trim(), content: content.trim(), shortcut: shortcut.trim() || undefined };
      if (editing) {
        await apiFetch(`/quick-replies/${editing.id}`, { method: 'PATCH', token: auth.token, body: JSON.stringify(body) });
      } else {
        await apiFetch('/quick-replies', { method: 'POST', token: auth.token, body: JSON.stringify(body) });
      }
      resetForm();
      onChange();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('确认删除该常用语？')) return;
    await apiFetch(`/quick-replies/${id}`, { method: 'DELETE', token: auth.token });
    if (editing?.id === id) resetForm();
    onChange();
  };

  const startEdit = (qr: QuickReply) => {
    setEditing(qr);
    setCreating(false);
    setTitle(qr.title);
    setContent(qr.content);
    setShortcut(qr.shortcut ?? '');
    setPersonalOpen(true);
  };

  return (
    <div className="qr-manager">
      <CollapsibleSection title="我的常用语" count={personal.length} open={personalOpen} onToggle={() => setPersonalOpen((v) => !v)}>
        {(creating || editing) && (
          <div className="qr-form">
            <input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea placeholder="内容" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
            <div className="qr-form-actions">
              <button type="button" onClick={save} disabled={saving}>保存</button>
              <button type="button" className="muted-btn" onClick={resetForm}>取消</button>
            </div>
          </div>
        )}
        <button type="button" className="qr-link-btn" onClick={() => { setPersonalOpen(true); setCreating(true); }}>+ 添加</button>
        <ul className="qr-list qr-list-scroll">
          {personal.map((qr) => (
            <li key={qr.id}>
              <strong>{qr.title}</strong>
              <p>{qr.content}</p>
              <div className="qr-list-actions">
                <button type="button" onClick={() => startEdit(qr)}>编辑</button>
                <button type="button" className="danger-btn" onClick={() => remove(qr.id)}>删除</button>
              </div>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
      <CollapsibleSection title="企业常用语" count={shared.length} open={sharedOpen} onToggle={() => setSharedOpen((v) => !v)}>
        <ul className="qr-list shared">{shared.map((qr) => <li key={qr.id}><strong>{qr.title}</strong><p>{qr.content}</p></li>)}</ul>
      </CollapsibleSection>
    </div>
  );
}

const ConversationMessages = forwardRef<
  VirtualMessageListHandle,
  {
    messages: Message[];
    firstItemIndex: number;
    hasMore: boolean;
    loadingOlder?: boolean;
    onLoadOlder: () => void;
    onAtBottomChange?: (atBottom: boolean) => void;
  }
>(function ConversationMessages(
  { messages, firstItemIndex, hasMore, loadingOlder, onLoadOlder, onAtBottomChange },
  ref,
) {
  return (
    <VirtualMessageList
      ref={ref}
      className="message-list-virtuoso"
      messages={messages}
      firstItemIndex={firstItemIndex}
      hasMore={hasMore}
      loadingOlder={loadingOlder}
      onLoadOlder={onLoadOlder}
      onAtBottomChange={onAtBottomChange}
      renderMessage={(msg, i) => {
        const prev = messages[i - 1];
        const showDivider = prev && prev.sessionId !== msg.sessionId;
        return (
          <>
            {showDivider && <div className="session-divider">本次会话已结束</div>}
            <MessageItem msg={msg} />
          </>
        );
      }}
    />
  );
});

function MessageItem({ msg }: { msg: Message }) {
  if (msg.senderType === 'SYSTEM') {
    return <div className="message-system">{msg.content}</div>;
  }

  const isMine = msg.senderType === 'AGENT';
  const isMedia = msg.type === 'IMAGE' || msg.type === 'VIDEO';
  const isFile = msg.type === 'FILE';
  const failed = msg.localStatus === 'failed';

  return (
    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}${isMedia ? ' message-bubble--media' : ''}${isFile ? ' message-bubble--file' : ''}${failed ? ' message-bubble--failed' : ''}`}>
      {msg.type !== 'TEXT' ? <MessageContent msg={msg} /> : msg.content}
      {failed && msg.clientId && (
        <button
          type="button"
          className="retry-send-btn"
          onClick={() => useChatStore.getState().retryFailedMessage(msg.clientId!)}
        >
          重试
        </button>
      )}
    </div>
  );
}

function TransferBlock({
  allowAgentTransfer,
  transferableAgents,
  transferAgentId,
  setTransferAgentId,
  currentSession,
  authToken,
  onTransferred,
}: {
  allowAgentTransfer: boolean;
  transferableAgents: { id: string; name: string; status?: string }[];
  transferAgentId: string;
  setTransferAgentId: (id: string) => void;
  currentSession: { id: string; status: string } | null;
  authToken: string;
  onTransferred: () => void;
}) {
  if (!allowAgentTransfer) return null;
  return (
    <div className="transfer-block">
      <h3>转接</h3>
      <p className="transfer-hint">
        {transferableAgents.length === 0
          ? '暂无可转接客服（需其他客服账号在线或忙碌，且不能转给自己）'
          : '将会话转给其他在线客服'}
      </p>
      <select value={transferAgentId} onChange={(e) => setTransferAgentId(e.target.value)}>
        <option value="">{transferableAgents.length === 0 ? '暂无其他客服' : '选择客服'}</option>
        {transferableAgents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}{a.status === 'BUSY' ? '（忙碌）' : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={async () => {
          if (!currentSession || !transferAgentId) return;
          await apiFetch('/transfers', {
            method: 'POST',
            token: authToken,
            body: JSON.stringify({ sessionId: currentSession.id, toAgentId: transferAgentId }),
          });
          setTransferAgentId('');
          onTransferred();
        }}
        disabled={!transferAgentId || !currentSession || currentSession.status !== 'ACTIVE'}
        style={{ marginTop: 8, width: '100%' }}
      >
        转接会话
      </button>
    </div>
  );
}

function SessionActions({
  inboxTab,
  currentSession,
  onArchive,
  onUnarchive,
  onRemove,
  onCloseSession,
}: {
  inboxTab: 'active' | 'archived';
  currentSession: { status: string } | null;
  onArchive: () => void;
  onUnarchive: () => void;
  onRemove: () => void;
  onCloseSession: () => void;
}) {
  return (
    <div className="session-actions">
      <h3>会话操作</h3>
      <div className="session-actions-btns">
        {inboxTab === 'active' && (
          <>
            <button type="button" className="toolbar-action-btn" onClick={onArchive}>归档</button>
            <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={onRemove}>删除</button>
          </>
        )}
        {inboxTab === 'archived' && (
          <>
            <button type="button" className="toolbar-action-btn" onClick={onUnarchive}>取消归档</button>
            <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={onRemove}>删除</button>
          </>
        )}
        {currentSession?.status === 'ACTIVE' && (
          <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={onCloseSession}>结束会话</button>
        )}
      </div>
    </div>
  );
}

export default function AgentWorkbench() {
  const {
    auth,
    conversation,
    conversations,
    unreadByConversation,
    session,
    messages,
    messagesHasMore,
    messagesLoadingOlder,
    messagesFirstItemIndex,
    conversationsHasMore,
    conversationsLoadingMore,
    sendError,
    connected,
    connectWs,
    selectConversation,
    loadConversations,
    loadMoreConversations,
    loadOlderMessages,
    sendMessage,
    sendFile,
    closeSession,
    logout,
    disconnectWs,
  } = useChatStore();

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'inbox' | 'chat'>('inbox');
  const [detailOpen, setDetailOpen] = useState(false);
  const [input, setInput] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('ONLINE');
  const [agentName, setAgentName] = useState(auth?.name ?? '');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [transferAgentId, setTransferAgentId] = useState('');
  const [allowAgentTransfer, setAllowAgentTransfer] = useState(true);
  const [onlineAgents, setOnlineAgents] = useState<{ id: string; name: string; status?: string }[]>([]);
  const [inboxTab, setInboxTab] = useState<'active' | 'archived'>('active');
  const [atBottom, setAtBottom] = useState(true);
  const [hasNewWhileAway, setHasNewWhileAway] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<VirtualMessageListHandle>(null);
  const atBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const agentAppRef = useRef<HTMLDivElement>(null);

  const loadQuickReplies = () => {
    if (!auth) return;
    apiFetch<QuickReply[]>('/quick-replies', { token: auth.token }).then(setQuickReplies);
  };

  const loadOnlineAgents = () => {
    if (!auth) return;
    apiFetch<typeof onlineAgents>('/agents/online', { token: auth.token }).then(setOnlineAgents);
  };

  const loadAuthorizations = () => {
    if (!auth) return;
    apiFetch<{ allowAgentTransfer: boolean }>('/agents/me/authorizations', { token: auth.token })
      .then((res) => setAllowAgentTransfer(res.allowAgentTransfer))
      .catch(() => setAllowAgentTransfer(false));
  };

  const transferableAgents = onlineAgents.filter((a) => a.id !== auth?.userId);

  useEffect(() => {
    if (auth?.agentStatus) setAgentStatus(auth.agentStatus);
  }, [auth?.agentStatus]);

  useEffect(() => {
    if (!auth) return;
    loadConversations(inboxTab === 'archived');
  }, [auth?.token, inboxTab]);

  useEffect(() => {
    connectWs();
    if (auth) {
      loadQuickReplies();
      loadAuthorizations();
      if (auth.name) setAgentName(auth.name);
    }
  }, [auth?.token]);

  useEffect(() => {
    if (!connected || !auth) return;

    loadOnlineAgents();

    const socket = useChatStore.getState().socket;
    const onPresence = () => loadOnlineAgents();
    socket?.on('agent_presence', onPresence);

    const timer = window.setInterval(loadOnlineAgents, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadOnlineAgents();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      socket?.off('agent_presence', onPresence);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connected, auth?.token]);

  useEffect(() => {
    if (!isMobile) {
      setDetailOpen(false);
      return;
    }
    if (!conversation) setMobileView('inbox');
  }, [isMobile, conversation]);

  useEffect(() => {
    atBottomRef.current = true;
    setAtBottom(true);
    setHasNewWhileAway(false);
    lastMessageIdRef.current = null;
  }, [conversation?.id]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;
    if (!lastId) {
      lastMessageIdRef.current = null;
      return;
    }
    // Only visitor messages warrant the "有新消息" tip; own/agent sends do not.
    if (
      lastMessageIdRef.current &&
      lastId !== lastMessageIdRef.current &&
      !atBottomRef.current &&
      last.senderType === 'USER'
    ) {
      setHasNewWhileAway(true);
    }
    lastMessageIdRef.current = lastId;
  }, [messages]);

  useEffect(() => {
    if (!isMobile) {
      setKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    // Avoid visualViewport "scroll" — it fires during chat scroll on iOS and jitters layout.
    const update = () => {
      const el = document.activeElement;
      const inputFocused =
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const inset = inputFocused
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0;
      setKeyboardInset(inset > 40 ? inset : 0);
    };
    update();
    vv.addEventListener('resize', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    return () => {
      vv.removeEventListener('resize', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
    };
  }, [isMobile]);

  const handleAtBottomChange = (value: boolean) => {
    atBottomRef.current = value;
    setAtBottom(value);
    if (value) setHasNewWhileAway(false);
  };

  const jumpToLatest = () => {
    listRef.current?.scrollToBottom('smooth');
    setHasNewWhileAway(false);
    atBottomRef.current = true;
    setAtBottom(true);
  };

  const keepInputFocus = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const preventSendBlur = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
  };

  const clearConversation = () => {
    useChatStore.setState({ conversation: null, session: null, messages: [] });
    setSelectedUserId(null);
    setDetailOpen(false);
    if (isMobile) setMobileView('inbox');
  };

  const selectConv = async (conv: Conversation) => {
    // Switch view first so a slow assign/messages request does not block navigation.
    if (isMobile) {
      setMobileView('chat');
      setDetailOpen(false);
    }
    setSelectedUserId(conv.user?.id ?? null);
    try {
      await selectConversation(conv);
    } catch (e) {
      console.error(e);
    }
  };

  const backToInbox = () => {
    setMobileView('inbox');
    setDetailOpen(false);
  };

  const handleCloseSession = async () => {
    const current = session ?? conversation?.currentSession;
    if (!current || current.status === 'CLOSED') return;
    if (!window.confirm('确认结束当前会话？')) return;
    await closeSession(current.id);
    setDetailOpen(false);
  };

  const handleArchive = async () => {
    if (!auth || !conversation) return;
    if (!window.confirm('确认归档该会话？归档后可在「归档」列表中查看。')) return;
    await apiFetch(`/conversations/${conversation.id}/archive`, {
      method: 'PATCH',
      token: auth.token,
    });
    clearConversation();
    await loadConversations(false);
  };

  const handleUnarchive = async () => {
    if (!auth || !conversation) return;
    await apiFetch(`/conversations/${conversation.id}/unarchive`, {
      method: 'PATCH',
      token: auth.token,
    });
    clearConversation();
    await loadConversations(true);
  };

  const handleRemoveConversation = async () => {
    if (!auth || !conversation) return;
    if (!window.confirm('确认删除该会话？删除后企业/平台后台可查看移除记录，且不可恢复。')) return;
    const convId = conversation.id;
    await apiFetch(`/conversations/${convId}`, {
      method: 'DELETE',
      token: auth.token,
    });
    useChatStore.setState((state) => ({
      conversation: null,
      session: null,
      messages: [],
      conversations: state.conversations.filter((c) => c.id !== convId),
    }));
    setSelectedUserId(null);
    setDetailOpen(false);
    if (isMobile) setMobileView('inbox');
    await loadConversations(inboxTab === 'archived');
  };

  const currentSession = session ?? conversation?.currentSession ?? null;
  const isClosed = currentSession?.status === 'CLOSED';
  const canChat = currentSession && !isClosed && currentSession.status === 'ACTIVE';

  const handleSendText = async () => {
    if (!canChat || !input.trim()) return;
    const text = input.trim();
    setInput('');
    jumpToLatest();
    keepInputFocus();
    try {
      await sendMessage(text);
    } finally {
      keepInputFocus();
    }
  };

  const handleLogout = () => {
    disconnectWs();
    logout();
  };

  const handlePasswordChanged = () => handleLogout();

  const visitor = conversation ? formatVisitorDisplay(conversation.user) : null;

  const inboxUnreadTotal = Object.entries(unreadByConversation).reduce((sum, [id, n]) => {
    if (conversation?.id && id === conversation.id) return sum;
    return sum + (n || 0);
  }, 0);

  const panelContent = auth && (
    <>
      <UserPanel token={auth.token} userId={selectedUserId} />
      <QuickReplyManager
        auth={{ token: auth.token, userId: auth.userId }}
        quickReplies={quickReplies}
        onChange={loadQuickReplies}
      />
      <TransferBlock
        allowAgentTransfer={allowAgentTransfer}
        transferableAgents={transferableAgents}
        transferAgentId={transferAgentId}
        setTransferAgentId={setTransferAgentId}
        currentSession={currentSession}
        authToken={auth.token}
        onTransferred={() => {
          const convId = conversation?.id;
          const sessionId = currentSession?.id;
          useChatStore.setState((state) => {
            const conversations = state.conversations.filter(
              (c) =>
                (!convId || c.id !== convId) &&
                (!sessionId || c.currentSession?.id !== sessionId),
            );
            const unreadByConversation = { ...state.unreadByConversation };
            if (convId) delete unreadByConversation[convId];
            return { conversations, unreadByConversation };
          });
          if (sessionId) {
            useChatStore.getState().socket?.emit('leave_session', { sessionId });
          }
          clearConversation();
          void loadConversations(inboxTab === 'archived');
          loadOnlineAgents();
        }}
      />
    </>
  );

  const layoutClass = [
    'chat-layout',
    isMobile ? 'is-mobile' : 'is-desktop',
    isMobile ? `mobile-view-${mobileView}` : '',
    isMobile && detailOpen ? 'detail-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className="agent-app"
      ref={agentAppRef}
      style={isMobile ? { ['--keyboard-inset' as string]: `${keyboardInset}px` } : undefined}
    >
      {auth && (
        <AgentHeader
          token={auth.token}
          name={agentName}
          status={agentStatus}
          connected={connected}
          onStatusChange={setAgentStatus}
          onLogout={handleLogout}
          onPasswordChanged={handlePasswordChanged}
          onProfileUpdated={(p) => { if (p.name) setAgentName(p.name); }}
        />
      )}

      <div className={layoutClass}>
        {(!isMobile || mobileView === 'inbox') && (
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <h2>会话列表</h2>
            <div className="inbox-tabs">
              <button
                type="button"
                className={inboxTab === 'active' ? 'active' : ''}
                onClick={() => {
                  setInboxTab('active');
                  clearConversation();
                }}
              >
                进行中
              </button>
              <button
                type="button"
                className={inboxTab === 'archived' ? 'active' : ''}
                onClick={() => {
                  setInboxTab('archived');
                  clearConversation();
                }}
              >
                归档
              </button>
            </div>
          </div>

          {conversations.map((conv) => {
            const cs = conv.currentSession;
            const status = cs?.status ?? 'CLOSED';
            const unread = unreadByConversation[conv.id] ?? 0;
            const preview = formatMessagePreview(conv.lastMessage);
            const time = formatMessageTime(conv.lastMessage?.createdAt ?? conv.updatedAt);
            const itemVisitor = formatVisitorDisplay(conv.user);

            return (
              <div
                key={conv.id}
                className={`session-item ${conversation?.id === conv.id ? 'active' : ''}${unread > 0 ? ' has-unread' : ''}`}
                onClick={() => void selectConv(conv)}
              >
                <div className="session-item-top">
                  <div className="session-name">
                    {itemVisitor.name}
                    {itemVisitor.originalLabel && (
                      <span className="session-original">{itemVisitor.originalLabel}</span>
                    )}
                  </div>
                  <div className="session-item-right">
                    {time && <span className="session-time">{time}</span>}
                    {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
                  </div>
                </div>
                <div className="session-meta">
                  <span className={`badge badge-${status.toLowerCase()}`}>{SESSION_STATUS_LABELS[status] ?? status}</span>
                  <span className="last-msg">{preview}</span>
                </div>
              </div>
            );
          })}

          {conversationsHasMore && (
            <button
              type="button"
              className="load-more-inbox"
              disabled={conversationsLoadingMore}
              onClick={() => void loadMoreConversations(inboxTab === 'archived')}
            >
              {conversationsLoadingMore ? '加载中…' : '加载更多会话'}
            </button>
          )}
        </aside>
        )}

        {(!isMobile || mobileView === 'chat') && (
        <main className="chat-main">
          {conversation ? (
            <>
              <div className="chat-toolbar desktop-only">
                <div className="chat-toolbar-actions">
                  {inboxTab === 'active' && (
                    <>
                      <button type="button" className="toolbar-action-btn" onClick={() => void handleArchive()}>归档</button>
                      <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={() => void handleRemoveConversation()}>删除</button>
                    </>
                  )}
                  {inboxTab === 'archived' && (
                    <>
                      <button type="button" className="toolbar-action-btn" onClick={() => void handleUnarchive()}>取消归档</button>
                      <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={() => void handleRemoveConversation()}>删除</button>
                    </>
                  )}
                  {currentSession?.status === 'ACTIVE' && (
                    <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={() => void handleCloseSession()}>结束会话</button>
                  )}
                </div>
                {visitor && (
                  <span className="chat-toolbar-title">
                    与 {visitor.name}{visitor.originalLabel} 对话
                  </span>
                )}
              </div>

              <div className="mobile-chat-header mobile-only">
                <button type="button" className="icon-btn back-inbox-btn" aria-label="返回会话列表" onClick={backToInbox}>
                  ←
                  {inboxUnreadTotal > 0 && (
                    <span className="back-unread-badge">{inboxUnreadTotal > 99 ? '99+' : inboxUnreadTotal}</span>
                  )}
                </button>
                <div className="mobile-chat-header-center">
                  <div className="mobile-chat-title">{visitor?.name ?? '会话'}</div>
                  <div className="mobile-chat-sub">
                    {SESSION_STATUS_LABELS[currentSession?.status ?? 'CLOSED'] ?? currentSession?.status ?? ''}
                  </div>
                </div>
                <button type="button" className="pill-btn" onClick={() => setDetailOpen(true)}>更多</button>
              </div>

              {isClosed && (
                <div className="session-ended-banner">当前咨询轮次已结束，访客再次发消息将开启新 Session。历史消息仍可查看。</div>
              )}

              <div className="message-list">
                <ConversationMessages
                  key={conversation.id}
                  ref={listRef}
                  messages={messages}
                  firstItemIndex={messagesFirstItemIndex}
                  hasMore={messagesHasMore}
                  loadingOlder={messagesLoadingOlder}
                  onLoadOlder={() => void loadOlderMessages()}
                  onAtBottomChange={handleAtBottomChange}
                />
              </div>

              {sendError && <div className="error-banner">{sendError}</div>}

              {isMobile && hasNewWhileAway && !atBottom && (
                <button type="button" className="new-message-tip" onClick={jumpToLatest}>
                  有新消息
                </button>
              )}

              <div className="quick-replies">
                {canChat && quickReplies.map((qr) => (
                  <button key={qr.id} type="button" className="qr-btn" onClick={() => setInput(qr.content)}>{qr.title}</button>
                ))}
              </div>

              <div className="chat-input">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSendText();
                    }
                  }}
                  placeholder={isClosed ? '会话已结束' : '输入回复...'}
                  disabled={!canChat}
                />
                <input
                  type="file"
                  ref={fileRef}
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && canChat) {
                      jumpToLatest();
                      void sendFile(f);
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onMouseDown={preventSendBlur}
                  onTouchStart={preventSendBlur}
                  onClick={() => fileRef.current?.click()}
                  disabled={!canChat}
                >
                  📎
                </button>
                <button
                  type="button"
                  onMouseDown={preventSendBlur}
                  onTouchStart={preventSendBlur}
                  onClick={() => void handleSendText()}
                  disabled={!canChat}
                >
                  发送
                </button>
              </div>
            </>
          ) : (
            <>
              {isMobile && (
                <div className="mobile-chat-header mobile-only">
                  <button type="button" className="icon-btn" aria-label="返回会话列表" onClick={backToInbox}>←</button>
                  <div className="mobile-chat-header-center">
                    <div className="mobile-chat-title">加载中…</div>
                  </div>
                </div>
              )}
              <div className="empty-state">选择一个会话开始接待</div>
            </>
          )}
        </main>
        )}

        {!isMobile && (
          <aside className="chat-panel">
            {panelContent}
          </aside>
        )}

        {isMobile && detailOpen && (
          <>
            <div
              className="detail-sheet-mask open"
              onClick={() => setDetailOpen(false)}
            />
            <div
              className="detail-sheet open"
              role="dialog"
              aria-modal="true"
              aria-label="访客与操作"
            >
              <div className="detail-sheet-handle" />
              <div className="detail-sheet-header">
                <h3>访客与操作</h3>
                <button type="button" className="icon-btn" aria-label="关闭" onClick={() => setDetailOpen(false)}>×</button>
              </div>
              <div className="detail-sheet-body">
                {panelContent}
                {conversation && (
                  <SessionActions
                    inboxTab={inboxTab}
                    currentSession={currentSession}
                    onArchive={() => void handleArchive()}
                    onUnarchive={() => void handleUnarchive()}
                    onRemove={() => void handleRemoveConversation()}
                    onCloseSession={() => void handleCloseSession()}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
