import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { useChatStore } from '@cs/shared/src/store';
import type { Message } from '@cs/shared';
import { MessageContent, VirtualMessageList } from '@cs/shared';
import '@cs/shared/src/styles.css';

const API_KEY = import.meta.env.VITE_API_KEY ?? 'cs_demo_api_key_12345';

function MessageItem({ msg }: { msg: Message }) {
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

export type CSWidgetOptions = {
  slug?: string;
  containerId?: string;
};

export function CSWidget({ apiKey = API_KEY, slug }: { apiKey?: string; slug?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    auth,
    session,
    messages,
    messagesHasMore,
    messagesLoadingOlder,
    messagesFirstItemIndex,
    sendError,
    connected,
    initUser,
    createSession,
    connectWs,
    sendMessage,
    loadMessages,
    loadOlderMessages,
  } = useChatStore();

  useEffect(() => {
    if (open && !auth) initUser(apiKey);
  }, [open, auth, apiKey, initUser]);

  useEffect(() => {
    if (auth && !session && open) createSession();
  }, [auth, session, open, createSession]);

  useEffect(() => {
    if (session && open) {
      connectWs();
      loadMessages(session.id);
    }
  }, [session?.id, open]);

  const keepInputFocus = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const preventSendBlur = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    keepInputFocus();
    await sendMessage(text);
    keepInputFocus();
  };

  return (
    <>
      <button className="widget-fab" onClick={() => setOpen(!open)}>
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div className="widget-panel">
          <div className="widget-header">
            {slug ? `在线客服 · ${slug}` : '在线客服'}
            <span style={{ float: 'right', fontSize: 12, opacity: 0.8 }}>
              {connected ? '● 在线' : '○ 连接中'}
            </span>
          </div>
          {sendError && <div className="error-banner">{sendError}</div>}
          <div className="message-list" style={{ flex: 1, minHeight: 0 }}>
            <VirtualMessageList
              className="message-list-virtuoso"
              messages={messages}
              firstItemIndex={messagesFirstItemIndex}
              hasMore={messagesHasMore}
              loadingOlder={messagesLoadingOlder}
              onLoadOlder={() => void loadOlderMessages()}
              renderMessage={(msg) => <MessageItem msg={msg} />}
            />
          </div>
          <div className="chat-input">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="输入消息..."
            />
            <button
              type="button"
              onMouseDown={preventSendBlur}
              onTouchStart={preventSendBlur}
              onClick={() => void handleSend()}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function init(
  tenantApiKey: string,
  options: CSWidgetOptions | string = 'cs-widget-root',
) {
  const opts: CSWidgetOptions =
    typeof options === 'string' ? { containerId: options } : options;
  const containerId = opts.containerId ?? 'cs-widget-root';
  const el = document.getElementById(containerId);
  if (!el) return;
  import('react-dom/client').then(({ createRoot }) => {
    import('react').then((React) => {
      createRoot(el).render(
        React.createElement(CSWidget, { apiKey: tenantApiKey, slug: opts.slug }),
      );
    });
  });
}
