import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Input, Modal, Form, Typography, Space } from 'antd';
import { PlusOutlined, SearchOutlined, BarChartOutlined, MoreOutlined } from '@ant-design/icons';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Dashboard } from '@/types';

const { Text } = Typography;

const DashboardListPage: React.FC = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Mock data for now
  useEffect(() => {
    setDashboards([
      { id: '1', workspaceId: 'w1', name: 'Sales Overview', description: 'Q3 Sales analysis by region', widgets: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', workspaceId: 'w1', name: 'Marketing ROI', description: 'Campaign performance metrics', widgets: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]);
  }, []);

  const handleCreate = () => {
    form.validateFields().then(values => {
      const newDashboard: Dashboard = {
        id: Math.random().toString(),
        workspaceId: 'w1',
        name: values.name,
        description: values.description,
        widgets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setDashboards([...dashboards, newDashboard]);
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  return (
    <div>
      <PageHeader
        title="Dashboards"
        subtitle="Manage and view your data visualizations"
        action={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            New Dashboard
          </Button>
        }
      />

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Input
          placeholder="Search dashboards..."
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
        />
      </div>

      {dashboards.length === 0 ? (
        <EmptyState
          icon={<BarChartOutlined />}
          title="No Dashboards Yet"
          description="Create your first dashboard to start visualizing your data."
          action={
            <Button type="primary" onClick={() => setIsModalVisible(true)}>
              Create Dashboard
            </Button>
          }
        />
      ) : (
        <Row gutter={[24, 24]}>
          {dashboards.map((dashboard) => (
            <Col xs={24} sm={12} md={8} lg={6} key={dashboard.id}>
              <Card
                hoverable
                styles={{ body: { padding: '16px' } }}
                actions={[
                  <Button type="text" block>View</Button>,
                  <Button type="text" icon={<MoreOutlined />} />
                ]}
              >
                <div style={{ height: 120, background: '#f5f5f5', borderRadius: 4, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf' }}>
                  <BarChartOutlined style={{ fontSize: 48 }} />
                </div>
                <Card.Meta
                  title={dashboard.name}
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary" ellipsis style={{ width: '100%' }}>{dashboard.description || 'No description'}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>Updated just now</Text>
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="Create New Dashboard"
        open={isModalVisible}
        onOk={handleCreate}
        onCancel={() => setIsModalVisible(false)}
        okText="Create"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="e.g., Sales Overview" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Optional description..." rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DashboardListPage;
