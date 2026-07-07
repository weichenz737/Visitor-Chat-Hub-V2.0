import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, theme, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  CustomerServiceOutlined,
  MessageOutlined,
  FileTextOutlined,
  FolderOutlined,
  SettingOutlined,
  UserOutlined,
  LoginOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useChatStore } from '@cs/shared/src/store';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/tenants', icon: <TeamOutlined />, label: '租户管理' },
  {
    key: 'agents-group',
    icon: <CustomerServiceOutlined />,
    label: '客服管理',
    children: [
      { key: '/agents', label: '全部客服' },
      { key: '/agents/online', label: '在线客服' },
      { key: '/agents/suspended', label: '冻结客服' },
    ],
  },
  { key: '/sessions', icon: <MessageOutlined />, label: '会话管理' },
  { key: '/files', icon: <FolderOutlined />, label: '文件管理' },
  { key: '/logs', icon: <FileTextOutlined />, label: '操作日志' },
  { key: '/login-logs', icon: <LoginOutlined />, label: '登录日志' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useChatStore();
  const { token } = theme.useToken();

  const selectedKey = location.pathname;
  const openKeys = selectedKey.startsWith('/agents') ? ['agents-group'] : [];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={220}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: collapsed ? 14 : 16,
          }}
        >
          {collapsed ? 'Platform' : '平台管理后台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => {
            if (!key.endsWith('-group')) navigate(key);
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => {
                    logout();
                    navigate('/login');
                  },
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <UserOutlined />
              <Typography.Text>{auth?.name ?? auth?.userId}</Typography.Text>
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
