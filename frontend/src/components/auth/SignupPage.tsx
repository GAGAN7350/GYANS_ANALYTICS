import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Typography, message, Progress } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;

const SignupPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const signup = useAuthStore((state) => state.signup);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const checkPasswordStrength = (val: string) => {
    let score = 0;
    if (!val) return setPasswordStrength(0);
    if (val.length > 5) score += 20;
    if (val.length > 8) score += 20;
    if (/[A-Z]/.test(val)) score += 20;
    if (/[0-9]/.test(val)) score += 20;
    if (/[^A-Za-z0-9]/.test(val)) score += 20;
    setPasswordStrength(score);
  };

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      await signup({ 
        email: values.email, 
        password: values.password,
        fullName: values.fullName 
      });
      message.success('Account created successfully!');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Create an Account</Title>
        <Text type="secondary">Join GYANS Analytics today</Text>
      </div>

      <Form
        form={form}
        name="signup"
        onFinish={onFinish}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="fullName"
          rules={[{ required: true, message: 'Please input your full name!' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="Full Name" />
        </Form.Item>

        <Form.Item
          name="email"
          rules={[{ required: true, message: 'Please input your email!' }, { type: 'email', message: 'Invalid email format' }]}
        >
          <Input prefix={<MailOutlined />} placeholder="Email" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: 'Please input your password!' },
            { min: 8, message: 'Password must be at least 8 characters' }
          ]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="Password" 
            onChange={(e) => checkPasswordStrength(e.target.value)}
          />
        </Form.Item>

        {passwordStrength > 0 && (
          <div style={{ marginTop: -16, marginBottom: 16, padding: '0 4px' }}>
            <Progress 
              percent={passwordStrength} 
              showInfo={false} 
              size="small" 
              status={passwordStrength < 40 ? 'exception' : passwordStrength < 80 ? 'normal' : 'success'}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Password strength: {passwordStrength < 40 ? 'Weak' : passwordStrength < 80 ? 'Good' : 'Strong'}
            </Text>
          </div>
        )}

        <Form.Item
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password!' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('The two passwords do not match!'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" />
        </Form.Item>

        <Form.Item
          name="agreement"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value ? Promise.resolve() : Promise.reject(new Error('Should accept agreement')),
            },
          ]}
          style={{ marginBottom: 16 }}
        >
          <Checkbox>
            I have read the <a href="">Terms and Conditions</a>
          </Checkbox>
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
            Sign up
          </Button>
        </Form.Item>
        
        <div style={{ textAlign: 'center' }}>
          <Text>Already have an account? <Link to="/login">Log in</Link></Text>
        </div>
      </Form>
    </div>
  );
};

export default SignupPage;
