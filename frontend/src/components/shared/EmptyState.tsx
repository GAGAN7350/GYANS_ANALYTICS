import React from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center'
    }}>
      <div style={{ 
        fontSize: 48, 
        color: '#bfbfbf', 
        marginBottom: 16 
      }}>
        {icon}
      </div>
      <Title level={4} style={{ margin: 0, marginBottom: 8 }}>{title}</Title>
      <Text type="secondary" style={{ display: 'block', maxWidth: 400, marginBottom: 24 }}>
        {description}
      </Text>
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
