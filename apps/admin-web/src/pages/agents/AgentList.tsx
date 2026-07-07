import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Space, Table, Tag, Typography, message, Popconfirm } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi, type AgentItem } from '../../api/client';
import { StatusTag, agentAccountStatusMap, agentRoleMap } from '../../utils/status';

export default function AgentListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname.includes('/online')
    ? 'online'
    : location.pathname.includes('/suspended')
      ? 'suspended'
      : 'all';

  const title =
    mode === 'online' ? '在线客服' : mode === 'suspended' ? '冻结客服' : '全部客服';

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async (p = page, kw = keyword) => {
    setLoading(true);
    try {
      const res = await adminApi.agents({
        page: p,
        limit: 10,
        keyword: kw,
        onlineOnly: mode === 'online' ? 'true' : undefined,
        suspendedOnly: mode === 'suspended' ? 'true' : undefined,
      });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, mode]);

  useEffect(() => { setPage(1); load(1); }, [mode]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>
      </div>

      <Card>
        <Form form={form} layout="inline" onFinish={(v) => { setKeyword(v.keyword ?? ''); setPage(1); load(1, v.keyword ?? ''); }}>
          <Form.Item name="keyword">
            <Input placeholder="搜索姓名 / 邮箱" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">搜索</Button></Form.Item>
        </Form>
      </Card>

      <Card>
        <Table<AgentItem>
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: (p) => { setPage(p); load(p); },
            showTotal: (t) => `共 ${t} 条`,
          }}
          columns={[
            { title: '姓名', dataIndex: 'name' },
            { title: '账号', dataIndex: 'email' },
            { title: '所属企业', render: (_, r) => r.tenant?.name ?? '-' },
            { title: '企业编码', render: (_, r) => r.tenant?.tenantCode ?? '-' },
            { title: '角色', dataIndex: 'role', render: (v) => agentRoleMap[v as keyof typeof agentRoleMap] },
            { title: '账号状态', dataIndex: 'accountStatus', render: (v) => <StatusTag value={v} map={agentAccountStatusMap} /> },
            { title: '在线状态', dataIndex: 'status', render: (v) => <Tag color={v === 'ONLINE' ? 'green' : 'default'}>{v}</Tag> },
            { title: '当前会话', render: (_, r) => r.activeSessionCount ?? 0 },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => dayjs(v).format('YYYY-MM-DD') },
            {
              title: '操作',
              width: 200,
              render: (_, record) => (
                <Space wrap>
                  <Button
                    type="link"
                    size="small"
                    disabled={!record.tenant?.tenantCode}
                    onClick={() => navigate(`/tenants/${record.tenant!.tenantCode}?tab=agents`)}
                  >
                    详情
                  </Button>
                  {record.accountStatus === 'ACTIVE' ? (
                    <Button type="link" size="small" danger onClick={async () => {
                      if (!record.tenant?.tenantCode) return;
                      await adminApi.updateAgent(record.tenant.tenantCode, record.id, { accountStatus: 'SUSPENDED' });
                      message.success('已冻结');
                      load();
                    }}>冻结</Button>
                  ) : (
                    <Button type="link" size="small" onClick={async () => {
                      if (!record.tenant?.tenantCode) return;
                      await adminApi.updateAgent(record.tenant.tenantCode, record.id, { accountStatus: 'ACTIVE' });
                      message.success('已启用');
                      load();
                    }}>启用</Button>
                  )}
                  <Popconfirm
                    title="确认删除？"
                    disabled={(record.activeSessionCount ?? 0) > 0 || !record.tenant?.tenantCode}
                    onConfirm={async () => {
                      await adminApi.deleteAgent(record.tenant!.tenantCode, record.id);
                      message.success('已删除');
                      load();
                    }}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      disabled={(record.activeSessionCount ?? 0) > 0}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
