import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, message, Typography,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi, type TenantItem } from '../../api/client';
import { StatusTag, tenantStatusMap } from '../../utils/status';
import { accountRules } from '../../utils/account';
import { tenantCodeRules, slugRules } from '../../utils/tenant';

const { Text } = Typography;

export default function TenantListPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TenantItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (p = page, kw = keyword, st = status) => {
    setLoading(true);
    try {
      const res = await adminApi.tenants({ page: p, limit: 10, keyword: kw, status: st });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, status]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    await adminApi.createTenant(values);
    message.success('租户创建成功');
    setCreateOpen(false);
    createForm.resetFields();
    load(1);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>租户管理</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新增租户
          </Button>
        </Space>
      </div>

      <Card>
        <Form form={form} layout="inline" onFinish={(v) => {
          setKeyword(v.keyword ?? '');
          setStatus(v.status);
          setPage(1);
          load(1, v.keyword ?? '', v.status);
        }}>
          <Form.Item name="keyword">
            <Input placeholder="搜索企业名称 / 企业编码 / Slug / 管理员" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="status">
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 120 }}
              options={[
                { value: 'ACTIVE', label: '启用' },
                { value: 'SUSPENDED', label: '冻结' },
                { value: 'DISABLED', label: '已停用' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">搜索</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table<TenantItem>
          rowKey="tenantCode"
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
            { title: '企业名称', dataIndex: 'name', sorter: true },
            {
              title: '企业编码',
              dataIndex: 'tenantCode',
              render: (code: string) => <Text copyable code>{code}</Text>,
            },
            { title: 'Slug', dataIndex: 'slug' },
            { title: '管理员账号', dataIndex: 'adminEmail' },
            { title: '状态', dataIndex: 'status', render: (v) => <StatusTag value={v} map={tenantStatusMap} /> },
            { title: '客服数', render: (_, r) => r._count?.agents ?? 0 },
            { title: '用户数', render: (_, r) => r._count?.users ?? 0 },
            { title: '会话数', render: (_, r) => r._count?.sessions ?? 0 },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
            {
              title: '操作',
              width: 220,
              render: (_, record) => (
                <Space wrap>
                  <Button type="link" size="small" onClick={() => navigate(`/tenants/${record.tenantCode}`)}>查看</Button>
                  <Button type="link" size="small" onClick={() => navigate(`/tenants/${record.tenantCode}`)}>编辑</Button>
                  {record.status !== 'ACTIVE' && (
                    <Button type="link" size="small" onClick={async () => {
                      await adminApi.updateTenantStatus(record.tenantCode, 'ACTIVE');
                      message.success('已启用');
                      load();
                    }}>启用</Button>
                  )}
                  {record.status === 'ACTIVE' && (
                    <Button type="link" size="small" danger onClick={async () => {
                      await adminApi.updateTenantStatus(record.tenantCode, 'SUSPENDED');
                      message.success('已冻结');
                      load();
                    }}>冻结</Button>
                  )}
                  <Popconfirm
                    title="确认删除该租户？"
                    description={(record._count?.agents ?? 0) > 0 ? '请先删除全部客服' : '删除后不可恢复'}
                    disabled={(record._count?.agents ?? 0) > 0}
                    onConfirm={async () => {
                      await adminApi.deleteTenant(record.tenantCode);
                      message.success('删除成功');
                      load();
                    }}
                  >
                    <Button type="link" size="small" danger disabled={(record._count?.agents ?? 0) > 0}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="新增租户" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="企业名称" rules={[{ required: true, message: '请输入企业名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tenantCode" label="企业编码" rules={tenantCodeRules} extra="客服登录使用，创建后不可修改">
            <Input placeholder="如 demo001" />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={slugRules} extra="URL 可读标识，用于 SDK 可选配置">
            <Input placeholder="如 demo" />
          </Form.Item>
          <Form.Item name="adminEmail" label="管理员账号" rules={accountRules}>
            <Input />
          </Form.Item>
          <Form.Item name="adminPassword" label="管理员密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="contactName" label="联系人"><Input /></Form.Item>
          <Form.Item name="contactPhone" label="联系电话"><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
