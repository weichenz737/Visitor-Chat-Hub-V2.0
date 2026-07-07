import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Button, Card, Descriptions, Drawer, Form, Input, InputNumber, List, Modal, Popconfirm, Select, Space, Table,
  Tabs, Typography, message, Tag, Empty,
} from 'antd';
import { CopyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi, type TenantItem, type AgentItem, type QuickReplyItem } from '../../api/client';
import {
  StatusTag, tenantStatusMap, agentAccountStatusMap, agentRoleMap, sessionStatusMap,
} from '../../utils/status';
import { accountRules } from '../../utils/account';

const { Text } = Typography;

export default function TenantDetailPage() {
  const { tenantCode } = useParams<{ tenantCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'info';

  const [tenant, setTenant] = useState<TenantItem | null>(null);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [sessions, setSessions] = useState<unknown[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionKeyword, setSessionKeyword] = useState('');
  const [sessionDrawer, setSessionDrawer] = useState<{ open: boolean; messages?: unknown[] }>({ open: false });
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [agentModal, setAgentModal] = useState<{ open: boolean; editing?: AgentItem }>({ open: false });
  const [agentForm] = Form.useForm();
  const [pwdModal, setPwdModal] = useState<{ open: boolean; agent?: AgentItem }>({ open: false });
  const [pwdForm] = Form.useForm();
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [qrModal, setQrModal] = useState<{ open: boolean; editing?: QuickReplyItem }>({ open: false });
  const [qrForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const [sessionForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!tenantCode) return;
    setLoading(true);
    try {
      const [t, a, s, cfg, qr, ts] = await Promise.all([
        adminApi.tenant(tenantCode),
        adminApi.tenantAgents(tenantCode, { page: 1, limit: 50 }),
        adminApi.sessions({ tenantCode, page: sessionPage, limit: 10, keyword: sessionKeyword }),
        adminApi.settings(),
        adminApi.tenantQuickReplies(tenantCode),
        adminApi.tenantSettings(tenantCode),
      ]);
      setTenant(t);
      setAgents(a.items);
      setSessions(s.items);
      setSessionTotal(s.total);
      setGlobalSettings(cfg);
      settingsForm.setFieldsValue(ts);
      setQuickReplies(qr);
    } finally {
      setLoading(false);
    }
  }, [tenantCode, sessionPage, sessionKeyword, settingsForm]);

  const searchSessions = async (kw: string, p = 1) => {
    if (!tenantCode) return;
    setSessionKeyword(kw);
    setSessionPage(p);
    const s = await adminApi.sessions({ tenantCode, page: p, limit: 10, keyword: kw });
    setSessions(s.items);
    setSessionTotal(s.total);
  };

  const viewSessionMessages = async (sessionId: string) => {
    const res = await adminApi.sessionMessages(sessionId);
    setSessionDrawer({ open: true, messages: res.messages });
  };

  const saveTenantSettings = async () => {
    if (!tenantCode) return;
    const values = await settingsForm.validateFields();
    await adminApi.updateTenantSettings(tenantCode, values);
    message.success('租户设置已保存');
    load();
  };

  useEffect(() => { load(); }, [load]);

  const sdkCode = tenant
    ? `<script src="${globalSettings.sdkBaseUrl ?? 'http://localhost:5176'}/dist/cs-widget.iife.js"></script>\n<script>\n  CSWidget.init('${tenant.apiKey}', { slug: '${tenant.slug}' });\n</script>`
    : '';

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制');
  };

  const saveAgent = async () => {
    if (!tenantCode) return;
    const values = await agentForm.validateFields();
    if (agentModal.editing) {
      await adminApi.updateAgent(tenantCode, agentModal.editing.id, values);
      message.success('客服已更新');
    } else {
      await adminApi.createAgent(tenantCode, values);
      message.success('客服已创建');
    }
    setAgentModal({ open: false });
    agentForm.resetFields();
    load();
  };

  const resetPwd = async () => {
    if (!tenantCode || !pwdModal.agent) return;
    const { password } = await pwdForm.validateFields();
    await adminApi.resetAgentPassword(tenantCode, pwdModal.agent.id, password);
    message.success('密码已重置');
    setPwdModal({ open: false });
    pwdForm.resetFields();
  };

  const saveQuickReply = async () => {
    if (!tenantCode) return;
    const values = await qrForm.validateFields();
    if (qrModal.editing) {
      await adminApi.updateTenantQuickReply(tenantCode, qrModal.editing.id, values);
      message.success('常用语已更新');
    } else {
      await adminApi.createTenantQuickReply(tenantCode, values);
      message.success('常用语已添加');
    }
    setQrModal({ open: false });
    qrForm.resetFields();
    load();
  };

  if (!tenant) return null;

  const tabItems = [
    {
      key: 'info',
      label: '基础信息',
      children: (
        <Descriptions bordered column={2}>
          <Descriptions.Item label="企业编码" span={2}>
            <Space>
              <Text copyable code>{tenant.tenantCode}</Text>
              <Text type="secondary">（客服端登录时填写，创建后不可修改）</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="企业名称">{tenant.name}</Descriptions.Item>
          <Descriptions.Item label="管理员账号">{tenant.adminEmail}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={tenant.status} map={tenantStatusMap} /></Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(tenant.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="Slug" span={2}>
            <Space>
              <Text code>{tenant.slug}</Text>
              <Text type="secondary">（URL / 品牌展示，SDK 可选配置）</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="域名">{tenant.domain ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="联系人">{tenant.contactName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{tenant.contactPhone ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="客服数量">{tenant._count?.agents ?? 0}</Descriptions.Item>
          <Descriptions.Item label="用户数量">{tenant._count?.users ?? 0}</Descriptions.Item>
          <Descriptions.Item label="会话数量" span={2}>{tenant._count?.sessions ?? 0}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{tenant.remark ?? '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'agents',
      label: '客服管理',
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setAgentModal({ open: true });
              agentForm.resetFields();
            }}>新增客服</Button>
          </div>
          <Table<AgentItem>
            rowKey="id"
            dataSource={agents}
            loading={loading}
            columns={[
              { title: '姓名', dataIndex: 'name' },
              { title: '账号', dataIndex: 'email' },
              { title: '角色', dataIndex: 'role', render: (v) => agentRoleMap[v as keyof typeof agentRoleMap] },
              { title: '账号状态', dataIndex: 'accountStatus', render: (v) => <StatusTag value={v} map={agentAccountStatusMap} /> },
              { title: '在线状态', dataIndex: 'status', render: (v) => <Tag color={v === 'ONLINE' ? 'green' : 'default'}>{v}</Tag> },
              { title: '当前会话', render: (_, r) => r.activeSessionCount ?? 0 },
              { title: '创建时间', dataIndex: 'createdAt', render: (v) => dayjs(v).format('YYYY-MM-DD') },
              {
                title: '操作',
                render: (_, record) => (
                  <Space wrap>
                    <Button type="link" size="small" onClick={() => {
                      setAgentModal({ open: true, editing: record });
                      agentForm.setFieldsValue(record);
                    }}>编辑</Button>
                    {record.accountStatus === 'ACTIVE' ? (
                      <Button type="link" size="small" danger onClick={async () => {
                        await adminApi.updateAgent(tenantCode!, record.id, { accountStatus: 'SUSPENDED' });
                        message.success('已冻结');
                        load();
                      }}>冻结</Button>
                    ) : (
                      <Button type="link" size="small" onClick={async () => {
                        await adminApi.updateAgent(tenantCode!, record.id, { accountStatus: 'ACTIVE' });
                        message.success('已启用');
                        load();
                      }}>启用</Button>
                    )}
                    <Button type="link" size="small" onClick={() => {
                      setPwdModal({ open: true, agent: record });
                      pwdForm.resetFields();
                    }}>重置密码</Button>
                    <Popconfirm
                      title="确认删除？"
                      description={(record.activeSessionCount ?? 0) > 0 ? '请先结束全部会话' : undefined}
                      disabled={(record.activeSessionCount ?? 0) > 0}
                      onConfirm={async () => {
                        await adminApi.deleteAgent(tenantCode!, record.id);
                        message.success('已删除');
                        load();
                      }}
                    >
                      <Button type="link" size="small" danger disabled={(record.activeSessionCount ?? 0) > 0}>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </>
      ),
    },
    {
      key: 'quick-replies',
      label: '常用语',
      children: (
        <>
          <Typography.Paragraph type="secondary">
            企业级常用语，本企业所有客服在聊天时均可使用。客服也可在工作台配置个人常用语。
          </Typography.Paragraph>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setQrModal({ open: true });
              qrForm.resetFields();
            }}>新增常用语</Button>
          </div>
          <Table<QuickReplyItem>
            rowKey="id"
            dataSource={quickReplies}
            loading={loading}
            locale={{ emptyText: '暂无企业常用语，请点击上方按钮添加' }}
            columns={[
              { title: '标题', dataIndex: 'title', width: 120 },
              { title: '内容', dataIndex: 'content', ellipsis: true },
              { title: '快捷键', dataIndex: 'shortcut', width: 100, render: (v) => v ?? '-' },
              {
                title: '操作',
                width: 140,
                render: (_, record) => (
                  <Space>
                    <Button type="link" size="small" onClick={() => {
                      setQrModal({ open: true, editing: record });
                      qrForm.setFieldsValue(record);
                    }}>编辑</Button>
                    <Popconfirm title="确认删除？" onConfirm={async () => {
                      await adminApi.deleteTenantQuickReply(tenantCode!, record.id);
                      message.success('已删除');
                      load();
                    }}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </>
      ),
    },
    {
      key: 'sessions',
      label: '聊天记录',
      children: (
        <>
          <Form form={sessionForm} layout="inline" style={{ marginBottom: 16 }} onFinish={(v) => searchSessions(v.keyword ?? '', 1)}>
            <Form.Item name="keyword">
              <Input placeholder="搜索访客 / 客服" allowClear prefix={<SearchOutlined />} />
            </Form.Item>
            <Form.Item><Button type="primary" htmlType="submit">搜索</Button></Form.Item>
          </Form>
          <Table
            rowKey="id"
            dataSource={sessions as Record<string, unknown>[]}
            loading={loading}
            pagination={{
              current: sessionPage,
              total: sessionTotal,
              pageSize: 10,
              onChange: (p) => searchSessions(sessionKeyword, p),
              showTotal: (t) => `共 ${t} 条`,
            }}
            columns={[
              { title: '访客', render: (_, r) => (r.user as { nickname: string })?.nickname },
              { title: '客服', render: (_, r) => (r.agent as { name: string })?.name ?? '-' },
              { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag value={v} map={sessionStatusMap} /> },
              { title: '消息数', render: (_, r) => (r._count as { messages: number })?.messages ?? 0 },
              { title: '时间', dataIndex: 'createdAt', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
              {
                title: '操作',
                render: (_, r) => (
                  <Button type="link" size="small" onClick={() => viewSessionMessages(r.id as string)}>查看详情</Button>
                ),
              },
            ]}
          />
        </>
      ),
    },
    {
      key: 'api',
      label: 'API 管理',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" title="API Key">
            <Space>
              <Typography.Text code>{tenant.apiKey}</Typography.Text>
              <Button icon={<CopyOutlined />} onClick={() => copy(tenant.apiKey)}>复制</Button>
              <Popconfirm title="确认重新生成 API Key？旧 Key 将失效" onConfirm={async () => {
                const t = await adminApi.regenerateApiKey(tenantCode!);
                setTenant(t);
                message.success('已重新生成');
              }}>
                <Button danger>重新生成</Button>
              </Popconfirm>
            </Space>
          </Card>
          <Card size="small" title="SDK 接入代码">
            <Input.TextArea rows={6} value={sdkCode} readOnly />
            <Button style={{ marginTop: 8 }} icon={<CopyOutlined />} onClick={() => copy(sdkCode)}>复制代码</Button>
          </Card>
          <Card size="small" title="接入文档">
            <Typography.Paragraph>
              1. 将 SDK 脚本嵌入网站页面<br />
              2. 使用 API Key 认证：<code>CSWidget.init(apiKey)</code><br />
              3. Slug 为可选品牌参数，不参与登录<br />
              4. 用户访问页面后自动创建访客身份并连接客服
            </Typography.Paragraph>
          </Card>
        </Space>
      ),
    },
    {
      key: 'settings',
      label: '设置',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="租户状态">
            <Space>
              <StatusTag value={tenant.status} map={tenantStatusMap} />
              {tenant.status !== 'ACTIVE' && (
                <Button size="small" onClick={async () => {
                  await adminApi.updateTenantStatus(tenantCode!, 'ACTIVE');
                  load();
                }}>启用</Button>
              )}
              {tenant.status === 'ACTIVE' && (
                <Button size="small" danger onClick={async () => {
                  await adminApi.updateTenantStatus(tenantCode!, 'SUSPENDED');
                  load();
                }}>冻结</Button>
              )}
            </Space>
          </Card>
          <Card size="small" title="品牌与聊天">
            <Form form={settingsForm} layout="vertical" style={{ maxWidth: 560 }}>
              <Form.Item name="welcomeMessage" label="欢迎语"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="chatColor" label="聊天窗口主色"><Input placeholder="#4338ca" /></Form.Item>
              <Form.Item name="maxFileSizeMb" label="文件大小限制 (MB)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="allowedFileTypes" label="允许上传类型"><Input placeholder="image/*,.pdf" /></Form.Item>
              <Form.Item name="sessionTimeoutMinutes" label="自动关闭会话 (分钟)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="assignmentStrategy" label="客服分配策略">
                <Select options={[
                  { value: 'round_robin', label: '轮询' },
                  { value: 'idle_first', label: '空闲优先' },
                ]} />
              </Form.Item>
              <Button type="primary" onClick={saveTenantSettings}>保存设置</Button>
            </Form>
          </Card>
          <Card size="small" title="SDK 地址">
            <Typography.Text type="secondary">{globalSettings.sdkBaseUrl ?? '未配置'}</Typography.Text>
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{tenant.name}</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>
      <Card loading={loading}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setSearchParams({ tab: k })}
          items={tabItems}
        />
      </Card>

      <Modal
        title={agentModal.editing ? '编辑客服' : '新增客服'}
        open={agentModal.open}
        onOk={saveAgent}
        onCancel={() => setAgentModal({ open: false })}
        destroyOnClose
      >
        <Form form={agentForm} layout="vertical">
          <Form.Item name="email" label="账号" rules={accountRules}>
            <Input disabled={!!agentModal.editing} />
          </Form.Item>
          {!agentModal.editing && (
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号"><Input /></Form.Item>
          <Form.Item name="role" label="角色" initialValue="AGENT">
            <Select options={[{ value: 'AGENT', label: '客服' }, { value: 'SUPERVISOR', label: '客服主管' }]} />
          </Form.Item>
          <Form.Item name="accountStatus" label="状态" initialValue="ACTIVE">
            <Select options={[{ value: 'ACTIVE', label: '启用' }, { value: 'SUSPENDED', label: '冻结' }]} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="重置密码" open={pwdModal.open} onOk={resetPwd} onCancel={() => setPwdModal({ open: false })}>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={qrModal.editing ? '编辑常用语' : '新增常用语'}
        open={qrModal.open}
        onOk={saveQuickReply}
        onCancel={() => setQrModal({ open: false })}
        destroyOnClose
      >
        <Form form={qrForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：欢迎语" maxLength={32} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={3} placeholder="发送给访客的完整话术" maxLength={500} />
          </Form.Item>
          <Form.Item name="shortcut" label="快捷键（可选）">
            <Input placeholder="如：/welcome" maxLength={32} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="聊天详情"
        open={sessionDrawer.open}
        onClose={() => setSessionDrawer({ open: false })}
        width={480}
      >
        <List
          dataSource={sessionDrawer.messages ?? []}
          locale={{ emptyText: <Empty description="暂无消息" /> }}
          renderItem={(item) => {
            const m = item as { senderType: string; content: string; createdAt: string; type: string };
            return (
              <List.Item>
                <List.Item.Meta
                  title={`${m.senderType} · ${dayjs(m.createdAt).format('HH:mm:ss')}`}
                  description={m.type === 'TEXT' ? m.content : `[${m.type}] ${m.content}`}
                />
              </List.Item>
            );
          }}
        />
      </Drawer>
    </Space>
  );
}
