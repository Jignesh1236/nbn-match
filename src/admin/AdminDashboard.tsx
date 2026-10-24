import { useEffect, useState } from 'react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className='admin-shell min-h-screen bg-background text-foreground'>
      {/* ── top nav ── */}
      <header className='sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm'>
        <div className='mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6'>
          {/* brand */}
          <div className='flex min-w-0 flex-col'>
            <span className='text-sm font-bold tracking-tight text-foreground'>NBN Admin</span>
            {email ? (
              <span className='hidden truncate text-xs text-muted-foreground sm:block'>{email}</span>
            ) : null}
          </div>

          {/* desktop nav */}
          <nav className='hidden items-center gap-2 sm:flex'>
            <Link
              to={`${adminPath}/registrations`}
              className='flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted'
            >
              <span className='icon' style={{ fontSize: 16 }}>list_alt</span>
              Registrations
            </Link>
            <button
              type='button'
              onClick={() => void signOut()}
              disabled={busy}
              className='flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive shadow-sm transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60'
            >
              <span className='icon' style={{ fontSize: 16 }}>logout</span>
              {busy ? 'Signing out…' : 'Log out'}
            </button>
          </nav>

          {/* mobile hamburger */}
          <button
            type='button'
            className='flex items-center rounded-md border border-border p-2 sm:hidden'
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label='Toggle menu'
          >
            <span className='icon' style={{ fontSize: 20 }}>
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

        {/* mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className='border-t border-border bg-card px-4 py-3 sm:hidden'>
            {email ? (
              <p className='mb-3 truncate text-xs text-muted-foreground'>{email}</p>
            ) : null}
            <div className='flex flex-col gap-2'>
              <Link
                to={`${adminPath}/registrations`}
                onClick={() => setMobileMenuOpen(false)}
                className='flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium'
              >
                <span className='icon' style={{ fontSize: 16 }}>list_alt</span>
                Registrations
              </Link>
              <button
                type='button'
                onClick={() => { setMobileMenuOpen(false); void signOut(); }}
                disabled={busy}
                className='flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive disabled:opacity-60'
              >
                <span className='icon' style={{ fontSize: 16 }}>logout</span>
                {busy ? 'Signing out…' : 'Log out'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── main content ── */}
      <main className='mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8'>
        <div>
          <h2 className='text-lg font-semibold tracking-tight'>Event management</h2>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            Create and configure events for matchmaking registration.
          </p>
        </div>
        <EventsManager />
      </main>
    </div>
  );
}
