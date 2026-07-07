import { useEffect, useState } from 'react';
import { Button, Card, Input, Popconfirm, Space, Typography, message } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { tenantApi } from '../api/client';
import { useChatStore } from '@cs/shared/src/store';

export default function ApiPage() {
  const { auth } = useChatStore();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setProfile(await tenantApi.profile());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const apiKey = (profile?.apiKey as string) ?? '';
  const slug = (profile?.slug as string) ?? '';
  const sdkCode = apiKey
    ? `<script src="http://localhost:5176/dist/cs-widget.iife.js"></script>\n<script>\n  CSWidget.init('${apiKey}', { slug: '${slug}' });\n</script>`
    : '';

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制');
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>API / SDK</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>
      <Card title="API Key" loading={loading}>
        <Space>
          <Typography.Text code>{apiKey}</Typography.Text>
          <Button icon={<CopyOutlined />} onClick={() => copy(apiKey)}>复制</Button>
          {auth?.staffRole === 'TENANT_ADMIN' && (
            <Popconfirm title="确认重新生成？旧 Key 将失效" onConfirm={async () => {
              const t = await tenantApi.regenerateApiKey();
              setProfile(t);
              message.success('已重新生成');
            }}>
              <Button danger>重新生成</Button>
            </Popconfirm>
          )}
        </Space>
      </Card>
      <Card title="SDK 接入代码">
        <Input.TextArea rows={6} value={sdkCode} readOnly />
        <Button style={{ marginTop: 8 }} icon={<CopyOutlined />} onClick={() => copy(sdkCode)}>复制代码</Button>
      </Card>
    </Space>
  );
}
