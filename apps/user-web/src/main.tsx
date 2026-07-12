import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import { useChatStore } from '@cs/shared/src/store';
import { apiFetch, MessageContent, VirtualMessageList, type Message } from '@cs/shared';
import '@cs/shared/src/styles.css';
import './app.css';

const API_KEY = import.meta.env.VITE_API_KEY ?? 'cs_demo_api_key_12345';

function getAgentCodeFromUrl() {
  return new URLSearchParams(window.location.search).get('agent') ?? undefined;
}

function MessageItem({ msg }: { msg: Message }) {
  if (msg.senderType === 'SYSTEM') {
    return <div className="message-system">{msg.content}</div>;
  }

  const isUser = msg.senderType === 'USER';
  const isMedia = msg.type === 'IMAGE' || msg.type === 'VIDEO';
  const isFile = msg.type === 'FILE';
  const failed = msg.localStatus === 'failed';

  return (
    <div
      className={`message-bubble ${isUser ? 'user' : 'agent'}${isMedia ? ' message-bubble--media' : ''}${isFile ? ' message-bubble--file' : ''}${failed ? ' message-bubble--failed' : ''}`}
    >
      {msg.type === 'IMAGE' || msg.type === 'VIDEO' || msg.type === 'FILE' ? (
        <MessageContent msg={msg} />
      ) : (
        msg.content
      )}
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

function ConversationMessages({
  messages,
  firstItemIndex,
  hasMore,
  loadingOlder,
  onLoadOlder,
}: {
  messages: Message[];
  firstItemIndex: number;
  hasMore: boolean;
  loadingOlder?: boolean;
  onLoadOlder: () => void;
}) {
  return (
    <VirtualMessageList
      className="message-list-virtuoso"
      messages={messages}
      firstItemIndex={firstItemIndex}
      hasMore={hasMore}
      loadingOlder={loadingOlder}
      onLoadOlder={onLoadOlder}
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
}

function App() {
  const {
    auth,
    conversation,
    session,
    messages,
    messagesHasMore,
    messagesLoadingOlder,
    messagesFirstItemIndex,
    sendError,
    connected,
    loading,
    error,
    initUser,
    loadMyConversation,
    loadOlderMessages,
    connectWs,
    sendMessage,
    sendFile,
    closeSession,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [agentCode] = useState(getAgentCodeFromUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSession = session ?? conversation?.currentSession ?? null;
  const isClosed = currentSession?.status === 'CLOSED';
  const canSend = !!conversation && (messages.length > 0 || currentSession);

  useEffect(() => {
    initUser(API_KEY);
  }, [initUser]);

  useEffect(() => {
    if (auth?.name) setNickname(auth.name);
  }, [auth?.name]);

  useEffect(() => {
    if (!auth?.token) return;
    loadMyConversation(agentCode);
  }, [auth?.token, agentCode, loadMyConversation]);

  useEffect(() => {
    if (conversation) connectWs();
  }, [conversation?.id]);

  // Keep layout at layout-viewport height; only pad for keyboard while input focused.
  // Do not listen to visualViewport "scroll" — it fires while scrolling the chat and causes jitter.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const el = document.activeElement;
      const inputFocused =
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const inset = inputFocused
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0;
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${inset > 40 ? inset : 0}px`,
      );
    };
    update();
    vv.addEventListener('resize', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    window.addEventListener('orientationchange', update);
    return () => {
      vv.removeEventListener('resize', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const keepInputFocus = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const preventSendBlur = (e: ReactMouseEvent | ReactTouchEvent) => {
    e.preventDefault();
  };

  const saveNickname = async () => {
    if (!auth || !nickname.trim()) return;
    const updated = await apiFetch<{ nickname: string; originalName?: string }>('/users/me/nickname', {
      method: 'PATCH',
      token: auth.token,
      body: JSON.stringify({ nickname: nickname.trim() }),
    });
    useChatStore.setState((s) => ({
      auth: s.auth
        ? { ...s.auth, name: updated.nickname, originalName: updated.originalName ?? s.auth.originalName }
        : s.auth,
    }));
    setNickname(updated.nickname);
    setEditingName(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !canSend) return;
    const text = input.trim();
    setInput('');
    keepInputFocus();
    await sendMessage(text);
    keepInputFocus();
  };

  const handleEndChat = async () => {
    if (!currentSession || isClosed) return;
    if (!window.confirm('确认结束当前对话？')) return;
    await closeSession(currentSession.id);
  };

  if (loading && !auth) {
    return <div className="login-page">连接中...</div>;
  }

  const originalLabel =
    auth?.originalName && auth.originalName !== auth.name
      ? `（原：${auth.originalName}）`
      : '';

  const statusLabel = !currentSession
    ? messages.length
      ? '已结束'
      : '等待客服'
    : currentSession.status === 'WAITING'
      ? '等待客服'
      : currentSession.status === 'ACTIVE'
        ? '对话中'
        : '已结束';

  return (
    <div className="user-app">
      <header className="user-header">
        <div className="user-header-top">
          <div className="user-header-title">
            <h1>在线客服</h1>
            {agentCode && <span className="agent-hint">专属客服</span>}
          </div>
          <div className="user-header-actions">
            <span className={`badge badge-${(currentSession?.status ?? 'closed').toLowerCase()}`}>
              {statusLabel}
            </span>
            {currentSession && !isClosed && (
              <button type="button" className="end-chat-btn" onClick={handleEndChat}>
                结束
              </button>
            )}
          </div>
        </div>
        <div className="user-header-meta">
          <div className="user-identity">
            {editingName ? (
              <>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="输入昵称"
                />
                <button type="button" onClick={saveNickname}>
                  保存
                </button>
                <button type="button" className="muted-btn" onClick={() => setEditingName(false)}>
                  取消
                </button>
              </>
            ) : (
              <>
                <span className="visitor-name">
                  {auth?.name ?? '访客'}
                  {originalLabel}
                </span>
                <button type="button" className="edit-name-btn" onClick={() => setEditingName(true)}>
                  修改昵称
                </button>
              </>
            )}
          </div>
          <div className="conn-status">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
            {connected ? '已连接' : '连接中...'}
            {currentSession?.agent?.name ? (
              <span className="agent-serving">客服：{currentSession.agent.name}</span>
            ) : currentSession?.status === 'WAITING' ? (
              <span className="agent-waiting">等待接入...</span>
            ) : null}
          </div>
        </div>
      </header>

      {(error || sendError) && <div className="error-banner">{error || sendError}</div>}

      <div className="message-list">
        <ConversationMessages
          messages={messages}
          firstItemIndex={messagesFirstItemIndex}
          hasMore={messagesHasMore}
          loadingOlder={messagesLoadingOlder}
          onLoadOlder={() => void loadOlderMessages()}
        />
      </div>

      {isClosed && (
        <div className="session-ended-panel">
          <p>当前会话已结束。继续输入消息将自动开始新的咨询。</p>
        </div>
      )}

      <div className="chat-input">
        <input
          ref={inputRef}
          type="text"
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="on"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={isClosed ? '输入消息开始新咨询...' : '输入消息...'}
          disabled={!canSend}
        />
        <input
          type="file"
          ref={fileRef}
          hidden
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && canSend) sendFile(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label="发送图片"
          onClick={() => fileRef.current?.click()}
          disabled={!canSend}
        >
          📎
        </button>
        <button
          type="button"
          className="send-btn"
          onMouseDown={preventSendBlur}
          onTouchStart={preventSendBlur}
          onClick={() => void handleSend()}
          disabled={!canSend || !input.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
