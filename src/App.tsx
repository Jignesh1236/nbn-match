import { type ReactNode, Suspense, lazy, useEffect } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import HomePage from '@/pages/home';
import RegisterPage from '@/pages/register';
import { LanguageProvider } from '@/lib/language';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useLenis, resetScroll } from '@/hooks/use-lenis';

const AdminPage = lazy(() => import('@/admin/AdminPage'));
// Loaded only when <Outlet /> inside the guard renders it, so no admin module
// is fetched before the credentials + MFA checks pass.
const AdminDashboard = lazy(() => import('@/admin/AdminDashboard'));
const RegistrationsManager = lazy(() => import('@/admin/RegistrationsManager'));

function Router() {
  const location = useLocation();

  // Lenis is initialized once for the whole app.
  useLenis();

  // Scroll to top when navigating between routes (react-router does not do this).
  useEffect(() => {
    resetScroll();
  }, [location]);

  // Non-obvious admin path, set via VITE_ADMIN_PATH.
  const adminPath = import.meta.env.VITE_ADMIN_PATH || '/nbn-admin';

  return (
    <RoutedErrorBoundary>
      <Suspense fallback={null}>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/register' element={<RegisterPage />} />
          {/* Admin path is a layout route: AdminPage hosts the auth guard and
              only renders <Outlet /> (the dashboard) once the guard passes. */}
          <Route path={adminPath} element={<AdminPage />}>
            <Route index element={<AdminDashboard />} />
            <Route path='registrations' element={<RegistrationsManager />} />
          </Route>
          <Route path='*' element={<NotFound />} />
        </Routes>
      </Suspense>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const basename = import.meta.env.BASE_URL || '/';
  return (
    <LanguageProvider>
      <BrowserRouter basename={basename}>
        <Router />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;