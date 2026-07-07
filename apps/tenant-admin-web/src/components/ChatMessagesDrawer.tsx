import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, DatePicker, Drawer, Form, Input, Pagination, Popconfirm, Select, Space, Spin, message,
} from 'antd';
import { type Dayjs } from 'dayjs';
import { ChatTranscript, type TranscriptMessage } from '@cs/shared';
import { tenantApi } from '../api/client';

export interface ChatUserRef {
  id: string;
  nickname?: string | null;
  visitorNo?: number | null;
}

export interface MessageFilters {
  senderType?: string;
  content?: string;
  startTime?: string;
  endTime?: string;
}

function displayName(user: ChatUserRef) {
  return user.nickname ?? (user.visitorNo ? `访客#${user.visitorNo}` : user.id.slice(0, 8));
}

function toMessageFilters(values: {
  senderType?: string;
  content?: string;
  timeRange?: [Dayjs, Dayjs];
}): MessageFilters {
  return {
    senderType: values.senderType,
    content: values.content?.trim() || undefined,
    startTime: values.timeRange?.[0]?.toISOString(),
    endTime: values.timeRange?.[1]?.toISOString(),
  };
}

interface ChatMessagesDrawerProps {
  open: boolean;
  user?: ChatUserRef | null;
  onClose: () => void;
  onChanged?: () => void;
  allowDeleteMessages?: boolean;
}

export default function ChatMessagesDrawer({
  open,
  user,
  onClose,
  onChanged,
  allowDeleteMessages = false,
}: ChatMessagesDrawerProps) {
  const [form] = Form.useForm();
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [msgPage, setMsgPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<MessageFilters>({});

  const loadMessages = useCallback(async (
    target: ChatUserRef,
    page = 1,
    query: MessageFilters = {},
  ) => {
    setLoading(true);
    try {
      const res = await tenantApi.chatUserMessages(target.id, page, query);
      setMessages(res.messages as TranscriptMessage[]);
      setMsgTotal(res.total);
      setMsgPage(page);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && user) {
      form.resetFields();
      setFilters({});
      loadMessages(user, 1, {});
    } else if (!open) {
      form.resetFields();
      setMessages([]);
      setMsgTotal(0);
      setMsgPage(1);
      setFilters({});
    }
  }, [open, user, loadMessages, form]);

  useEffect(() => {
    if (!loading && messages.length && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, msgPage]);

  const handleSearch = (values: {
    senderType?: string;
    content?: string;
    timeRange?: [Dayjs, Dayjs];
  }) => {
    const next = toMessageFilters(values);
    setFilters(next);
    if (user) loadMessages(user, 1, next);
  };

  const handleReset = () => {
    form.resetFields();
    setFilters({});
    if (user) loadMessages(user, 1, {});
  };

  const deleteMessage = async (messageId: string) => {
    await tenantApi.deleteMessage(messageId);
    message.success('消息已删除');
    if (user) loadMessages(user, msgPage, filters);
    onChanged?.();
  };

  const deleteAllMessages = async () => {
    if (!user) return;
    const res = await tenantApi.deleteChatUserMessages(user.id);
    message.success(`已删除 ${res.deleted} 条消息`);
    onClose();
    onChanged?.();
  };

  return (
    <Drawer
      title={user ? `聊天记录 · ${displayName(user)}` : '聊天记录'}
      open={open}
      onClose={onClose}
      width={480}
      styles={{ body: { padding: 0 } }}
      extra={
        user && allowDeleteMessages ? (
          <Popconfirm title="确定清空该用户所有聊天记录？" onConfirm={deleteAllMessages}>
            <Button danger size="small">清空全部</Button>
          </Popconfirm>
        ) : null
      }
    >
      <div className="chat-transcript-panel">
        <div className="chat-transcript-filters">
          <Form form={form} layout="vertical" onFinish={handleSearch} size="small">
            <Space wrap style={{ width: '100%' }}>
              <Form.Item name="senderType" label="发送方" style={{ marginBottom: 8 }}>
                <Select
                  allowClear
                  placeholder="全部"
                  style={{ width: 120 }}
                  options={[
                    { value: 'USER', label: '访客' },
                    { value: 'AGENT', label: '客服' },
                    { value: 'SYSTEM', label: '系统' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="content" label="内容" style={{ marginBottom: 8 }}>
                <Input placeholder="模糊搜索" allowClear style={{ width: 160 }} />
              </Form.Item>
            </Space>
            <Form.Item name="timeRange" label="时间段" style={{ marginBottom: 8 }}>
              <DatePicker.RangePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" size="small">查询</Button>
              <Button onClick={handleReset} size="small">重置</Button>
            </Space>
          </Form>
        </div>

        <div className="chat-transcript-list" ref={listRef}>
          {loading ? (
            <div className="chat-transcript-empty"><Spin /></div>
          ) : (
            <ChatTranscript
              messages={messages}
              onDelete={allowDeleteMessages ? deleteMessage : undefined}
            />
          )}
        </div>

        {msgTotal > 0 && (
          <div className="chat-transcript-footer">
            <Pagination
              size="small"
              current={msgPage}
              total={msgTotal}
              pageSize={50}
              showSizeChanger={false}
              showTotal={(t) => `共 ${t} 条`}
              onChange={(p) => user && loadMessages(user, p, filters)}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
}
