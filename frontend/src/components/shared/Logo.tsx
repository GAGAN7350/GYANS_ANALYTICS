import React from 'react';
import { Space, Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';

const { Title } = Typography;

interface LogoProps {
  collapsed?: boolean;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ collapsed = false, size = 160 }) => {
  const theme = useUiStore((state) => state.theme);
  const color = theme === 'dark' ? '#ffffff' : '#000000';
  
  return (
    <Space align="center" size={8}>
      <div 
        style={{ 
          background: '#1890ff', 
          borderRadius: 6, 
          width: collapsed ? size : 32, 
          height: collapsed ? size : 32, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? size * 0.6 : 18
        }}
      >
        <BarChartOutlined />
      </div>
      {!collapsed && (
        <Title level={4} style={{ margin: 0, color, fontWeight: 700, fontSize: size > 40 ? 24 : 18 }}>
          GYANS <span style={{ color: '#1890ff' }}>Analytics</span>
        </Title>
      )}
    </Space>
  );
};

export default Logo;
