import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAdminAuth } from './AdminAuthContext';
import { enrollTotp, prepareQrSvg, totpQrDataUrl, type TotpEnrollment } from './admin-auth';

interface AdminMfaProps {
  /** `setup` enrolls a new authenticator; `verify` just asks for a code. */
  mode: 'setup' | 'verify';
}

/**
 * TOTP enrolment and verification.
 *
 * Shown only after is_admin() has already passed, so nothing here can be
 * reached by a non-admin. The dashboard stays closed until a code verifies,
 * which promotes the session to aal2.
 */
export function AdminMfa({ mode }: AdminMfaProps) {
  const { verifyCode, busy, error, totpFactorId } = useAdminAuth();
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [enrolling, setEnrolling] = useState(mode === 'setup');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  // True while the inline SVG path is preferred; flipped off only if the
  // browser reports the data-URI fallback image as broken too. When neither
  // QR path works the manual secret below remains usable.
  const [qrBroken, setQrBroken] = useState(false);

  // Sanitised, explicitly-sized inline SVG. Memoised so the QR does not
  // re-render (and flicker) while the user types their code.
  const inlineQr = useMemo(
    () => (enrollment ? prepareQrSvg(enrollment.qrCode) : null),
    [enrollment],
  );

  // In setup mode we must enroll first: the factor only becomes challengeable
  // once Supabase has handed back a factorId and a secret to scan.
  useEffect(() => {
    if (mode !== 'setup') return;
    let cancelled = false;

    void (async () => {
      const result = await enrollTotp();
      if (cancelled) return;
      if ('error' in result) {
        setEnrollError(result.error);
      } else {
        setEnrollment(result.enrollment);
      }
      setEnrolling(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Setup verifies against the factor we just created; verify mode uses the
  // already-verified factor recorded by the guard.
  const factorId = mode === 'setup' ? enrollment?.factorId ?? null : totpFactorId;
  const canSubmit = !busy && Boolean(factorId) && code.trim().length === 6;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId) return;
    await verifyCode(factorId, code.trim());
    setCode('');
  };

  return (
    <div className='admin-shell flex min-h-screen items-center justify-center bg-background px-4'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>
            {mode === 'setup' ? 'Set up two-factor' : 'Two-factor verification'}
          </CardTitle>
          <CardDescription>
            {mode === 'setup'
              ? 'Scan the QR code with your authenticator app, then enter the 6-digit code it shows.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-4'>
          {mode === 'setup' ? (
            <div className='space-y-3'>
              {enrolling ? (
                <p className='text-sm text-muted-foreground'>Generating a QR code…</p>
              ) : null}

              {enrollError ? (
                <p
                  role='alert'
                  className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                >
                  {enrollError}
                </p>
              ) : null}

              {enrollment ? (
                <>
                  {/*
                    Primary path: render the QR SVG inline. Data-URI <img>
                    rendering silently fails on some Supabase SVG payloads, so
                    inline avoids the encoding question entirely. Fallback: a
                    data-URI <img>, shown only if the inline markup somehow
                    produced nothing.
                  */}
                  {inlineQr && !qrBroken ? (
                    <div
                      role='img'
                      aria-label='QR code to scan with your authenticator app'
                      className='mx-auto h-40 w-40 rounded-md border border-border bg-white p-2 [&>svg]:h-full [&>svg]:w-full'
                      // The SVG comes from Supabase and is scrubbed in
                      // prepareQrSvg() (no scripts, handlers or javascript: hrefs).
                      dangerouslySetInnerHTML={{ __html: inlineQr }}
                    />
                  ) : (
                    <img
                      src={totpQrDataUrl(enrollment.qrCode)}
                      alt='QR code to scan with your authenticator app'
                      onError={() => setQrBroken(true)}
                      className='mx-auto h-40 w-40 rounded-md border border-border bg-white p-2'
                    />
                  )}
                  {qrBroken ? (
                    <p role='alert' className='text-center text-xs text-muted-foreground'>
                      The QR image would not display — please use the manual key below.
                    </p>
                  ) : null}
                  <div className='space-y-1 text-center'>
                    <p className='text-xs text-muted-foreground'>
                      Cannot scan? Enter this key manually:
                    </p>
                    <p className='break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground'>
                      {enrollment.secret}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-1.5'>
              <label
                htmlFor='admin-totp-code'
                className='block text-sm font-medium leading-none'
              >
                Authentication code
              </label>
              <input
                id='admin-totp-code'
                name='code'
                type='text'
                inputMode='numeric'
                autoComplete='one-time-code'
                pattern='[0-9]{6}'
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ''))}
                placeholder='123456'
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-base tracking-[0.5em] text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
              disabled={!canSubmit}
              className='w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {busy ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
