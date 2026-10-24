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
    <div className='admin-shell flex min-h-screen items-center justify-center bg-background px-4 py-8'>
      <Card className='w-full max-w-md shadow-lg'>
        <CardHeader className='text-center pb-2'>
          <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
            <span className='icon text-primary' style={{ fontSize: 24 }}>
              {mode === 'setup' ? 'qr_code_2' : 'lock'}
            </span>
          </div>
          <CardTitle className='text-xl'>
            {mode === 'setup' ? 'Set up two-factor auth' : 'Two-factor verification'}
          </CardTitle>
          <CardDescription className='mt-1'>
            {mode === 'setup'
              ? 'Scan the QR code with Google Authenticator or any TOTP app, then enter the 6-digit code.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-5 pt-2'>
          {mode === 'setup' ? (
            <div className='space-y-4'>
              {enrolling ? (
                <div className='flex flex-col items-center gap-2 py-6'>
                  <div className='h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary' />
                  <p className='text-sm text-muted-foreground'>Generating QR code…</p>
                </div>
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
                <div className='flex flex-col items-center gap-4'>
                  {/* QR code centered with decorative container */}
                  <div className='flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-5 w-full text-center'>
                    <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                      Scan with your authenticator app
                    </p>
                    <div className='flex items-center justify-center w-full'>
                      {inlineQr && !qrBroken ? (
                        <div
                          role='img'
                          aria-label='QR code to scan with your authenticator app'
                          className='h-52 w-52 rounded-lg border-2 border-border bg-white p-2 shadow-sm flex items-center justify-center [&>svg]:h-full [&>svg]:w-full'
                          // The SVG comes from Supabase and is scrubbed in
                          // prepareQrSvg() (no scripts, handlers or javascript: hrefs).
                          dangerouslySetInnerHTML={{ __html: inlineQr }}
                        />
                      ) : (
                        <img
                          src={totpQrDataUrl(enrollment.qrCode)}
                          alt='QR code to scan with your authenticator app'
                          onError={() => setQrBroken(true)}
                          className='h-52 w-52 rounded-lg border-2 border-border bg-white p-2 shadow-sm object-contain'
                        />
                      )}
                    </div>
                    {qrBroken ? (
                      <p role='alert' className='text-center text-xs text-muted-foreground'>
                        QR image failed to display — use the manual key below.
                      </p>
                    ) : null}
                  </div>

                  {/* manual secret */}
                  <div className='w-full space-y-1.5 text-center'>
                    <p className='text-xs text-muted-foreground'>
                      Cannot scan? Enter this key manually in your app:
                    </p>
                    <p className='break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground select-all'>
                      {enrollment.secret}
                    </p>
                  </div>
                </div>
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
                className='w-full rounded-md border border-input bg-background px-3 py-2.5 text-center font-mono text-lg tracking-[0.6em] text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
              className='w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {busy ? 'Verifying…' : 'Verify and continue →'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
