import { createBrowserRouter, Navigate } from 'react-router';
import { PublicOnly, RequireAuth, RequireConsented, RequireOnboarded } from './guards';
import AuthLayout from '@/layouts/AuthLayout';
import AppLayout from '@/layouts/AppLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import OnboardingPage from '@/pages/OnboardingPage';
import ConsentPage from '@/pages/ConsentPage';
import PolicyPage from '@/pages/legal/PolicyPage';
import TodayPage from '@/pages/TodayPage';
import DayPage from '@/pages/DayPage';
import TemplatesPage from '@/pages/TemplatesPage';
import ProgressPage from '@/pages/ProgressPage';
import BodyPage from '@/pages/BodyPage';
import ProfilePage from '@/pages/ProfilePage';
import MacrosPage from '@/pages/MacrosPage';
import GoalPage from '@/pages/GoalPage';
import PremiumPage from '@/pages/PremiumPage';
import NotFoundPage from '@/pages/NotFoundPage';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/today" replace /> },
  // Public legal documents: linked from register before an account exists,
  // and the URL doubles as the hosted policy page app stores require.
  { path: '/legal/privacy', element: <PolicyPage doc="privacy" /> },
  { path: '/legal/terms', element: <PolicyPage doc="terms" /> },
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
    children: [{ path: '/consent', element: <ConsentPage /> }],
  },
  {
    // Consent gates everything, onboarding included: body data is collected
    // there, and Ley 8968 requires consent BEFORE collection.
    element: <RequireConsented />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <RequireOnboarded />,
        children: [
          { path: '/premium', element: <PremiumPage /> },
          {
            element: <AppLayout />,
            children: [
              { path: '/today', element: <TodayPage /> },
              { path: '/day/:date', element: <DayPage /> },
              { path: '/templates', element: <TemplatesPage /> },
              { path: '/progress', element: <ProgressPage /> },
              { path: '/progress/body', element: <BodyPage /> },
              { path: '/profile', element: <ProfilePage /> },
              { path: '/profile/macros', element: <MacrosPage /> },
              { path: '/profile/goal', element: <GoalPage /> },
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
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export default router;
