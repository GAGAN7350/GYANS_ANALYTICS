import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      await login({ email: values.email, password: values.password });
      message.success('Login successful!');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Welcome Back</Title>
        <Text type="secondary">Sign in to continue to GYANS Analytics</Text>
      </div>

      <Form
        name="login"
        initialValues={{ remember: true }}
        onFinish={onFinish}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="email"
          rules={[{ required: true, message: 'Please input your email!' }, { type: 'email', message: 'Invalid email format' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="Email" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: 'Please input your password!' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>Remember me</Checkbox>
          </Form.Item>
          <Link to="/forgot-password" style={{ float: 'right' }}>
            Forgot password?
          </Link>
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
            Log in
          </Button>
        </Form.Item>
        
        <div style={{ textAlign: 'center' }}>
          <Text>Don't have an account? <Link to="/signup">Sign up</Link></Text>
        </div>
      </Form>
    </div>
  );
};

export default LoginPage;
