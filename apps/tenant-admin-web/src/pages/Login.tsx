import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Checkbox, Form, Input, Typography, message } from 'antd';
import { useAuthStore } from '@cs/shared/src/auth-store';
import {
  clearRememberedLogin,
  loadLastTenantCode,
  loadRememberedLogin,
  saveLastTenantCode,
  saveRememberedLogin,
} from '@cs/shared/src/remember-login';
import { accountRules } from '../utils/account';

export default function LoginPage() {
  const navigate = useNavigate();
  const { auth, loginTenantAdmin, loading } = useAuthStore();
  const [form] = Form.useForm();
  const [error, setError] = useState('');

  useEffect(() => {
    if (auth?.role === 'tenant_admin') navigate('/', { replace: true });
  }, [auth, navigate]);

  useEffect(() => {
    const saved = loadRememberedLogin('tenant');
    const lastTenant = loadLastTenantCode('tenant');
    if (saved) {
      form.setFieldsValue({
        email: saved.account,
        password: saved.password,
        tenantCode: saved.tenantCode || lastTenant || '',
        remember: true,
      });
    } else if (lastTenant) {
      form.setFieldsValue({ tenantCode: lastTenant });
    }
  }, [form]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    }}>
      <Card
        style={{ width: 400 }}
        title={<Typography.Title level={3} style={{ margin: 0, textAlign: 'center' }}>企业后台</Typography.Title>}
      >
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
          企业管理员 / 客服主管登录
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ email: '', password: '', tenantCode: '', remember: false }}
          onFinish={async (values) => {
            setError('');
            try {
              await loginTenantAdmin(values.email, values.password, values.tenantCode);
              saveLastTenantCode('tenant', values.tenantCode);
              if (values.remember) {
                saveRememberedLogin('tenant', {
                  account: values.email,
                  password: values.password,
                  tenantCode: values.tenantCode,
                });
              } else {
                clearRememberedLogin('tenant');
              }
              message.success('登录成功');
              navigate('/', { replace: true });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Form.Item name="tenantCode" label="企业编码" rules={[{ required: true }]}>
            <Input size="large" placeholder="请输入企业编码" autoComplete="organization" />
          </Form.Item>
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
