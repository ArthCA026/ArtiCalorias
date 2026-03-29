import { createBrowserRouter, Navigate } from 'react-router';

import AppLayout from '@/layouts/AppLayout';
import AuthLayout from '@/layouts/AuthLayout';
import OnboardingLayout from '@/layouts/OnboardingLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicOnlyRoute from '@/components/PublicOnlyRoute';

import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import OnboardingPage from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/DashboardPage';
import HistoryPage from '@/pages/HistoryPage';
import ProfilePage from '@/pages/ProfilePage';
import ActivitiesPage from '@/pages/ActivitiesPage';
import NotFoundPage from '@/pages/NotFoundPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/today" replace />,
  },

  // Public routes — redirect to /today if already logged in
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },
    ],
  },

  // Protected routes — redirect to /login if not authenticated
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <OnboardingLayout />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { path: '/today', element: <DashboardPage /> },
          { path: '/history', element: <HistoryPage /> },
          { path: '/history/:date', element: <HistoryPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/activities', element: <ActivitiesPage /> },
        ],
      },
    ],
  },

  // Catch-all
  { path: '*', element: <NotFoundPage /> },
]);

export default router;
