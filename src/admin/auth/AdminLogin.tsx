import { useState, type FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAdminAuth } from './AdminAuthContext';

/**
 * Admin sign-in.
 *
 * By design this screen has exactly two fields and a submit button:
 * - no "sign up" control, because accounts are created by hand in the
 *   Supabase dashboard and granted in public.admins;
 * - no password-reset control, so nothing here can mint an account.
 */
export function AdminLogin() {
  const { signIn, busy, error } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signIn(email.trim(), password);
  };

  return (
    <div className='admin-shell flex min-h-screen items-center justify-center bg-background px-4'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>Enter your administrator email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-1.5'>
              <label
                htmlFor='admin-email'
                className='block text-sm font-medium leading-none'
              >
                Email
              </label>
              <input
                id='admin-email'
                name='email'
                type='email'
                required
                autoComplete='email'
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
              />
            </div>

            <div className='space-y-1.5'>
              <label
                htmlFor='admin-password'
                className='block text-sm font-medium leading-none'
              >
                Password
              </label>
              <input
                id='admin-password'
                name='password'
                type='password'
                required
                // current-password (not new-password): this form only ever
                // signs in, it never creates or resets a password.
                autoComplete='current-password'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
              />
            </div>

            {error ? (
              <p
                role='alert'
                className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
              >
                {error}
              </p>
            ) : null}

            <button
              type='submit'
              disabled={busy}
              className='w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
