import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { Message } from './index';

export type VirtualMessageListHandle = {
  scrollToBottom: (behavior?: 'auto' | 'smooth') => void;
};

export type VirtualMessageListProps = {
  messages: Message[];
  firstItemIndex: number;
  hasMore: boolean;
  loadingOlder?: boolean;
  onLoadOlder: () => void;
  renderMessage: (msg: Message, index: number) => ReactNode;
  className?: string;
  style?: CSSProperties;
  onAtBottomChange?: (atBottom: boolean) => void;
};

export const VirtualMessageList = forwardRef<VirtualMessageListHandle, VirtualMessageListProps>(
  function VirtualMessageList(
    {
      messages,
      firstItemIndex,
      hasMore,
      loadingOlder,
      onLoadOlder,
      renderMessage,
      className,
      style,
      onAtBottomChange,
    },
    ref,
  ) {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const lockRef = useRef(false);
    const atBottomRef = useRef(true);
    const didInitialScrollRef = useRef(false);
    const settleTimersRef = useRef<number[]>([]);
    const messagesRef = useRef(messages);
    const firstItemIndexRef = useRef(firstItemIndex);
    const onAtBottomChangeRef = useRef(onAtBottomChange);
    messagesRef.current = messages;
    firstItemIndexRef.current = firstItemIndex;
    onAtBottomChangeRef.current = onAtBottomChange;

    const clearSettleTimers = () => {
      for (const id of settleTimersRef.current) window.clearTimeout(id);
      settleTimersRef.current = [];
    };

    const scrollToEnd = (behavior: 'auto' | 'smooth' = 'auto', force = false) => {
      if (!force && !atBottomRef.current) return;
      const list = messagesRef.current;
      if (list.length === 0) return;
      const index = firstItemIndexRef.current + list.length - 1;
      virtuosoRef.current?.scrollToIndex({
        index,
        align: 'end',
        behavior,
      });
      atBottomRef.current = true;
      onAtBottomChangeRef.current?.(true);
    };

    useImperativeHandle(ref, () => ({
      scrollToBottom: (behavior: 'auto' | 'smooth' = 'smooth') => {
        scrollToEnd(behavior, true);
      },
    }));

    useEffect(() => {
      if (messages.length === 0) {
        didInitialScrollRef.current = false;
        clearSettleTimers();
        atBottomRef.current = true;
      }
    }, [messages.length]);

    // First paint: align to latest a few times for image height, but stop if user scrolls away.
    useEffect(() => {
      if (messages.length === 0 || didInitialScrollRef.current) return;
      didInitialScrollRef.current = true;
      atBottomRef.current = true;
      clearSettleTimers();
      const run = () => scrollToEnd('auto');
      requestAnimationFrame(run);
      settleTimersRef.current = [
        window.setTimeout(run, 120),
        window.setTimeout(run, 400),
        window.setTimeout(run, 800),
      ];
      return () => clearSettleTimers();
    }, [messages.length, firstItemIndex]);

    // Media height changes: only re-pin when still at bottom (never fight upward scroll).
    useEffect(() => {
      const onMedia = () => {
        if (!atBottomRef.current) return;
        requestAnimationFrame(() => scrollToEnd('auto'));
      };
      window.addEventListener('cs-chat-media-loaded', onMedia);
      return () => window.removeEventListener('cs-chat-media-loaded', onMedia);
    }, []);

    return (
      <Virtuoso
        ref={virtuosoRef}
        className={className}
        style={{ height: '100%', ...style }}
        data={messages}
        computeItemKey={(_index, msg) => msg.id}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={{
          index: Math.max(0, messages.length - 1),
          align: 'end',
        }}
        followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
        atBottomStateChange={(atBottom) => {
          atBottomRef.current = atBottom;
          if (!atBottom) clearSettleTimers();
          onAtBottomChangeRef.current?.(atBottom);
        }}
        atBottomThreshold={48}
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
  },
);
