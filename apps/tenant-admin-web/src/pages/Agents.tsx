import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography, message, Tag, Alert, Tooltip,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { tenantApi } from '../api/client';
import { useTenantAuthorizations } from '../hooks/useTenantAuthorizations';
import { StatusTag, agentAccountStatusMap, agentRoleMap } from '../utils/status';
import { accountRules } from '../utils/account';
import { useChatStore } from '@cs/shared/src/store';

export default function AgentsPage() {
  const { auth: storeAuth } = useChatStore();
  const [form] = Form.useForm();
  const [agentForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editing?: Record<string, unknown> }>({ open: false });
  const [pwdModal, setPwdModal] = useState<{ open: boolean; agent?: Record<string, unknown> }>({ open: false });
  const { auth } = useTenantAuthorizations();

  const agentQuotaLabel = auth.maxAgentCount > 0
    ? `${auth.currentAgentCount} / ${auth.maxAgentCount}`
    : `${auth.currentAgentCount} / 不限`;

  const load = useCallback(async (p = page, kw = keyword) => {
    setLoading(true);
    try {
      const res = await tenantApi.agents({ page: p, limit: 10, keyword: kw });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const values = await agentForm.validateFields();
    if (modal.editing) {
      await tenantApi.updateAgent(modal.editing.id as string, values);
      message.success('已更新');
    } else {
      await tenantApi.createAgent(values);
      message.success('已创建');
    }
    setModal({ open: false });
    agentForm.resetFields();
    load();
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space direction="vertical" size={0}>
          <Typography.Title level={4} style={{ margin: 0 }}>客服管理</Typography.Title>
          <Typography.Text type="secondary">授权客服数量：{agentQuotaLabel}</Typography.Text>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load()}>刷新</Button>
          <Tooltip title={!auth.canCreateAgent ? '已达到授权客服数量上限' : undefined}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!auth.canCreateAgent}
              onClick={() => {
                setModal({ open: true });
                agentForm.resetFields();
              }}
            >
              新增客服
            </Button>
          </Tooltip>
        </Space>
      </div>
      {!auth.canCreateAgent && auth.maxAgentCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`已达到授权客服数量上限（${auth.maxAgentCount}），如需继续新增请联系平台管理员`}
        />
      )}
      <Card>
        <Form form={form} layout="inline" onFinish={(v) => { setKeyword(v.keyword ?? ''); setPage(1); load(1, v.keyword ?? ''); }}>
          <Form.Item name="keyword"><Input placeholder="搜索姓名/账号" prefix={<SearchOutlined />} allowClear /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">搜索</Button></Form.Item>
        </Form>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{ current: page, total, pageSize: 10, onChange: (p) => { setPage(p); load(p); } }}
          columns={[
            { title: '姓名', dataIndex: 'name' },
            { title: '账号', dataIndex: 'email' },
            { title: '角色', dataIndex: 'role', render: (v: string) => agentRoleMap[v as keyof typeof agentRoleMap] },
            { title: '状态', dataIndex: 'accountStatus', render: (v: string) => <StatusTag value={v} map={agentAccountStatusMap} /> },
            { title: '在线', dataIndex: 'status', render: (v: string) => <Tag color={v === 'ONLINE' ? 'green' : 'default'}>{v}</Tag> },
            { title: '当前会话', dataIndex: 'activeSessionCount' },
            { title: '创建时间', dataIndex: 'createdAt', render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
            {
              title: '操作',
              render: (_, record) => (
                <Space wrap>
                  <Button type="link" size="small" onClick={() => {
                    setModal({ open: true, editing: record });
                    agentForm.setFieldsValue(record);
                  }}>编辑</Button>
                  {record.accountStatus === 'ACTIVE' ? (
                    <Button type="link" size="small" danger onClick={async () => {
                      await tenantApi.updateAgent(record.id as string, { accountStatus: 'SUSPENDED' });
                      message.success('已冻结');
                      load();
                    }}>冻结</Button>
                  ) : (
                    <Button type="link" size="small" onClick={async () => {
                      await tenantApi.updateAgent(record.id as string, { accountStatus: 'ACTIVE' });
                      message.success('已启用');
                      load();
                    }}>启用</Button>
                  )}
                  <Button type="link" size="small" onClick={() => {
                    setPwdModal({ open: true, agent: record });
                    pwdForm.resetFields();
                  }}>重置密码</Button>
                  {record.role !== 'TENANT_ADMIN' && record.id !== storeAuth?.userId && (
                    <Popconfirm title="确认删除？" onConfirm={async () => {
                      await tenantApi.deleteAgent(record.id as string);
                      message.success('已删除');
                      load();
                    }}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal title={modal.editing ? '编辑客服' : '新增客服'} open={modal.open} onOk={save} onCancel={() => setModal({ open: false })} destroyOnClose>
        <Form form={agentForm} layout="vertical">
          {!modal.editing && (
            <>
              <Form.Item name="email" label="账号" rules={accountRules}><Input /></Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
            </>
          )}
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机号"><Input /></Form.Item>
          <Form.Item name="role" label="角色" initialValue="AGENT">
            <Select options={[
              { value: 'AGENT', label: '客服' },
              { value: 'SUPERVISOR', label: '客服主管' },
            ]} />
          </Form.Item>
          {modal.editing && (
            <Form.Item name="accountStatus" label="状态">
              <Select options={[{ value: 'ACTIVE', label: '启用' }, { value: 'SUSPENDED', label: '冻结' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Modal title="重置密码" open={pwdModal.open} onOk={async () => {
        const { password } = await pwdForm.validateFields();
        await tenantApi.resetPassword(pwdModal.agent!.id as string, password);
        message.success('密码已重置');
        setPwdModal({ open: false });
      }} onCancel={() => setPwdModal({ open: false })}>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
