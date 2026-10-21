import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from './auth/AdminAuthContext';
import { EventsManager } from './EventsManager';

/**
 * Admin dashboard.
 *
 * Mounted lazily and only ever rendered by <Outlet /> inside the guard, so its
 * module is not even fetched before credentials pass. Any future admin data
 * fetching belongs here (or in child routes) — never in the guard, the login
 * screen or the MFA screen.
 */
export default function AdminDashboard() {
  const { email, signOut, busy } = useAdminAuth();

  // Keep search engines from indexing the admin area.
  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    if (meta) {
      meta.setAttribute('content', 'noindex, nofollow');
    } else {
      const el = document.createElement('meta');
      el.name = 'robots';
      el.content = 'noindex, nofollow';
      document.head.appendChild(el);
    }
  }, []);

  const adminPath = import.meta.env.VITE_ADMIN_PATH || '/nbn-admin';

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <header className='flex items-center justify-between gap-4 border-b border-border px-6 py-4'>
        <div>
          <h1 className='text-base font-semibold tracking-tight'>NBN Admin</h1>
          {email ? <p className='text-xs text-muted-foreground'>{email}</p> : null}
        </div>
        <nav className='flex items-center gap-3'>
          <Link
            to={`${adminPath}/registrations`}
            className='rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-opacity hover:opacity-90'
          >
            Registrations
          </Link>
          <button
            type='button'
            onClick={() => void signOut()}
            disabled={busy}
            className='rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {busy ? 'Signing out…' : 'Log out'}
          </button>
        </nav>
      </header>

      <main className='mx-auto max-w-6xl space-y-6 px-6 py-8'>
        <div>
          <h2 className='text-lg font-semibold tracking-tight'>Event management</h2>
          <p className='text-sm text-muted-foreground'>
            Create and configure events for matchmaking registration.
          </p>
        </div>
        <EventsManager />
      </main>
    </div>
  );
}
