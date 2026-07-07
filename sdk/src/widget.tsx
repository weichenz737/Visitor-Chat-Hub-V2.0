import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@cs/shared/src/store';
import type { Message } from '@cs/shared';
import { MessageContent } from '@cs/shared';
import '@cs/shared/src/styles.css';

const API_KEY = import.meta.env.VITE_API_KEY ?? 'cs_demo_api_key_12345';

function MessageItem({ msg }: { msg: Message }) {
  const isUser = msg.senderType === 'USER';
  const isMedia = msg.type === 'IMAGE' || msg.type === 'VIDEO';
  const isFile = msg.type === 'FILE';
  return (
    <div className={`message-bubble ${isUser ? 'user' : 'agent'}${isMedia ? ' message-bubble--media' : ''}${isFile ? ' message-bubble--file' : ''}`}>
      {msg.type === 'IMAGE' || msg.type === 'VIDEO' || msg.type === 'FILE' ? (
        <MessageContent msg={msg} />
      ) : (
        msg.content
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
  const listRef = useRef<HTMLDivElement>(null);

  const {
    auth,
    session,
    messages,
    connected,
    initUser,
    createSession,
    connectWs,
    sendMessage,
    loadMessages,
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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

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
          <div className="message-list" ref={listRef} style={{ flex: 1 }}>
            {messages.map((msg) => (
              <MessageItem key={msg.id} msg={msg} />
            ))}
          </div>
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && input.trim()) {
                  await sendMessage(input.trim());
                  setInput('');
                }
              }}
              placeholder="输入消息..."
            />
            <button
              onClick={async () => {
                if (input.trim()) {
                  await sendMessage(input.trim());
                  setInput('');
                }
              }}
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
