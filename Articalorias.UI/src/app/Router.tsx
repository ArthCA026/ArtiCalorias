import { createBrowserRouter, Navigate } from 'react-router';
import { PublicOnly, RequireAuth, RequireConsented, RequireOnboarded, RequireSubscribed } from './guards';
import CatalogBoundary from './CatalogBoundary';
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
import SubscribePage from '@/pages/SubscribePage';
import SubscriptionPage from '@/pages/SubscriptionPage';
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
      {
        // The macro catalog is loaded once here for onboarding and the app.
        element: <CatalogBoundary />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          {
            element: <RequireOnboarded />,
            children: [
              // The paywall comes AFTER onboarding on purpose: the user meets
              // it with their plan already built, not as a cold first screen.
              { path: '/subscribe', element: <SubscribePage /> },
              {
                // Subscription-only product: the app itself sits behind this.
                element: <RequireSubscribed />,
                children: [
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
                      { path: '/profile/subscription', element: <SubscriptionPage /> },
                    ],
                  },
                  // Legacy routes from the previous UI
                  { path: '/favorites', element: <Navigate to="/templates" replace /> },
                  { path: '/activities', element: <Navigate to="/templates" replace /> },
                  { path: '/history', element: <Navigate to="/progress" replace /> },
                  { path: '/history/:date', element: <Navigate to="/progress" replace /> },
                  { path: '/settings', element: <Navigate to="/profile" replace /> },
                  { path: '/premium', element: <Navigate to="/profile/subscription" replace /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export default router;
