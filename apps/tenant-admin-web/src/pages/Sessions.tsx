import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button, Card, DatePicker, Form, Input, Popconfirm, Select, Space, Table, Typography, message,
} from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { tenantApi } from '../api/client';
import ChatMessagesDrawer, { type ChatUserRef } from '../components/ChatMessagesDrawer';
import { useTenantAuthorizations } from '../hooks/useTenantAuthorizations';
import { StatusTag, sessionStatusMap } from '../utils/status';

interface AgentOption {
  id: string;
  name: string;
}

interface ChatUser extends ChatUserRef {
  messageCount: number;
  sessionCount: number;
  lastMessageAt?: string | null;
  latestSessionStatus?: string | null;
  latestSessionId?: string | null;
  latestSessionAgentId?: string | null;
  latestAgentName?: string | null;
  agentNames?: string | null;
  removedAt?: string | null;
  removedByName?: string | null;
}

interface FilterValues {
  keyword?: string;
  sessionStatus?: string;
  lastMessageRange?: [Dayjs, Dayjs];
}

export default function SessionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm<FilterValues>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChatUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({});
  const [drawerUser, setDrawerUser] = useState<ChatUserRef | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const { auth } = useTenantAuthorizations();

  useEffect(() => {
    tenantApi.agents({ page: 1, limit: 200, role: 'AGENT' }).then((res) => {
      setAgents(
        res.items.map((a) => ({
          id: String(a.id),
          name: String(a.name ?? a.email),
        })),
      );
    });
  }, []);

  const buildQuery = useCallback((p: number, f: FilterValues) => {
    const query: Record<string, string | number | undefined> = {
      page: p,
      limit: 10,
      keyword: f.keyword,
      sessionStatus: f.sessionStatus,
    };
    if (f.lastMessageRange?.[0]) {
      query.startTime = f.lastMessageRange[0].startOf('day').toISOString();
    }
    if (f.lastMessageRange?.[1]) {
      query.endTime = f.lastMessageRange[1].endOf('day').toISOString();
    }
    return query;
  }, []);

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true);
    try {
      const res = await tenantApi.chatUsers(buildQuery(p, f));
      setData(res.items as ChatUser[]);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, filters, buildQuery]);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const userId = searchParams.get('userId');
    if (!userId) return;

    const fromList = data.find((u) => u.id === userId);
    if (fromList) {
      setDrawerUser(fromList);
      return;
    }

    tenantApi.chatUserMessages(userId, 1).then((res) => {
      const user = res.user as ChatUserRef;
      if (user) setDrawerUser(user);
    }).catch(() => {
      message.error('用户不存在');
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, data, setSearchParams]);

  const openMessages = (user: ChatUserRef) => {
    setDrawerUser(user);
    setSearchParams({ userId: user.id }, { replace: true });
  };

  const closeDrawer = () => {
    setDrawerUser(null);
    if (searchParams.has('userId')) {
      setSearchParams({}, { replace: true });
    }
  };

  const deleteAllMessages = async (userId: string) => {
    const res = await tenantApi.deleteChatUserMessages(userId);
    message.success(`已删除 ${res.deleted} 条消息`);
    closeDrawer();
    load();
  };

  const removeVisitorSession = async (userId: string) => {
    const res = await tenantApi.removeVisitorSession(userId);
    message.success(`已删除 ${res.removed} 个会话`);
    closeDrawer();
    load();
  };

  const transferSession = async (row: ChatUser) => {
    if (!row.latestSessionId) {
      message.warning('暂无可转接的会话');
      return;
    }
    const toAgentId = transferTargets[row.id];
    if (!toAgentId) {
      message.warning('请选择目标客服');
      return;
    }
    if (row.latestSessionAgentId === toAgentId) {
      message.warning('该客服已是当前对接客服');
      return;
    }

    setTransferringId(row.id);
    try {
      await tenantApi.transferSession(row.latestSessionId, toAgentId);
      message.success('转接成功');
      setTransferTargets((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      load();
    } finally {
      setTransferringId(null);
    }
  };

  const canTransfer = (row: ChatUser) =>
    !!row.latestSessionId
    && row.latestSessionStatus !== 'CLOSED'
    && row.latestSessionStatus !== 'REMOVED';

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>会话列表</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>
      </div>

      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={(v) => {
            setFilters(v);
            setPage(1);
            load(1, v);
          }}
        >
          <Form.Item name="keyword">
            <Input placeholder="客户名称" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="sessionStatus">
            <Select
              placeholder="会话状态"
              allowClear
              style={{ width: 120 }}
              options={[
                { value: 'WAITING', label: sessionStatusMap.WAITING.label },
                { value: 'ACTIVE', label: sessionStatusMap.ACTIVE.label },
                { value: 'CLOSED', label: sessionStatusMap.CLOSED.label },
                { value: 'REMOVED', label: sessionStatusMap.REMOVED.label },
              ]}
            />
          </Form.Item>
          <Form.Item name="lastMessageRange">
            <DatePicker.RangePicker placeholder={['最后消息开始', '最后消息结束']} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">搜索</Button></Form.Item>
          <Form.Item>
            <Button
              onClick={() => {
                form.resetFields();
                setFilters({});
                setPage(1);
                load(1, {});
              }}
            >
              重置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: (p) => { setPage(p); load(p); },
            showTotal: (t) => `共 ${t} 位访客`,
          }}
          columns={[
            {
              title: '客户名称',
              render: (_, r) => r.nickname ?? (r.visitorNo ? `访客#${r.visitorNo}` : r.id.slice(0, 8)),
            },
            { title: '会话数', dataIndex: 'sessionCount', width: 80 },
            {
              title: '会话状态',
              dataIndex: 'latestSessionStatus',
              width: 100,
              render: (v: string) => v ? <StatusTag value={v} map={sessionStatusMap} /> : '-',
            },
            {
              title: '最近联系客服',
              dataIndex: 'latestAgentName',
              width: 120,
              render: (v: string) => v || '-',
            },
            {
              title: '对接客服',
              dataIndex: 'agentNames',
              ellipsis: true,
              width: 140,
              render: (v: string) => v || '-',
            },
            { title: '消息数', dataIndex: 'messageCount', width: 80 },
            {
              title: '最后消息时间',
              dataIndex: 'lastMessageAt',
              width: 170,
              render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: '移除人',
              dataIndex: 'removedByName',
              width: 100,
              render: (v: string, r) => r.latestSessionStatus === 'REMOVED' ? (v || '-') : '-',
            },
            {
              title: '移除时间',
              dataIndex: 'removedAt',
              width: 170,
              render: (v: string, r) =>
                r.latestSessionStatus === 'REMOVED' && v
                  ? dayjs(v).format('YYYY-MM-DD HH:mm:ss')
                  : '-',
            },
            ...(auth.allowAdminTransfer ? [{
              title: '转接客服',
              width: 220,
              render: (_: unknown, r: ChatUser) => {
                if (!canTransfer(r)) return '-';
                return (
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      placeholder="选择客服"
                      allowClear
                      style={{ minWidth: 120 }}
                      value={transferTargets[r.id]}
                      onChange={(v) => setTransferTargets((prev) => ({ ...prev, [r.id]: v }))}
                      options={agents
                        .filter((a) => a.id !== r.latestSessionAgentId)
                        .map((a) => ({ value: a.id, label: a.name }))}
                    />
                    <Button
                      type="primary"
                      icon={<SwapOutlined />}
                      loading={transferringId === r.id}
                      onClick={() => transferSession(r)}
                    >
                      转接
                    </Button>
                  </Space.Compact>
                );
              },
            }] : []),
            {
              title: '操作',
              width: 220,
              fixed: 'right',
              render: (_, r) => (
                <Space wrap>
                  <Button type="link" onClick={() => openMessages(r)}>查看聊天记录</Button>
                  {auth.allowDeleteMessages && (
                    <Popconfirm
                      title="确定清空该用户所有聊天记录？"
                      onConfirm={() => deleteAllMessages(r.id)}
                    >
                      <Button type="link" danger icon={<DeleteOutlined />}>清空记录</Button>
                    </Popconfirm>
                  )}
                  {auth.allowDeleteSessions && r.latestSessionStatus !== 'REMOVED' && (
                    <Popconfirm
                      title="确定删除该访客会话？删除后不可恢复"
                      onConfirm={() => removeVisitorSession(r.id)}
                    >
                      <Button type="link" danger>删除会话</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <ChatMessagesDrawer
        open={!!drawerUser}
        user={drawerUser}
        onClose={closeDrawer}
        onChanged={() => load()}
        allowDeleteMessages={auth.allowDeleteMessages}
        allowEditMessages={auth.allowEditMessages}
      />
    </Space>
  );
}
