import { AdminAuthProvider } from './auth/AdminAuthContext';
import { AdminRouteGuard } from './auth/AdminRouteGuard';

/**
 * Admin area shell, lazy-loaded from the route path in VITE_ADMIN_PATH.
 *
 * It is a layout route: <AdminRouteGuard /> decides between the login screen,
 * the MFA screens, nothing (denied) or <Outlet /> (authenticated). The
 * dashboard is a child route, so it renders only once the guard opens.
 */
export default function AdminPage() {
  return (
    <AdminAuthProvider>
      <AdminRouteGuard />
    </AdminAuthProvider>
  );
}
