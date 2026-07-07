import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { tenantApi } from '../api/client';

export default function QuickRepliesPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing?: Record<string, unknown> }>({ open: false });
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setData((await tenantApi.quickReplies()) as Record<string, unknown>[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const values = await form.validateFields();
    if (modal.editing) {
      await tenantApi.updateQuickReply(modal.editing.id as string, values);
    } else {
      await tenantApi.createQuickReply(values);
    }
    message.success('已保存');
    setModal({ open: false });
    form.resetFields();
    load();
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>企业常用语</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModal({ open: true }); form.resetFields(); }}>新增</Button>
        </Space>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '内容', dataIndex: 'content', ellipsis: true },
            { title: '快捷键', dataIndex: 'shortcut', render: (v) => v ?? '-' },
            {
              title: '操作',
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => { setModal({ open: true, editing: r }); form.setFieldsValue(r); }}>编辑</Button>
                  <Popconfirm title="确认删除？" onConfirm={async () => { await tenantApi.deleteQuickReply(r.id as string); load(); }}>
                    <Button type="link" danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal title={modal.editing ? '编辑常用语' : '新增常用语'} open={modal.open} onOk={save} onCancel={() => setModal({ open: false })}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="shortcut" label="快捷键"><Input placeholder="/welcome" /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
