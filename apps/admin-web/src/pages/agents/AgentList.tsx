import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Form, Select, Space, Table, Tag, Typography, message, Popconfirm,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi, type AgentItem } from '../../api/client';
import { useTenantAgentOptions } from '../../hooks/useTenantAgentOptions';
import { StatusTag, agentAccountStatusMap, agentRoleMap } from '../../utils/status';

type AgentStatusFilter = '' | 'ONLINE' | 'OFFLINE' | 'ACTIVE' | 'SUSPENDED';

interface FilterValues {
  tenantCode?: string;
  agentId?: string;
  status?: AgentStatusFilter;
}

export default function AgentListPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FilterValues>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({});
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
      const res = await adminApi.agents({
        page: p,
        limit: 10,
        tenantCode: f.tenantCode,
        agentId: f.agentId,
        status: f.status || undefined,
      });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, []);

  const onSearch = (values: FilterValues) => {
    const next = {
      tenantCode: values.tenantCode || undefined,
      agentId: values.agentId || undefined,
      status: values.status || undefined,
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

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>客服管理</Typography.Title>
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
          <Form.Item name="agentId">
            <Select
              allowClear
              showSearch
              placeholder={selectedTenant ? '选择客服' : '请先选择租户'}
              style={{ width: 220 }}
              optionFilterProp="label"
              options={agentOptions}
              disabled={!selectedTenant}
              loading={agentsLoading}
            />
          </Form.Item>
          <Form.Item name="status">
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 140 }}
              options={[
                { value: 'ONLINE', label: '在线' },
                { value: 'OFFLINE', label: '离线' },
                { value: 'ACTIVE', label: '账号启用' },
                { value: 'SUSPENDED', label: '账号冻结' },
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
            { title: '在线状态', dataIndex: 'status', render: (v) => <Tag color={v === 'ONLINE' ? 'green' : 'default'}>{v === 'ONLINE' ? '在线' : '离线'}</Tag> },
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
