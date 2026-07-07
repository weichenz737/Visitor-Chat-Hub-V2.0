import { useEffect, useState, useCallback } from 'react';
import { Card, Col, Row, Statistic, Table, Button, Space, Typography, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Line, Column } from '@ant-design/plots';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { adminApi, type DashboardData, type TenantItem, type OperationLogItem } from '../api/client';
import { StatusTag, tenantStatusMap, sessionStatusMap, formatDuration } from '../utils/status';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.dashboard());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = data?.stats;
  const charts = data?.charts;

  const statCards = [
    { title: '总租户数', value: stats?.tenantCount ?? 0 },
    { title: '启用租户', value: stats?.activeTenantCount ?? 0 },
    { title: '冻结租户', value: stats?.suspendedTenantCount ?? 0 },
    { title: '客服总数', value: stats?.totalAgents ?? 0 },
    { title: '在线客服', value: stats?.onlineAgents ?? 0 },
    { title: '用户总数', value: stats?.totalUsers ?? 0 },
    { title: '今日新增用户', value: stats?.todayUsers ?? 0 },
    { title: '当前在线用户', value: stats?.onlineUsers ?? 0 },
    { title: '今日会话', value: stats?.todaySessions ?? 0 },
    { title: '今日消息', value: stats?.todayMessages ?? 0 },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>仪表盘</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>

      <Row gutter={[12, 12]}>
        {statCards.map((item) => (
          <Col xs={12} sm={8} md={6} lg={4} xl={4} key={item.title}>
            <Card size="small">
              <Statistic title={item.title} value={item.value} loading={loading} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="今日消息趋势" loading={loading}>
            {charts?.todayMessageTrend?.length ? (
              <Line
                data={charts.todayMessageTrend}
                xField="hour"
                yField="count"
                height={220}
                smooth
                axis={{ y: { title: '消息数' } }}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近7天会话趋势" loading={loading}>
            {charts?.sessionTrend7d?.length ? (
              <Line
                data={charts.sessionTrend7d}
                xField="date"
                yField="count"
                height={220}
                smooth
                axis={{ y: { title: '会话数' } }}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近7天新增用户" loading={loading}>
            {charts?.userTrend7d?.length ? (
              <Column
                data={charts.userTrend7d}
                xField="date"
                yField="count"
                height={220}
                axis={{ y: { title: '用户数' } }}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="客服工作量排行（7天）" loading={loading} size="small">
            <Table
              rowKey={(r) => `${r.name}-${r.tenantName}`}
              dataSource={charts?.topAgents ?? []}
              pagination={false}
              size="small"
              columns={[
                { title: '客服', dataIndex: 'name' },
                { title: '企业', dataIndex: 'tenantName', ellipsis: true },
                { title: '消息', dataIndex: 'count', width: 56 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="活跃租户排行（7天）" loading={loading} size="small">
            <Table
              rowKey="tenantCode"
              dataSource={charts?.topTenants ?? []}
              pagination={false}
              size="small"
              columns={[
                { title: '企业', dataIndex: 'name', ellipsis: true },
                { title: '会话', dataIndex: 'count', width: 56 },
              ]}
              onRow={(r) => ({
                onClick: () => navigate(`/tenants/${r.tenantCode}`),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="最近租户" extra={<Button type="link" onClick={() => navigate('/tenants')}>查看全部</Button>}>
            <Table<TenantItem>
              rowKey="tenantCode"
              loading={loading}
              dataSource={data?.recentTenants ?? []}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="暂无数据" /> }}
              columns={[
                { title: '企业名称', dataIndex: 'name' },
                { title: '企业编码', dataIndex: 'tenantCode' },
                { title: '状态', dataIndex: 'status', render: (v) => <StatusTag value={v} map={tenantStatusMap} /> },
                { title: '创建时间', dataIndex: 'createdAt', render: (v) => dayjs(v).format('MM-DD HH:mm') },
              ]}
              onRow={(r) => ({ onClick: () => navigate(`/tenants/${r.tenantCode}`), style: { cursor: 'pointer' } })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近新增客服" extra={<Button type="link" onClick={() => navigate('/agents')}>查看全部</Button>}>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={data?.recentAgents ?? []}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="暂无数据" /> }}
              columns={[
                { title: '姓名', dataIndex: 'name' },
                { title: '企业', render: (_, r) => r.tenant?.name ?? '-' },
                { title: '账号', dataIndex: 'email' },
                { title: '时间', dataIndex: 'createdAt', render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="最近操作日志" extra={<Button type="link" onClick={() => navigate('/logs')}>查看全部</Button>}>
            <Table<OperationLogItem>
              rowKey="id"
              loading={loading}
              dataSource={data?.recentLogs ?? []}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="暂无数据" /> }}
              columns={[
                { title: '操作人', dataIndex: 'adminEmail', width: 120, ellipsis: true },
                { title: '操作', dataIndex: 'action' },
                { title: '时间', dataIndex: 'createdAt', render: (v) => dayjs(v).format('MM-DD HH:mm') },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近会话">
            <Table
              rowKey="id"
              loading={loading}
              dataSource={(data?.recentSessions as Record<string, unknown>[]) ?? []}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="暂无数据" /> }}
              columns={[
                { title: '企业', render: (_, r) => (r.tenant as { name: string })?.name },
                { title: '访客', render: (_, r) => (r.user as { nickname: string })?.nickname },
                { title: '状态', dataIndex: 'status', render: (v) => <StatusTag value={v} map={sessionStatusMap} /> },
                { title: '时间', dataIndex: 'createdAt', render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card size="small">
            <Statistic title="平均响应时间" value={formatDuration(stats?.avgResponseTime ?? 0)} loading={loading} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic title="平均会话时长" value={formatDuration(stats?.avgSessionDuration ?? 0)} loading={loading} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
