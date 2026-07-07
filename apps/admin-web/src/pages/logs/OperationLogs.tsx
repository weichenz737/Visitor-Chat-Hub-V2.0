import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Space, Table, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi, type OperationLogItem } from '../../api/client';

export default function OperationLogsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OperationLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async (p = page, kw = keyword) => {
    setLoading(true);
    try {
      const res = await adminApi.operationLogs({ page: p, limit: 20, keyword: kw });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => { load(); }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>操作日志</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>
      </div>

      <Card>
        <Form form={form} layout="inline" onFinish={(v) => { setKeyword(v.keyword ?? ''); setPage(1); load(1, v.keyword ?? ''); }}>
          <Form.Item name="keyword">
            <Input placeholder="搜索操作 / 操作人 / 目标" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">搜索</Button></Form.Item>
        </Form>
      </Card>

      <Card>
        <Table<OperationLogItem>
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => { setPage(p); load(p); },
            showTotal: (t) => `共 ${t} 条`,
          }}
          columns={[
            { title: '操作人', dataIndex: 'adminEmail', width: 160 },
            { title: '操作', dataIndex: 'action', width: 120 },
            { title: '目标', dataIndex: 'target' },
            { title: '详情', dataIndex: 'detail', ellipsis: true },
            { title: 'IP', dataIndex: 'ip', width: 130 },
            {
              title: '浏览器',
              dataIndex: 'userAgent',
              ellipsis: true,
              render: (v) => v?.slice(0, 40) ?? '-',
            },
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
