import React from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action }) => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start',
      marginBottom: 24
    }}>
      <div>
        <Title level={3} style={{ margin: 0, marginBottom: subtitle ? 4 : 0 }}>
          {title}
        </Title>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export default PageHeader;
