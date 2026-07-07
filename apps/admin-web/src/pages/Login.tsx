import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useChatStore } from '@cs/shared/src/store';
import { accountRules } from '../utils/account';

export default function LoginPage() {
  const { loginPlatformAdmin, loading } = useChatStore();
  const [form] = Form.useForm();
  const [error, setError] = useState('');

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card
        style={{ width: 400 }}
        title={
          <Typography.Title level={3} style={{ margin: 0, textAlign: 'center' }}>
            平台管理后台
          </Typography.Title>
        }
      >
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 16 }}>
          SaaS 运营方专用 · 企业日常管理请使用企业后台 (:5177)
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ email: 'admin@example.com', password: 'admin123' }}
          onFinish={async (values) => {
            setError('');
            try {
              await loginPlatformAdmin(values.email, values.password);
              message.success('登录成功');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Form.Item name="email" label="账号" rules={accountRules}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password size="large" />
          </Form.Item>
          {error && <Typography.Text type="danger">{error}</Typography.Text>}
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
