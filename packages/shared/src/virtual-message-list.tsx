import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { Message } from './index';

export type VirtualMessageListProps = {
  messages: Message[];
  firstItemIndex: number;
  hasMore: boolean;
  loadingOlder?: boolean;
  onLoadOlder: () => void;
  renderMessage: (msg: Message, index: number) => ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function VirtualMessageList({
  messages,
  firstItemIndex,
  hasMore,
  loadingOlder,
  onLoadOlder,
  renderMessage,
  className,
  style,
}: VirtualMessageListProps) {
  const lockRef = useRef(false);

  return (
    <Virtuoso
      className={className}
      style={{ height: '100%', ...style }}
      data={messages}
      computeItemKey={(_index, msg) => msg.id}
      firstItemIndex={firstItemIndex}
      initialTopMostItemIndex={Math.max(0, messages.length - 1)}
      followOutput="smooth"
      startReached={() => {
        if (!hasMore || loadingOlder || messages.length === 0 || lockRef.current) return;
        lockRef.current = true;
        void Promise.resolve(onLoadOlder()).finally(() => {
          window.setTimeout(() => {
            lockRef.current = false;
          }, 400);
        });
      }}
      increaseViewportBy={{ top: 200, bottom: 200 }}
      itemContent={(index, msg) => {
        const localIndex = index - firstItemIndex;
        return (
          <div className="message-item-wrap">{renderMessage(msg, localIndex)}</div>
        );
      }}
      components={{
        Header: () =>
          loadingOlder ? (
            <div className="messages-loading-older">加载更早消息…</div>
          ) : hasMore ? (
            <div className="messages-load-hint">上滑加载更早消息</div>
          ) : null,
      }}
    />
  );
}
