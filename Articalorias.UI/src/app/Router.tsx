import { createBrowserRouter, Navigate } from 'react-router';
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards';
import AuthLayout from '@/layouts/AuthLayout';
import AppLayout from '@/layouts/AppLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import OnboardingPage from '@/pages/OnboardingPage';
import TodayPage from '@/pages/TodayPage';
import TemplatesPage from '@/pages/TemplatesPage';
import ProgressPage from '@/pages/ProgressPage';
import ProfilePage from '@/pages/ProfilePage';
import PremiumPage from '@/pages/PremiumPage';
import NotFoundPage from '@/pages/NotFoundPage';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/today" replace /> },
  {
    element: <PublicOnly />,
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
  {
    element: <RequireAuth />,
    children: [{ path: '/onboarding', element: <OnboardingPage /> }],
  },
  {
    element: <RequireOnboarded />,
    children: [
      { path: '/premium', element: <PremiumPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/today', element: <TodayPage /> },
          { path: '/templates', element: <TemplatesPage /> },
          { path: '/progress', element: <ProgressPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
      // Legacy routes from the previous UI
      { path: '/favorites', element: <Navigate to="/templates" replace /> },
      { path: '/activities', element: <Navigate to="/templates" replace /> },
      { path: '/history', element: <Navigate to="/progress" replace /> },
      { path: '/history/:date', element: <Navigate to="/progress" replace /> },
      { path: '/settings', element: <Navigate to="/profile" replace /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export default router;
