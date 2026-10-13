import React from 'react';
import { Layout, Card } from 'antd';
import { Outlet } from 'react-router-dom';
import { useUiStore } from '@/stores/uiStore';
import Logo from '@/components/shared/Logo';

const { Content } = Layout;

const AuthLayout: React.FC = () => {
  const theme = useUiStore((state) => state.theme);
  
  return (
    <Layout style={{ minHeight: '100vh', background: theme === 'dark' ? '#000' : '#f0f2f5' }}>
      <Content style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ marginBottom: 40 }}>
          <Logo collapsed={false} size={200} />
        </div>
        <Card 
          style={{ 
            width: '100%', 
            maxWidth: 400, 
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            borderRadius: 8
          }}
          bordered={false}
        >
          <Outlet />
        </Card>
      </Content>
    </Layout>
  );
};

export default AuthLayout;
