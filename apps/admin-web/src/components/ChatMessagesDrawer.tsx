import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, DatePicker, Drawer, Form, Input, Modal, Pagination, Popconfirm, Select, Space, Spin, Upload, message,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { type Dayjs } from 'dayjs';
import { ChatTranscript, MessageContent, type TranscriptMessage, type Message } from '@cs/shared';
import { adminApi } from '../api/client';

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

function toPreviewMessage(msg: TranscriptMessage): Message {
  return {
    id: msg.id,
    sessionId: msg.sessionId ?? '',
    senderType: msg.senderType as Message['senderType'],
    type: msg.type as Message['type'],
    content: msg.content,
    file_url: msg.content,
    file_name: msg.file_name ?? msg.fileName,
    file_size: msg.file_size ?? msg.fileSize,
    createdAt: msg.createdAt,
  };
}

function uploadAccept(type: string) {
  if (type === 'IMAGE') return 'image/jpeg,image/png,image/gif,image/webp';
  if (type === 'VIDEO') return 'video/mp4,video/webm,video/quicktime';
  return undefined;
}

interface ChatMessagesDrawerProps {
  open: boolean;
  user?: ChatUserRef | null;
  onClose: () => void;
  onChanged?: () => void;
}

export default function ChatMessagesDrawer({
  open,
  user,
  onClose,
  onChanged,
}: ChatMessagesDrawerProps) {
  const [form] = Form.useForm();
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [msgPage, setMsgPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<MessageFilters>({});
  const [editForm] = Form.useForm();
  const [editing, setEditing] = useState<TranscriptMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);

  const loadMessages = useCallback(async (
    target: ChatUserRef,
    page = 1,
    query: MessageFilters = {},
  ) => {
    setLoading(true);
    try {
      const res = await adminApi.chatUserMessages(target.id, page, query);
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
    await adminApi.deleteMessage(messageId);
    message.success('消息已删除');
    if (user) loadMessages(user, msgPage, filters);
    onChanged?.();
  };

  const closeEdit = () => {
    setEditing(null);
    pendingFileRef.current = null;
    setPendingFile(null);
    setFileList([]);
    editForm.resetFields();
  };

  const openEdit = (msg: TranscriptMessage) => {
    setEditing(msg);
    pendingFileRef.current = null;
    setPendingFile(null);
    setFileList([]);
    editForm.setFieldsValue({
      content: msg.content,
      fileName: msg.fileName ?? msg.file_name ?? '',
    });
  };

  const resolvePendingFile = (): File | null => {
    if (pendingFileRef.current) return pendingFileRef.current;
    if (pendingFile) return pendingFile;
    const fromList = fileList[0]?.originFileObj;
    return fromList ?? null;
  };

  const submitEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.type === 'TEXT' || editing.type === 'SYSTEM') {
        const values = await editForm.validateFields(['content']);
        await adminApi.updateMessage(editing.id, { content: values.content });
      } else if (editing.type === 'IMAGE' || editing.type === 'VIDEO') {
        const file = resolvePendingFile();
        if (!file) {
          message.warning(editing.type === 'IMAGE' ? '请选择新图片' : '请选择新视频');
          throw new Error('missing file');
        }
        await adminApi.replaceMessageMedia(editing.id, file);
      } else if (editing.type === 'FILE') {
        const values = await editForm.validateFields(['fileName']);
        const file = resolvePendingFile();
        if (file) {
          await adminApi.replaceMessageMedia(editing.id, file, values.fileName);
        } else if (fileList.length > 0) {
          message.error('未能读取所选文件，请重新选择后再保存');
          throw new Error('missing file');
        } else {
          const nextName = String(values.fileName ?? '').trim();
          const prevName = (editing.fileName ?? editing.file_name ?? '').trim();
          if (!nextName) {
            message.warning('请输入文件名称');
            throw new Error('missing file name');
          }
          if (nextName === prevName) {
            message.info('文件名称未修改');
            throw new Error('unchanged');
          }
          await adminApi.updateMessage(editing.id, { fileName: nextName });
        }
      } else {
        message.error('不支持编辑该类型消息');
        throw new Error('unsupported');
      }
      message.success('消息已更新');
      closeEdit();
      if (user) await loadMessages(user, msgPage, filters);
      onChanged?.();
    } catch (e) {
      if (
        e instanceof Error &&
        ['missing file', 'missing file name', 'unchanged', 'unsupported'].includes(e.message)
      ) {
        return;
      }
      // request() already toasts API errors
    } finally {
      setSaving(false);
    }
  };

  const deleteAllMessages = async () => {
    if (!user) return;
    const res = await adminApi.deleteChatUserMessages(user.id);
    message.success(`已删除 ${res.deleted} 条消息`);
    onClose();
    onChanged?.();
  };

  const isMediaEdit =
    editing?.type === 'IMAGE' || editing?.type === 'VIDEO' || editing?.type === 'FILE';
  const requireNewFile = editing?.type === 'IMAGE' || editing?.type === 'VIDEO';

  return (
    <Drawer
      title={user ? `聊天记录 · ${displayName(user)}` : '聊天记录'}
      open={open}
      onClose={onClose}
      width={480}
      styles={{ body: { padding: 0 } }}
      extra={
        user ? (
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
              onDelete={deleteMessage}
              onEdit={openEdit}
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

      <Modal
        title="编辑消息"
        open={!!editing}
        onCancel={closeEdit}
        onOk={submitEdit}
        confirmLoading={saving}
        okButtonProps={{ disabled: requireNewFile && !pendingFile && fileList.length === 0 }}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          {(editing?.type === 'TEXT' || editing?.type === 'SYSTEM') && (
            <Form.Item
              name="content"
              label="消息内容"
              rules={[{ required: true, message: '请输入消息内容' }]}
            >
              <Input.TextArea rows={4} maxLength={2000} showCount />
            </Form.Item>
          )}

          {isMediaEdit && editing && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)' }}>当前内容</div>
                <div className="chat-transcript-list" style={{ maxHeight: 220, overflow: 'auto' }}>
                  <MessageContent msg={toPreviewMessage(editing)} />
                </div>
              </div>

              {editing.type === 'FILE' && (
                <Form.Item
                  name="fileName"
                  label="文件名称"
                  rules={[{ required: true, message: '请输入文件名称' }]}
                >
                  <Input maxLength={255} />
                </Form.Item>
              )}

              <Form.Item
                label={
                  editing.type === 'IMAGE'
                    ? '替换图片'
                    : editing.type === 'VIDEO'
                      ? '替换视频'
                      : '替换文件（可选）'
                }
                required={requireNewFile}
                extra={
                  requireNewFile
                    ? '必须上传新文件后才能保存'
                    : '不上传则仅更新显示名称'
                }
              >
                <Upload
                  accept={uploadAccept(editing.type)}
                  maxCount={1}
                  fileList={fileList}
                  beforeUpload={(file) => {
                    pendingFileRef.current = file;
                    setPendingFile(file);
                    setFileList([
                      {
                        uid: file.uid,
                        name: file.name,
                        status: 'done',
                        size: file.size,
                        type: file.type,
                        originFileObj: file,
                      },
                    ]);
                    if (editing.type === 'FILE') {
                      editForm.setFieldsValue({ fileName: file.name });
                    }
                    return false;
                  }}
                  onRemove={() => {
                    pendingFileRef.current = null;
                    setPendingFile(null);
                    setFileList([]);
                  }}
                >
                  <Button icon={<UploadOutlined />}>选择文件</Button>
                </Upload>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Drawer>
  );
}
