import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import {
  IDLE_TIMEOUT_MS,
  checkIsAdmin,
  endSession,
  readMfaState,
  verifyTotp,
} from './admin-auth';

/**
 * Result of the guard that runs before any admin UI is allowed to render.
 *
 * - `loading`         session / admin check still in flight
 * - `unauthenticated` no session, or a check failed and we signed out
 * - `denied`          is_admin() answered false: signed out, nothing rendered
 * - `mfa-setup`       admin with no TOTP factor yet
 * - `mfa-verify`      admin with a factor, but this session is still aal1
 * - `authenticated`   admin at aal2 — only now does the dashboard mount
 */
export type AdminAuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'denied'
  | 'mfa-setup'
  | 'mfa-verify'
  | 'authenticated';

interface AdminAuthValue {
  status: AdminAuthStatus;
  email: string | null;
  busy: boolean;
  error: string | null;
  /** Verified TOTP factor to challenge when status is `mfa-verify`. */
  totpFactorId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-run is_admin() + the MFA check. Safe to call at any time. */
  refresh: () => Promise<void>;
  /** Challenge the factor and verify the code; refreshes on success. */
  verifyCode: (factorId: string, code: string) => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function useAdminAuth(): AdminAuthValue {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return value;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminAuthStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);

  /**
   * The single gate. Reads the session, asks is_admin(), then decides how far
   * the caller is allowed to get. Every branch ends in a definite status, so
   * there is no state from which the dashboard can render without a passing
   * answer.
   */
  const refresh = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setEmail(null);
        setTotpFactorId(null);
        setError(null);
        setStatus('unauthenticated');
        return;
      }
      setEmail(session.user?.email ?? null);

      const verdict = await checkIsAdmin();
      if (verdict === 'not-admin') {
        // Required behaviour: sign out and render nothing at all.
        await endSession();
        setEmail(null);
        setTotpFactorId(null);
        setError(null);
        setStatus('denied');
        return;
      }
      if (verdict === 'error') {
        // Fail closed, then surface it on the login screen so a network blip
        // is recoverable rather than silently reading as a denial.
        await endSession();
        setEmail(null);
        setTotpFactorId(null);
        setError('Could not verify admin access. Check your connection and try again.');
        setStatus('unauthenticated');
        return;
      }
      setError(null);

      const mfa = await readMfaState();
      if (!mfa) {
        await endSession();
        setEmail(null);
        setTotpFactorId(null);
        setError('Could not verify multi-factor status. Check your connection and try again.');
        setStatus('unauthenticated');
        return;
      }

      setTotpFactorId(mfa.verifiedTotpFactorId);
      if (mfa.currentLevel === 'aal2') {
        setStatus('authenticated');
        return;
      }
      setStatus(mfa.verifiedTotpFactorId ? 'mfa-verify' : 'mfa-setup');
    } catch (e) {
      await endSession();
      setEmail(null);
      setTotpFactorId(null);
      setError(e instanceof Error ? e.message : 'Unexpected error while checking access.');
      setStatus('unauthenticated');
    }
  }, []);

  const signIn = useCallback(
    async (emailValue: string, passwordValue: string) => {
      setBusy(true);
      setError(null);
      setStatus('loading');
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailValue,
          password: passwordValue,
        });
        if (signInError) {
          setError(signInError.message);
          setStatus('unauthenticated');
          return;
        }
        // Now, and only now, ask whether this account is an admin.
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await endSession();
      setEmail(null);
      setTotpFactorId(null);
      setError(null);
      setStatus('unauthenticated');
    } finally {
      setBusy(false);
    }
  }, []);

  const verifyCode = useCallback(
    async (factorId: string, code: string) => {
      if (!factorId) {
        setError('No authenticator is enrolled yet.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const failure = await verifyTotp(factorId, code);
        if (failure) {
          setError(failure);
          return;
        }
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  // Restore whatever session is already in storage on first mount.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Track sign-outs raised outside this provider, including the deliberate one
  // in the denial branch. `denied` is sticky so the event it just caused cannot
  // overwrite it with a login screen.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      setEmail(null);
      setTotpFactorId(null);
      setError(null);
      setStatus((prev) => (prev === 'denied' ? prev : 'unauthenticated'));
    });
    return () => subscription.unsubscribe();
  }, []);

  const sessionActive =
    status === 'mfa-setup' || status === 'mfa-verify' || status === 'authenticated';

  // Idle timeout. Any of these activity events pushes the deadline back; once
  // the window lapses the session ends and the guard closes.
  useEffect(() => {
    if (!sessionActive) return;

    let lastActivity = Date.now();
    const touch = () => {
      lastActivity = Date.now();
    };
    const activityEvents: string[] = [
      'pointerdown',
      'keydown',
      'wheel',
      'touchstart',
      'scroll',
      'input',
    ];
    for (const name of activityEvents) {
      window.addEventListener(name, touch, { passive: true });
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity < IDLE_TIMEOUT_MS) return;
      window.clearInterval(timer);
      void endSession().then(() => {
        setEmail(null);
        setTotpFactorId(null);
        setError(null);
        setStatus('unauthenticated');
      });
    }, 60_000);

    return () => {
      for (const name of activityEvents) {
        window.removeEventListener(name, touch);
      }
      window.clearInterval(timer);
    };
  }, [sessionActive]);

  const value = useMemo<AdminAuthValue>(
    () => ({
      status,
      email,
      busy,
      error,
      totpFactorId,
      signIn,
      signOut,
      refresh,
      verifyCode,
    }),
    [status, email, busy, error, totpFactorId, signIn, signOut, refresh, verifyCode],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
