import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi, type LoginLogItem } from '../../api/client';

const roleMap: Record<string, string> = {
  platform_admin: '系统管理员',
  agent: '客服',
};

export default function LoginLogsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoginLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [success, setSuccess] = useState<string | undefined>();

  const load = useCallback(async (p = page, kw = keyword, suc = success) => {
    setLoading(true);
    try {
      const res = await adminApi.loginLogs({
        page: p,
        limit: 10,
        keyword: kw,
        success: suc,
      });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, success]);

  useEffect(() => { load(); }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>登录日志</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>
      </div>

      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={(v) => {
            setKeyword(v.keyword ?? '');
            setSuccess(v.success);
            setPage(1);
            load(1, v.keyword ?? '', v.success);
          }}
        >
          <Form.Item name="keyword">
            <Input placeholder="搜索账号 / 企业" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="success">
            <Select
              allowClear
              placeholder="登录状态"
              style={{ width: 120 }}
              options={[
                { value: 'true', label: '成功' },
                { value: 'false', label: '失败' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">搜索</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table<LoginLogItem>
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
            { title: '账号', dataIndex: 'account' },
            { title: '角色', dataIndex: 'role', render: (v) => roleMap[v] ?? v },
            { title: '企业', render: (_, r) => r.tenantName ?? '-' },
            { title: 'IP', dataIndex: 'ip', width: 120 },
            {
              title: '浏览器',
              dataIndex: 'userAgent',
              ellipsis: true,
              render: (v) => v?.slice(0, 40) ?? '-',
            },
            {
              title: '状态',
              dataIndex: 'success',
              width: 80,
              render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? '成功' : '失败'}</Tag>,
            },
            { title: '失败原因', dataIndex: 'failReason', ellipsis: true, render: (v) => v ?? '-' },
            { title: '时间', dataIndex: 'createdAt', width: 150, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
          ]}
        />
      </Card>
    </Space>
  );
}
