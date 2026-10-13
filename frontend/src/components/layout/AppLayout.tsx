import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Breadcrumb } from 'antd';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  DatabaseOutlined,
  CodeOutlined,
  SettingOutlined,
  UserOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  BulbOutlined,
  BulbFilled,
  LogoutOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import Logo from '@/components/shared/Logo';

const { Header, Sider, Content } = Layout;

const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useUiStore();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { key: '/dashboards', icon: <DashboardOutlined />, label: <Link to="/dashboards">Dashboards</Link> },
    { key: '/datasets', icon: <DatabaseOutlined />, label: <Link to="/datasets">Datasets</Link> },
    { key: '/queries', icon: <CodeOutlined />, label: <Link to="/queries">Queries</Link> },
    { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">Settings</Link> },
  ];

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: handleLogout },
    ],
  };

  const pathnames = location.pathname.split('/').filter((x) => x);
  const breadcrumbItems = pathnames.map((value, index) => {
    const url = `/${pathnames.slice(0, index + 1).join('/')}`;
    return {
      title: <Link to={url}>{value.charAt(0).toUpperCase() + value.slice(1)}</Link>,
    };
  });

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={sidebarCollapsed} theme={theme === 'dark' ? 'dark' : 'light'} width={240} style={{ borderRight: theme === 'light' ? '1px solid #f0f0f0' : 'none' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: theme === 'light' ? '1px solid #f0f0f0' : '1px solid #303030' }}>
          <Logo collapsed={sidebarCollapsed} size={sidebarCollapsed ? 32 : 140} />
        </div>
        <Menu
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 16 }}
        />
      </Sider>
      
      <Layout>
        <Header style={{ padding: '0 24px', background: theme === 'light' ? '#fff' : '#141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: theme === 'light' ? '1px solid #f0f0f0' : '1px solid #303030' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
              style={{ fontSize: '16px', width: 64, height: 64, marginLeft: -24 }}
            />
            {breadcrumbItems.length > 0 && (
              <Breadcrumb items={breadcrumbItems} style={{ marginLeft: 16 }} />
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button type="text" icon={theme === 'light' ? <BulbOutlined /> : <BulbFilled />} onClick={toggleTheme} />
            <Button type="text" icon={<BellOutlined />} />
            
            <Dropdown menu={userMenu} placement="bottomRight" arrow>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} src={user?.avatarUrl} />
                <span style={{ fontWeight: 500 }}>{user?.fullName || 'User'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        <Content style={{ margin: '24px', background: theme === 'light' ? '#fff' : '#141414', borderRadius: 8, padding: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
