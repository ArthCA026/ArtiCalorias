import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/hooks/useAuth';
import router from '@/app/Router';

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
