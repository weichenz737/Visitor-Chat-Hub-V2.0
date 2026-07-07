import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { tenantApi } from '../api/client';
import { sessionStatusMap, StatusTag } from '../utils/status';

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof tenantApi.dashboard>> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await tenantApi.dashboard());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = data?.stats;
  const tenant = data?.tenant as { name?: string; tenantCode?: string } | undefined;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>仪表盘</Typography.Title>
          <Typography.Text type="secondary">{tenant?.name}（{tenant?.tenantCode}）</Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>
      <Row gutter={[16, 16]}>
        {[
          ['客服总数', stats?.agentCount],
          ['在线客服', stats?.onlineAgents],
          ['用户总数', stats?.userCount],
          ['今日新增用户', stats?.todayUsers],
          ['今日会话', stats?.todaySessions],
          ['今日消息', stats?.todayMessages],
          ['进行中会话', stats?.activeSessions],
        ].map(([title, value]) => (
          <Col xs={12} sm={8} md={6} key={title as string}>
            <Card><Statistic title={title as string} value={value ?? 0} loading={loading} /></Card>
          </Col>
        ))}
      </Row>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="今日客服工作量" loading={loading}>
            <Table
              rowKey="name"
              dataSource={data?.topAgentsToday ?? []}
              pagination={false}
              columns={[
                { title: '客服', dataIndex: 'name' },
                { title: '消息数', dataIndex: 'count' },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近会话" loading={loading}>
            <Table
              rowKey="id"
              dataSource={(data?.recentSessions as Record<string, unknown>[]) ?? []}
              pagination={false}
              size="small"
              columns={[
                { title: '访客', render: (_, r) => (r.user as { nickname: string })?.nickname },
                { title: '客服', render: (_, r) => (r.agent as { name: string })?.name ?? '-' },
                { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag value={v} map={sessionStatusMap} /> },
                { title: '时间', dataIndex: 'createdAt', render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
