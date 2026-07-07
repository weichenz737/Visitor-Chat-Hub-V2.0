import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Select, Space, Typography, message, Tabs } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { tenantApi } from '../api/client';
import { useChatStore } from '@cs/shared/src/store';

export default function SettingsPage() {
  const { auth } = useChatStore();
  const [profileForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [profile, settings] = await Promise.all([
        tenantApi.profile(),
        tenantApi.settings(),
      ]);
      profileForm.setFieldsValue(profile);
      settingsForm.setFieldsValue({
        ...settings,
        sessionTimeoutMinutes: String(settings.sessionTimeoutMinutes ?? '30'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tabItems = [
    {
      key: 'chat',
      label: '聊天配置',
      children: (
        <Form form={settingsForm} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="welcomeMessage" label="欢迎语"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="chatColor" label="聊天窗口主色"><Input placeholder="#4338ca" /></Form.Item>
          <Form.Item name="maxFileSizeMb" label="文件大小限制 (MB)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="allowedFileTypes" label="允许上传类型"><Input /></Form.Item>
          <Form.Item name="sessionTimeoutMinutes" label="无消息自动结束会话 (分钟)">
            <Select options={[
              { value: '15', label: '15 分钟' },
              { value: '30', label: '30 分钟' },
              { value: '60', label: '60 分钟' },
              { value: '120', label: '120 分钟' },
            ]} />
          </Form.Item>
          <Form.Item name="assignmentStrategy" label="分配策略">
            <Select options={[{ value: 'round_robin', label: '轮询' }, { value: 'idle_first', label: '空闲优先' }]} />
          </Form.Item>
          <Form.Item
            name="visitorTags"
            label="访客标签"
            extra="客服备注客户时可快速选择的标签，多个标签用英文逗号分隔"
          >
            <Input placeholder="VIP,已成交,售前,售后,投诉,高意向" />
          </Form.Item>
          <Form.Item name="agentLinkOfflineBehavior" label="专属链接客服离线时">
            <Select options={[
              { value: 'wait', label: '等待该客服上线' },
              { value: 'auto_assign', label: '自动分配其他客服' },
            ]} />
          </Form.Item>
          <Button type="primary" onClick={async () => {
            await tenantApi.updateSettings(await settingsForm.validateFields());
            message.success('已保存');
          }}>保存配置</Button>
        </Form>
      ),
    },
  ];

  if (auth?.staffRole === 'TENANT_ADMIN') {
    tabItems.unshift({
      key: 'company',
      label: '企业信息',
      children: (
        <Form form={profileForm} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="name" label="企业名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="企业编码"><Input value={auth.tenantCode} disabled /></Form.Item>
          <Form.Item name="contactName" label="联系人"><Input /></Form.Item>
          <Form.Item name="contactPhone" label="联系电话"><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" onClick={async () => {
            await tenantApi.updateProfile(await profileForm.validateFields());
            message.success('已保存');
          }}>保存企业信息</Button>
        </Form>
      ),
    });
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>企业设置</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>
      <Card loading={loading}><Tabs items={tabItems} /></Card>
    </Space>
  );
}
