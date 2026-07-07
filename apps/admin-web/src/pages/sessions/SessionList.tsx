import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button, Card, Form, Input, Popconfirm, Select, Space, Table, Typography, message,
} from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../../api/client';
import ChatMessagesDrawer, { type ChatUserRef } from '../../components/ChatMessagesDrawer';
import { useTenantAgentOptions } from '../../hooks/useTenantAgentOptions';
import { StatusTag, sessionStatusMap } from '../../utils/status';

interface ChatUser extends ChatUserRef {
  messageCount: number;
  sessionCount: number;
  lastMessageAt?: string | null;
  latestSessionStatus?: string | null;
  agentNames?: string | null;
  latestAgentName?: string | null;
  tenantCode?: string;
  tenantName?: string;
  removedAt?: string | null;
  removedByName?: string | null;
}

interface FilterValues {
  tenantCode?: string;
  keyword?: string;
  agentId?: string;
  sessionStatus?: string;
}

export default function SessionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm<FilterValues>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChatUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({});
  const [drawerUser, setDrawerUser] = useState<ChatUserRef | null>(null);
  const {
    tenantOptions,
    agentOptions,
    agentsLoading,
    loadAgents,
  } = useTenantAgentOptions();

  const selectedTenant = Form.useWatch('tenantCode', form);

  useEffect(() => {
    loadAgents(selectedTenant);
    if (!selectedTenant) {
      form.setFieldValue('agentId', undefined);
    }
  }, [selectedTenant, loadAgents, form]);

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true);
    try {
      const res = await adminApi.chatUsers({
        page: p,
        limit: 10,
        keyword: f.keyword,
        tenantCode: f.tenantCode,
        sessionStatus: f.sessionStatus,
        agentId: f.agentId,
      });
      setData(res.items as ChatUser[]);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const userId = searchParams.get('userId');
    if (!userId) return;

    const fromList = data.find((u) => u.id === userId);
    if (fromList) {
      setDrawerUser(fromList);
      return;
    }

    adminApi.chatUserMessages(userId, 1).then((res) => {
      const user = res.user as ChatUserRef;
      if (user) setDrawerUser(user);
    }).catch(() => {
      message.error('用户不存在');
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, data, setSearchParams]);

  const onSearch = (values: FilterValues) => {
    const next: FilterValues = {
      tenantCode: values.tenantCode || undefined,
      keyword: values.keyword?.trim() || undefined,
      agentId: values.agentId || undefined,
      sessionStatus: values.sessionStatus || undefined,
    };
    setFilters(next);
    setPage(1);
    load(1, next);
  };

  const onReset = () => {
    form.resetFields();
    loadAgents(undefined);
    const empty: FilterValues = {};
    setFilters(empty);
    setPage(1);
    load(1, empty);
  };

  const onTenantChange = (tenantCode?: string) => {
    form.setFieldValue('agentId', undefined);
    loadAgents(tenantCode);
  };

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
    const res = await adminApi.deleteChatUserMessages(userId);
    message.success(`已删除 ${res.deleted} 条消息`);
    closeDrawer();
    load();
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>会话管理</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>
      </div>

      <Card>
        <Form form={form} layout="inline" onFinish={onSearch}>
          <Form.Item name="tenantCode">
            <Select
              allowClear
              showSearch
              placeholder="所属租户"
              style={{ width: 200 }}
              optionFilterProp="label"
              options={tenantOptions}
              onChange={onTenantChange}
            />
          </Form.Item>
          <Form.Item name="keyword">
            <Input placeholder="搜索访客昵称 / 编号" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="agentId">
            <Select
              allowClear
              showSearch
              placeholder={selectedTenant ? '对接客服' : '请先选择租户'}
              style={{ width: 220 }}
              optionFilterProp="label"
              options={agentOptions}
              disabled={!selectedTenant}
              loading={agentsLoading}
            />
          </Form.Item>
          <Form.Item name="sessionStatus">
            <Select
              allowClear
              placeholder="会话状态"
              style={{ width: 130 }}
              options={[
                { value: 'WAITING', label: '等待中' },
                { value: 'ACTIVE', label: '进行中' },
                { value: 'CLOSED', label: '已结束' },
                { value: 'REMOVED', label: '已移除' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">搜索</Button>
              <Button onClick={onReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          scroll={{ x: 1500 }}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: (p) => { setPage(p); load(p); },
            showTotal: (t) => `共 ${t} 位访客`,
          }}
          columns={[
            { title: '租户', dataIndex: 'tenantName', width: 120, ellipsis: true },
            { title: '租户代码', dataIndex: 'tenantCode', width: 110, ellipsis: true },
            {
              title: '访客',
              width: 120,
              ellipsis: true,
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
              title: '对接客服',
              dataIndex: 'latestAgentName',
              width: 120,
              ellipsis: true,
              render: (v: string, r) => v || r.agentNames || '-',
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
              ellipsis: true,
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
            {
              title: '操作',
              width: 200,
              fixed: 'right',
              render: (_, r) => (
                <Space wrap size={0}>
                  <Button type="link" size="small" onClick={() => openMessages(r)}>查看记录</Button>
                  <Popconfirm
                    title="确定清空该用户所有聊天记录？"
                    onConfirm={() => deleteAllMessages(r.id)}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>清空</Button>
                  </Popconfirm>
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
      />
    </Space>
  );
}
