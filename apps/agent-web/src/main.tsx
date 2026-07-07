import { StrictMode, useEffect, useRef, useState, Fragment, type ReactNode } from 'react';

import { createRoot } from 'react-dom/client';

import { useChatStore } from '@cs/shared/src/store';

import { apiFetch, formatVisitorDisplay, getFileDisplayName, MessageContent, type AgentStatus, type Conversation, type Message, type Session } from '@cs/shared';

import { AgentHeader } from './AgentHeader';

import { UserPanel } from './UserPanel';

import { SESSION_STATUS_LABELS } from './api';

import '@cs/shared/src/styles.css';

import './app.css';



const TENANT_CODE = import.meta.env.VITE_TENANT_CODE ?? 'demo001';

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



function ConversationMessages({ messages }: { messages: Message[] }) {

  return (

    <>

      {messages.map((msg, i) => {

        const prev = messages[i - 1];

        const showDivider = prev && prev.sessionId !== msg.sessionId;

        return (

          <Fragment key={msg.id}>

            {showDivider && <div className="session-divider">本次会话已结束</div>}

            <MessageItem msg={msg} />

          </Fragment>

        );

      })}

    </>

  );

}



function MessageItem({ msg }: { msg: Message }) {

  if (msg.senderType === 'SYSTEM') {

    return <div className="message-system">{msg.content}</div>;

  }

  const isMine = msg.senderType === 'AGENT';

  const isMedia = msg.type === 'IMAGE' || msg.type === 'VIDEO';
  const isFile = msg.type === 'FILE';

  return (

    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}${isMedia ? ' message-bubble--media' : ''}${isFile ? ' message-bubble--file' : ''}`}>

      {msg.type !== 'TEXT' ? <MessageContent msg={msg} /> : msg.content}

    </div>

  );

}



function LoginPage() {

  const { loginAgent, loading, error } = useChatStore();

  const [account, setAccount] = useState('agent@demo.com');

  const [password, setPassword] = useState('agent123');

  const [tenantCode, setTenantCode] = useState(TENANT_CODE);



  return (

    <div className="login-page">

      <form className="login-form card" onSubmit={(e) => { e.preventDefault(); loginAgent(account, password, tenantCode); }}>

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



function AgentWorkbench() {

  const {

    auth,

    conversation,

    conversations,

    unreadByConversation,

    session,

    messages,

    connected,

    connectWs,

    selectConversation,

    loadConversations,

    sendMessage,

    sendFile,

    closeSession,

    logout,

    disconnectWs,

  } = useChatStore();



  const [input, setInput] = useState('');

  const [agentStatus, setAgentStatus] = useState<AgentStatus>('ONLINE');

  const [agentName, setAgentName] = useState(auth?.name ?? '');

  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [transferAgentId, setTransferAgentId] = useState('');

  const [onlineAgents, setOnlineAgents] = useState<{ id: string; name: string; status?: string }[]>([]);

  const [inboxTab, setInboxTab] = useState<'active' | 'archived'>('active');

  const listRef = useRef<HTMLDivElement>(null);

  const fileRef = useRef<HTMLInputElement>(null);



  const loadQuickReplies = () => {

    if (!auth) return;

    apiFetch<QuickReply[]>('/quick-replies', { token: auth.token }).then(setQuickReplies);

  };



  const loadOnlineAgents = () => {

    if (!auth) return;

    apiFetch<typeof onlineAgents>('/agents/online', { token: auth.token }).then(setOnlineAgents);

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

    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });

  }, [messages]);



  const selectConv = async (conv: Conversation) => {

    await selectConversation(conv);

    setSelectedUserId(conv.user?.id ?? null);

  };



  const handleCloseSession = async () => {

    const current = session ?? conversation?.currentSession;

    if (!current || current.status === 'CLOSED') return;

    if (!window.confirm('确认结束当前会话？')) return;

    await closeSession(current.id);

  };

  const handleArchive = async () => {
    if (!auth || !conversation) return;
    if (!window.confirm('确认归档该会话？归档后可在「归档」列表中查看。')) return;
    await apiFetch(`/conversations/${conversation.id}/archive`, {
      method: 'PATCH',
      token: auth.token,
    });
    useChatStore.setState({ conversation: null, session: null, messages: [] });
    await loadConversations(false);
  };

  const handleUnarchive = async () => {
    if (!auth || !conversation) return;
    await apiFetch(`/conversations/${conversation.id}/unarchive`, {
      method: 'PATCH',
      token: auth.token,
    });
    useChatStore.setState({ conversation: null, session: null, messages: [] });
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
    await loadConversations(inboxTab === 'archived');
  };



  const currentSession = session ?? conversation?.currentSession ?? null;

  const isClosed = currentSession?.status === 'CLOSED';

  const canChat = currentSession && !isClosed && currentSession.status === 'ACTIVE';



  const handleLogout = () => {

    disconnectWs();

    logout();

  };



  const handlePasswordChanged = () => handleLogout();



  return (

    <div className="agent-app">

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

      <div className="chat-layout">

        <aside className="chat-sidebar">

          <div className="sidebar-header">
            <h2>会话列表</h2>
            <div className="inbox-tabs">
              <button
                type="button"
                className={inboxTab === 'active' ? 'active' : ''}
                onClick={() => {
                  setInboxTab('active');
                  useChatStore.setState({ conversation: null, session: null, messages: [] });
                }}
              >
                进行中
              </button>
              <button
                type="button"
                className={inboxTab === 'archived' ? 'active' : ''}
                onClick={() => {
                  setInboxTab('archived');
                  useChatStore.setState({ conversation: null, session: null, messages: [] });
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

            const visitor = formatVisitorDisplay(conv.user);

            return (

            <div key={conv.id} className={`session-item ${conversation?.id === conv.id ? 'active' : ''}${unread > 0 ? ' has-unread' : ''}`} onClick={() => selectConv(conv)}>

              <div className="session-item-top">

                <div className="session-name">
                  {visitor.name}
                  {visitor.originalLabel && (
                    <span className="session-original">{visitor.originalLabel}</span>
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

        </aside>



        <main className="chat-main">

          {conversation ? (

            <>

              <div className="chat-toolbar">

                <div className="chat-toolbar-actions">
                  {conversation && inboxTab === 'active' && (
                    <>
                      <button type="button" className="toolbar-action-btn" onClick={handleArchive}>归档</button>
                      <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={handleRemoveConversation}>删除</button>
                    </>
                  )}

                  {conversation && inboxTab === 'archived' && (
                    <>
                      <button type="button" className="toolbar-action-btn" onClick={handleUnarchive}>取消归档</button>
                      <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={handleRemoveConversation}>删除</button>
                    </>
                  )}

                  {currentSession?.status === 'ACTIVE' && (
                    <button type="button" className="toolbar-action-btn toolbar-action-btn--danger" onClick={handleCloseSession}>结束会话</button>
                  )}
                </div>

                {(() => {
                  const visitor = formatVisitorDisplay(conversation.user);
                  return (
                    <span className="chat-toolbar-title">
                      与 {visitor.name}{visitor.originalLabel} 对话
                    </span>
                  );
                })()}

              </div>

              {isClosed && (

                <div className="session-ended-banner">当前咨询轮次已结束，访客再次发消息将开启新 Session。历史消息仍可查看。</div>

              )}

              <div className="message-list" ref={listRef}>

                <ConversationMessages messages={messages} />

              </div>

              <div className="quick-replies">

                {canChat && quickReplies.map((qr) => (

                  <button key={qr.id} className="qr-btn" onClick={() => setInput(qr.content)}>{qr.title}</button>

                ))}

              </div>

              <div className="chat-input">

                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canChat && sendMessage(input.trim()).then(() => setInput(''))} placeholder={isClosed ? '会话已结束' : '输入回复...'} disabled={!canChat} />

                <input type="file" ref={fileRef} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && canChat) sendFile(f); e.target.value = ''; }} />

                <button onClick={() => fileRef.current?.click()} disabled={!canChat}>📎</button>

                <button onClick={() => { if (canChat && input.trim()) sendMessage(input.trim()).then(() => setInput('')); }} disabled={!canChat}>发送</button>

              </div>

            </>

          ) : (

            <div className="empty-state">选择一个会话开始接待</div>

          )}

        </main>



        <aside className="chat-panel">

          {auth && <UserPanel token={auth.token} userId={selectedUserId} />}

          {auth && <QuickReplyManager auth={{ token: auth.token, userId: auth.userId }} quickReplies={quickReplies} onChange={loadQuickReplies} />}

          <h3 style={{ marginTop: 16 }}>转接</h3>

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

            onClick={async () => {

              if (!auth || !currentSession || !transferAgentId) return;

              await apiFetch('/transfers', { method: 'POST', token: auth.token, body: JSON.stringify({ sessionId: currentSession.id, toAgentId: transferAgentId }) });

              setTransferAgentId('');

              loadConversations();

              loadOnlineAgents();

            }}

            disabled={!transferAgentId || !currentSession || currentSession.status !== 'ACTIVE'}

            style={{ marginTop: 8, width: '100%' }}

          >转接会话</button>

        </aside>

      </div>

    </div>

  );

}



function App() {

  const { auth, logout } = useChatStore();

  useEffect(() => {

    if (auth && auth.role !== 'agent') logout();

  }, [auth, logout]);

  return auth?.role === 'agent' ? <AgentWorkbench /> : <LoginPage />;

}



createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

