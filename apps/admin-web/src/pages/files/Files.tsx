import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Form, Input, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../../api/client';

interface FileItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  url: string;
  uploaderName?: string;
  createdAt: string;
  tenant?: { tenantCode: string; name: string };
}

interface FileStats {
  totalCount: number;
  todayCount: number;
  totalSize: number;
  imageCount: number;
  videoCount: number;
  fileCount: number;
  uploadTrend7d: { date: string; count: number }[];
}

interface FileFilters {
  keyword?: string;
  category?: string;
  tenantCode?: string;
  startTime?: string;
  endTime?: string;
  uploader?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const categoryMap: Record<string, string> = {
  image: '图片',
  video: '视频',
  file: '文件',
};

function buildFilters(values: Record<string, unknown>): FileFilters {
  const timeRange = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
  return {
    keyword: values.keyword as string | undefined,
    category: values.category as string | undefined,
    tenantCode: values.tenantCode as string | undefined,
    uploader: values.uploader as string | undefined,
    startTime: timeRange?.[0]?.toISOString(),
    endTime: timeRange?.[1]?.toISOString(),
  };
}

export default function FilesPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FileFilters>({});
  const [stats, setStats] = useState<FileStats | null>(null);

  const loadStats = useCallback(async () => {
    const res = await adminApi.fileStats();
    setStats(res);
  }, []);

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true);
    try {
      const res = await adminApi.files({ page: p, limit: 10, ...f });
      setData(res.items as FileItem[]);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadStats();
    load();
  }, []);

  const deleteFile = async (id: string) => {
    await adminApi.deleteFile(id);
    message.success('文件已删除');
    load();
    loadStats();
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>文件管理</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => { load(); loadStats(); }} loading={loading}>刷新</Button>
      </div>

      {stats && (
        <Row gutter={16}>
          <Col span={4}><Card><Statistic title="文件总数" value={stats.totalCount} /></Card></Col>
          <Col span={4}><Card><Statistic title="今日上传" value={stats.todayCount} /></Card></Col>
          <Col span={4}><Card><Statistic title="总大小" value={formatSize(stats.totalSize)} /></Card></Col>
          <Col span={4}><Card><Statistic title="图片" value={stats.imageCount} /></Card></Col>
          <Col span={4}><Card><Statistic title="视频" value={stats.videoCount} /></Card></Col>
          <Col span={4}><Card><Statistic title="文档/其他" value={stats.fileCount} /></Card></Col>
        </Row>
      )}

      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={(v) => {
            const f = buildFilters(v);
            setFilters(f);
            setPage(1);
            load(1, f);
          }}
        >
          <Form.Item name="keyword">
            <Input placeholder="搜索文件名" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="uploader">
            <Input placeholder="上传者（客服/访客）" allowClear />
          </Form.Item>
          <Form.Item name="tenantCode">
            <Input placeholder="租户代码" allowClear />
          </Form.Item>
          <Form.Item name="category">
            <Select placeholder="文件类型" allowClear style={{ width: 120 }}
              options={[
                { value: 'image', label: '图片' },
                { value: 'video', label: '视频' },
                { value: 'file', label: '文件' },
              ]}
            />
          </Form.Item>
          <Form.Item name="timeRange">
            <DatePicker.RangePicker showTime placeholder={['上传开始', '上传结束']} />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">搜索</Button></Form.Item>
        </Form>
      </Card>

      <Card title="上传记录">
        <Table
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
            { title: '租户', render: (_, r) => r.tenant?.name ?? '-' },
            { title: '文件名', dataIndex: 'fileName', ellipsis: true },
            {
              title: 'URL',
              dataIndex: 'url',
              ellipsis: true,
              render: (v: string) => (
                <Typography.Link href={v} target="_blank" ellipsis copyable={{ text: v }}>
                  {v}
                </Typography.Link>
              ),
            },
            {
              title: '类型',
              dataIndex: 'category',
              render: (v: string) => <Tag>{categoryMap[v] ?? v}</Tag>,
            },
            { title: '大小', dataIndex: 'fileSize', render: (v: number) => formatSize(v) },
            { title: '上传者', dataIndex: 'uploaderName', render: (v: string) => v ?? '-' },
            {
              title: '上传时间',
              dataIndex: 'createdAt',
              render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
            },
            {
              title: '操作',
              render: (_, r) => (
                <Space>
                  <a href={r.url} target="_blank" rel="noreferrer">查看</a>
                  <Popconfirm title="确定删除此文件？" onConfirm={() => deleteFile(r.id)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
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
