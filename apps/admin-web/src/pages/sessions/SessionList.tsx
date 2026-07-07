import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button, Card, Form, Input, Popconfirm, Space, Table, Typography, message,
} from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../../api/client';
import ChatMessagesDrawer, { type ChatUserRef } from '../../components/ChatMessagesDrawer';
import { StatusTag, sessionStatusMap } from '../../utils/status';

interface ChatUser extends ChatUserRef {
  messageCount: number;
  sessionCount: number;
  lastMessageAt?: string | null;
  latestSessionStatus?: string | null;
  agentNames?: string | null;
  tenantCode?: string;
  tenantName?: string;
}

export default function SessionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChatUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [tenantCode, setTenantCode] = useState('');
  const [drawerUser, setDrawerUser] = useState<ChatUserRef | null>(null);

  const load = useCallback(async (p = page, kw = keyword, tc = tenantCode) => {
    setLoading(true);
    try {
      const res = await adminApi.chatUsers({
        page: p,
        limit: 10,
        keyword: kw,
        tenantCode: tc,
      });
      setData(res.items as ChatUser[]);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, tenantCode]);

  useEffect(() => { load(); }, []);

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
        <Typography.Title level={4} style={{ margin: 0 }}>会话列表</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>
      </div>

      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={(v) => {
            setKeyword(v.keyword ?? '');
            setTenantCode(v.tenantCode ?? '');
            setPage(1);
            load(1, v.keyword ?? '', v.tenantCode ?? '');
          }}
        >
          <Form.Item name="keyword">
            <Input placeholder="搜索访客昵称" allowClear prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="tenantCode">
            <Input placeholder="租户代码" allowClear />
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">搜索</Button></Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: (p) => { setPage(p); load(p); },
            showTotal: (t) => `共 ${t} 位访客`,
          }}
          columns={[
            { title: '租户', dataIndex: 'tenantName' },
            { title: '租户代码', dataIndex: 'tenantCode' },
            {
              title: '访客',
              render: (_, r) => r.nickname ?? (r.visitorNo ? `访客#${r.visitorNo}` : r.id.slice(0, 8)),
            },
            { title: '会话数', dataIndex: 'sessionCount' },
            {
              title: '会话状态',
              dataIndex: 'latestSessionStatus',
              render: (v: string) => v ? <StatusTag value={v} map={sessionStatusMap} /> : '-',
            },
            {
              title: '对接客服',
              dataIndex: 'agentNames',
              ellipsis: true,
              render: (v: string) => v || '-',
            },
            { title: '消息数', dataIndex: 'messageCount' },
            {
              title: '最后消息时间',
              dataIndex: 'lastMessageAt',
              render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            },
            {
              title: '操作',
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => openMessages(r)}>查看聊天记录</Button>
                  <Popconfirm
                    title="确定清空该用户所有聊天记录？"
                    onConfirm={() => deleteAllMessages(r.id)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>清空</Button>
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
