import { Outlet } from 'react-router-dom';
import { AdminLogin } from './AdminLogin';
import { AdminMfa } from './AdminMfa';
import { useAdminAuth } from './AdminAuthContext';

/**
 * The admin route guard.
 *
 * Rendered as the layout element of the admin path, so the dashboard (its
 * child route) can only ever be reached by passing through here. The
 * dashboard's element is a lazily-loaded component: because `<Outlet />` is
 * not rendered until the guard passes, React never mounts it and never
 * triggers its module fetch, so no admin data is loaded beforehand.
 *
 * The one thing this guard cannot do is replace server-side enforcement — the
 * RLS policies on `events`, `registrations` and `audit_log` are what actually
 * stop a non-admin reading data, regardless of what this UI does.
 */
export function AdminRouteGuard() {
  const { status } = useAdminAuth();

  switch (status) {
    case 'loading':
      return (
        <div className='flex min-h-screen items-center justify-center bg-background'>
          <p className='text-sm text-muted-foreground'>Checking credentials…</p>
        </div>
      );

    case 'unauthenticated':
      return <AdminLogin />;

    case 'denied':
      // is_admin() said false: the session is gone and nothing is rendered.
      return null;

    case 'mfa-setup':
      return <AdminMfa mode='setup' />;

    case 'mfa-verify':
      return <AdminMfa mode='verify' />;

    case 'authenticated':
      return <Outlet />;

    default:
      // Defensive: an unknown status renders nothing rather than the dashboard.
      return null;
  }
}
