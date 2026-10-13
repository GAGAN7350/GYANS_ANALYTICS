import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onFinish = async (_values: any) => {
    try {
      setLoading(true);
      // await api.post('/auth/forgot-password', { email: values.email });
      setTimeout(() => {
        setSubmitted(true);
        setLoading(false);
      }, 1000);
    } catch (error) {
      message.error('Failed to send reset link.');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center' }}>
        <Title level={3} style={{ marginBottom: 16 }}>Check your email</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          We've sent a password reset link to your email address.
        </Text>
        <Button type="primary" style={{ width: '100%', marginBottom: 16 }}>
          <Link to="/login">Return to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Reset Password</Title>
        <Text type="secondary">Enter your email to receive a reset link</Text>
      </div>

      <Form
        name="forgot_password"
        onFinish={onFinish}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="email"
          rules={[{ required: true, message: 'Please input your email!' }, { type: 'email', message: 'Invalid email format' }]}
        >
          <Input prefix={<MailOutlined />} placeholder="Email" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
            Send Reset Link
          </Button>
        </Form.Item>
        
        <div style={{ textAlign: 'center' }}>
          <Text><Link to="/login">Back to Login</Link></Text>
        </div>
      </Form>
    </div>
  );
};

export default ForgotPasswordPage;
