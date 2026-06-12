import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { LanguageProvider } from '@/hooks/useLanguage';
import { UnitsProvider } from '@/hooks/useUnits';
import router from '@/app/Router';
import { queryClient } from '@/lib/queryClient';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <UnitsProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
        </UnitsProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
