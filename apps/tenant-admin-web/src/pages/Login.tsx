import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useChatStore } from '@cs/shared/src/store';
import { accountRules } from '../utils/account';

export default function LoginPage() {
  const navigate = useNavigate();
  const { auth, loginTenantAdmin, loading } = useChatStore();
  const [form] = Form.useForm();
  const [error, setError] = useState('');

  useEffect(() => {
    if (auth?.role === 'tenant_admin') navigate('/', { replace: true });
  }, [auth, navigate]);

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
          initialValues={{ email: 'admin@demo.com', password: 'agent123', tenantCode: 'demo001' }}
          onFinish={async (values) => {
            setError('');
            try {
              await loginTenantAdmin(values.email, values.password, values.tenantCode);
              message.success('登录成功');
              navigate('/', { replace: true });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Form.Item name="tenantCode" label="企业编码" rules={[{ required: true }]}>
            <Input size="large" placeholder="demo001" />
          </Form.Item>
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
