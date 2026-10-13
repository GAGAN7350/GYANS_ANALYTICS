import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

// Layouts
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import AuthGuard from '@/components/auth/AuthGuard';

// Pages
import LoginPage from '@/components/auth/LoginPage';
import SignupPage from '@/components/auth/SignupPage';
import ForgotPasswordPage from '@/components/auth/ForgotPasswordPage';
import DashboardListPage from '@/components/dashboard/DashboardListPage';
import DatasetListPage from '@/components/dataset/DatasetListPage';
import DatasetDetailPage from '@/components/dataset/DatasetDetailPage';

const App: React.FC = () => {
  const currentTheme = useUiStore((state) => state.theme);
  const loadUser = useAuthStore((state) => state.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <Routes>
        {/* Public Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Protected App Routes */}
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/dashboards" replace />} />
          <Route path="dashboards" element={<DashboardListPage />} />
          <Route path="datasets" element={<DatasetListPage />} />
          <Route path="datasets/:id" element={<DatasetDetailPage />} />
          <Route path="queries" element={<div>Queries (Coming Soon)</div>} />
          <Route path="settings" element={<div>Settings (Coming Soon)</div>} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
};

export default App;
