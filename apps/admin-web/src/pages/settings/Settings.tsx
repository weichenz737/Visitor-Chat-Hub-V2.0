import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Select, Space, Tabs, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { adminApi } from '../../api/client';

export default function SettingsPage() {
  const [platformForm] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [chatForm] = Form.useForm();
  const [sessionForm] = Form.useForm();
  const [securityForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.settings();
      platformForm.setFieldsValue(data);
      uploadForm.setFieldsValue(data);
      chatForm.setFieldsValue(data);
      sessionForm.setFieldsValue(data);
      securityForm.setFieldsValue(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveSection = async (form: ReturnType<typeof Form.useForm>[0]) => {
    const values = await form.validateFields() as Record<string, string>;
    setSaving(true);
    try {
      await adminApi.updateSettings(values);
      message.success('设置已保存');
    } finally {
      setSaving(false);
    }
  };

  const tabItems = [
    {
      key: 'platform',
      label: '平台配置',
      children: (
        <Form form={platformForm} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="siteName" label="平台名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sdkBaseUrl" label="SDK 基础地址" rules={[{ required: true }]}>
            <Input placeholder="http://localhost:5176" />
          </Form.Item>
          <Form.Item name="supportEmail" label="支持邮箱"><Input /></Form.Item>
          <Form.Item name="copyright" label="版权信息"><Input /></Form.Item>
          <Form.Item name="icpNumber" label="备案号"><Input /></Form.Item>
          <Button type="primary" onClick={() => saveSection(platformForm)} loading={saving}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'upload',
      label: '上传配置',
      children: (
        <Form form={uploadForm} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="maxImageMb" label="最大图片 (MB)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="maxVideoMb" label="最大视频 (MB)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="maxFileMb" label="最大文件 (MB)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="allowedExtensions" label="允许扩展名"><Input placeholder="jpg,png,pdf" /></Form.Item>
          <Button type="primary" onClick={() => saveSection(uploadForm)} loading={saving}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'chat',
      label: '聊天配置',
      children: (
        <Form form={chatForm} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="defaultWelcome" label="默认欢迎语"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="offlineTip" label="离线提示"><Input /></Form.Item>
          <Form.Item name="queueTip" label="排队提示"><Input /></Form.Item>
          <Button type="primary" onClick={() => saveSection(chatForm)} loading={saving}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'session',
      label: '会话配置',
      children: (
        <Form form={sessionForm} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="sessionTimeoutMinutes" label="超时时间 (分钟)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="autoCloseMinutes" label="自动关闭 (分钟)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="assignmentStrategy" label="分配策略">
            <Select options={[
              { value: 'round_robin', label: '轮询' },
              { value: 'idle_first', label: '空闲优先' },
            ]} />
          </Form.Item>
          <Button type="primary" onClick={() => saveSection(sessionForm)} loading={saving}>保存</Button>
        </Form>
      ),
    },
    {
      key: 'security',
      label: '安全配置',
      children: (
        <Form form={securityForm} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="passwordMinLength" label="密码最小长度"><InputNumber min={6} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="loginFailLimit" label="登录失败锁定次数"><InputNumber min={3} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="tokenExpireDays" label="Token 有效期 (天)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Button type="primary" onClick={() => saveSection(securityForm)} loading={saving}>保存</Button>
        </Form>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>系统设置</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>
      <Card loading={loading}>
        <Tabs items={tabItems} />
      </Card>
    </Space>
  );
}
