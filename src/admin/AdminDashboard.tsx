import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminAuth } from './auth/AdminAuthContext';

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

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <header className='flex items-center justify-between gap-4 border-b border-border px-6 py-4'>
        <div>
          <h1 className='text-base font-semibold tracking-tight'>NBN Admin</h1>
          {email ? <p className='text-xs text-muted-foreground'>{email}</p> : null}
        </div>
        <button
          type='button'
          onClick={() => void signOut()}
          disabled={busy}
          className='rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {busy ? 'Signing out…' : 'Log out'}
        </button>
      </header>

      <main className='mx-auto max-w-3xl px-6 py-8'>
        <Card>
          <CardHeader>
            <CardTitle>Event management</CardTitle>
            <CardDescription>
              Creating and editing events, and reviewing registrations, will be added here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground'>
              This area is only reachable after signing in, passing the is_admin() check, and
              completing two-factor verification.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
