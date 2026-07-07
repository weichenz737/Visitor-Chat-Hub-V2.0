import { Fragment } from 'react';
import type { Message } from './index';
import { MessageContent } from './message-content';
import './chat-transcript.css';

export interface TranscriptMessage {
  id: string;
  sessionId?: string;
  senderType: string;
  senderName?: string;
  type: string;
  content: string;
  fileName?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toMessage(msg: TranscriptMessage): Message {
  return {
    id: msg.id,
    sessionId: msg.sessionId ?? '',
    senderType: msg.senderType as Message['senderType'],
    type: msg.type as Message['type'],
    content: msg.content,
    file_name: msg.fileName,
    file_size: msg.fileSize,
    createdAt: msg.createdAt,
  };
}

function TranscriptBubble({ msg }: { msg: TranscriptMessage }) {
  if (msg.senderType === 'SYSTEM') {
    return <div className="message-system">{msg.content}</div>;
  }

  const isUser = msg.senderType === 'USER';
  const isMedia = msg.type === 'IMAGE' || msg.type === 'VIDEO';
  const isFile = msg.type === 'FILE';
  const bubbleMsg = toMessage(msg);

  return (
    <div
      className={`message-bubble ${isUser ? 'user' : 'agent'}${isMedia ? ' message-bubble--media' : ''}${isFile ? ' message-bubble--file' : ''}`}
    >
      {msg.type === 'TEXT' ? msg.content : <MessageContent msg={bubbleMsg} />}
    </div>
  );
}

export interface ChatTranscriptProps {
  messages: TranscriptMessage[];
  onDelete?: (messageId: string) => void;
  onEdit?: (message: TranscriptMessage) => void;
  emptyText?: string;
}

export function ChatTranscript({
  messages,
  onDelete,
  onEdit,
  emptyText = '暂无消息',
}: ChatTranscriptProps) {
  if (!messages.length) {
    return <div className="chat-transcript-empty">{emptyText}</div>;
  }

  const chronological = [...messages].reverse();

  return (
    <>
      {chronological.map((msg, i) => {
        const prev = chronological[i - 1];
        const showDivider =
          !!prev?.sessionId && !!msg.sessionId && prev.sessionId !== msg.sessionId;
        const isUser = msg.senderType === 'USER';
        const isAgent = msg.senderType === 'AGENT';
        const rowClass = msg.senderType === 'SYSTEM'
          ? 'is-system'
          : isUser
            ? 'is-user'
            : 'is-agent';

        return (
          <Fragment key={msg.id}>
            {showDivider && <div className="session-divider">本次会话已结束</div>}
            {msg.senderType === 'SYSTEM' ? (
              <div className="chat-transcript-row is-system">
                <div className="chat-transcript-meta chat-transcript-meta--system">
                  <span className="chat-transcript-time">{formatTime(msg.createdAt)}</span>
                  {onEdit && (
                    <button type="button" className="chat-transcript-edit" onClick={() => onEdit(msg)}>
                      编辑
                    </button>
                  )}
                </div>
                <TranscriptBubble msg={msg} />
              </div>
            ) : (
              <div className={`chat-transcript-row ${rowClass}`}>
                <div className="chat-transcript-meta">
                  <span className="chat-transcript-name">
                    {msg.senderName ?? (isUser ? '访客' : isAgent ? '客服' : msg.senderType)}
                  </span>
                  <span className="chat-transcript-time">
                    {formatTime(msg.createdAt)}
                  </span>
                  {onEdit && (
                    <button
                      type="button"
                      className="chat-transcript-edit"
                      onClick={() => onEdit(msg)}
                    >
                      编辑
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="chat-transcript-delete"
                      onClick={() => {
                        if (window.confirm('确定删除此消息？')) onDelete(msg.id);
                      }}
                    >
                      删除
                    </button>
                  )}
                </div>
                <TranscriptBubble msg={msg} />
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
