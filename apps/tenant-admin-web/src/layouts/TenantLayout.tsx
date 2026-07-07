import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, theme, Space, Typography, Tag } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  MessageOutlined,
  SettingOutlined,
  ApiOutlined,
  CommentOutlined,
  FolderOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useChatStore } from '@cs/shared/src/store';
import { agentRoleMap } from '../utils/status';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/agents', icon: <TeamOutlined />, label: '客服管理' },
  { key: '/sessions', icon: <MessageOutlined />, label: '会话管理' },
  { key: '/files', icon: <FolderOutlined />, label: '文件管理' },
  { key: '/quick-replies', icon: <CommentOutlined />, label: '企业常用语' },
  { key: '/api', icon: <ApiOutlined />, label: 'API / SDK' },
  { key: '/settings', icon: <SettingOutlined />, label: '企业设置' },
];

export default function TenantLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useChatStore();
  const { token } = theme.useToken();
  const roleLabel = auth?.staffRole
    ? agentRoleMap[auth.staffRole as keyof typeof agentRoleMap]
    : undefined;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark" width={220}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: collapsed ? 14 : 15,
        }}>
          {collapsed ? '企业' : '企业后台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: token.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{
            items: [{
              key: 'logout',
              icon: <LogoutOutlined />,
              label: '退出登录',
              onClick: () => { logout(); navigate('/login'); },
            }],
          }}>
            <Space style={{ cursor: 'pointer' }}>
              <UserOutlined />
              <Typography.Text>{auth?.name}</Typography.Text>
              {roleLabel && roleLabel !== auth?.name && (
                <Tag>{roleLabel}</Tag>
              )}
              {auth?.tenantCode && <Tag color="blue">{auth.tenantCode}</Tag>}
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
