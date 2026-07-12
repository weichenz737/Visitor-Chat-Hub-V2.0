import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Form, Input, Typography, message } from 'antd';
import { useAuthStore } from '@cs/shared/src/auth-store';
import {
  clearRememberedLogin,
  loadRememberedLogin,
  saveRememberedLogin,
} from '@cs/shared/src/remember-login';
import { accountRules } from '../utils/account';

export default function LoginPage() {
  const { loginPlatformAdmin, loading } = useAuthStore();
  const [form] = Form.useForm();
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = loadRememberedLogin('platform');
    if (saved) {
      form.setFieldsValue({
        email: saved.account,
        password: saved.password,
        remember: true,
      });
    }
  }, [form]);

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
          initialValues={{ email: '', password: '', remember: false }}
          onFinish={async (values) => {
            setError('');
            try {
              await loginPlatformAdmin(values.email, values.password);
              if (values.remember) {
                saveRememberedLogin('platform', {
                  account: values.email,
                  password: values.password,
                });
              } else {
                clearRememberedLogin('platform');
              }
              message.success('登录成功');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Form.Item name="email" label="账号" rules={accountRules}>
            <Input size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>记住密码</Checkbox>
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
