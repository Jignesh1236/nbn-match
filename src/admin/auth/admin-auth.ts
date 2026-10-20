/**
 * Supabase calls used by the admin area.
 *
 * Deliberately React-free: the auth guard, the login screen and the MFA
 * screens all import from here, so every security decision lives in one place.
 */
import { supabase } from '@/lib/supabase';

/** Sign the admin out after this long without user activity. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Label shown in the authenticator app. */
const TOTP_ISSUER = 'NBN Match Making';
const TOTP_FRIENDLY_NAME = 'Admin authenticator';

export type IsAdminVerdict = 'authorized' | 'not-admin' | 'error';

/**
 * Ask the database whether the signed-in user is a row in public.admins.
 *
 * 'error' is kept distinct from 'not-admin': a dropped connection must not be
 * reported as "you are not an admin", but callers must treat anything other
 * than 'authorized' as a failure so the guard can never open on a bad answer.
 */
export async function checkIsAdmin(): Promise<IsAdminVerdict> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) return 'error';
    return data === true ? 'authorized' : 'not-admin';
  } catch {
    return 'error';
  }
}

export type MfaState = {
  /** 'aal2' once a factor has been verified for this session. */
  currentLevel: string | null;
  /** Verified TOTP factor to challenge, or null when none is enrolled yet. */
  verifiedTotpFactorId: string | null;
};

/**
 * Read the session's assurance level and its verified TOTP factor together.
 * Returns null when either call fails so callers can fail closed.
 */
export async function readMfaState(): Promise<MfaState | null> {
  try {
    const [aal, factors] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    if (aal.error || factors.error) return null;
    const aalData = aal.data;
    const factorData = factors.data;
    if (!aalData || !factorData) return null;
    const verified = factorData.totp ?? [];
    return {
      currentLevel: aalData.currentLevel,
      verifiedTotpFactorId: verified[0]?.id ?? null,
    };
  } catch {
    return null;
  }
}

export type TotpEnrollment = {
  factorId: string;
  /** Raw SVG markup for the QR code, exactly as Supabase returned it. */
  qrCode: string;
  /** Base32 secret, for manual entry when the QR code cannot be scanned. */
  secret: string;
  /** otpauth:// URI encoded by the QR code. */
  uri: string;
};

export type EnrollResult = { enrollment: TotpEnrollment } | { error: string };

/**
 * Start a fresh TOTP enrolment.
 *
 * Any unverified factor left behind by an abandoned attempt is removed first:
 * Supabase only reveals the secret at enrolment time, so re-enrolling is the
 * only way to hand the user a working QR code again.
 */
export async function enrollTotp(): Promise<EnrollResult> {
  try {
    const existing = await supabase.auth.mfa.listFactors();
    if (!existing.error && existing.data) {
      for (const factor of existing.data.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: TOTP_FRIENDLY_NAME,
      issuer: TOTP_ISSUER,
    });
    if (error) return { error: error.message };
    if (!data || !data.totp) return { error: 'Enrolment did not return a QR code.' };

    return {
      enrollment: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not start enrolment.' };
  }
}

/**
 * Challenge the factor, then verify the 6-digit code. On success Supabase
 * promotes the stored session to aal2.
 *
 * @returns an error message, or null on success.
 */
export async function verifyTotp(factorId: string, code: string): Promise<string | null> {
  try {
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) return challenge.error.message;
    if (!challenge.data) return 'Could not start verification.';

    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verified.error) return verified.error.message;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Verification failed.';
  }
}

/**
 * End the session.
 *
 * A global sign-out revokes every refresh token for the account, but needs the
 * network. If that fails we still clear the local session, so an offline
 * sign-out (including the "not an admin" sign-out) can never leave a usable
 * session behind in storage.
 */
export async function endSession(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
    console.warn('[admin] global sign-out failed, retrying locally:', error.message);
  } catch (e) {
    console.warn('[admin] global sign-out threw, retrying locally:', e);
  }
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.warn('[admin] local sign-out failed:', error.message);
  } catch (e) {
    console.warn('[admin] local sign-out threw:', e);
  }
}

/**
 * Build a data URI for the QR SVG.
 *
 * Kept as a fallback only. Inline rendering via prepareQrSvg() is the primary
 * path: the markup is URI-encoded here because the SVG carries `#` in it, and
 * an unencoded `#` would be read as a URL fragment, truncating the image.
 */
export function totpQrDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Prepare the raw SVG Supabase returns for inline rendering.
 *
 * Inline rendering (via dangerouslySetInnerHTML) is the primary path because
 * data-URI images silently fail on some Supabase SVG payloads: they may omit
 * width/height (collapsing to 0x0) or rely on encoding the browser does not
 * apply the same way.
 *
 * The markup is scrubbed first — `<script>` elements, inline event handlers
 * and javascript: hrefs are stripped — then explicit width/height are injected
 * so the code cannot collapse even when the server SVG omits them.
 */
export function prepareQrSvg(svg: string, size = 160): string {
  const withoutScripts = svg.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  const withoutHandlers = withoutScripts.replace(
    /\son\w[\w-]*\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    '',
  );
  const safeHrefs = withoutHandlers
    .replace(
      /(href\s*=\s*)("[^"]*"|'[^']*')/gi,
      (match, prefix: string, quoted: string) =>
        /^\s*["']\s*javascript:/i.test(quoted) ? `${prefix}"#"` : match,
    )
    .replace(
      /(xlink:href\s*=\s*)("[^"]*"|'[^']*')/gi,
      (match, prefix: string, quoted: string) =>
        /^\s*["']\s*javascript:/i.test(quoted) ? `${prefix}"#"` : match,
    );
  return safeHrefs.replace(/<svg\b([^>]*)>/i, (_tag: string, attrs: string) => {
    let out = attrs;
    if (!/\bwidth\s*=/i.test(out)) out += ` width="${size}"`;
    if (!/\bheight\s*=/i.test(out)) out += ` height="${size}"`;
    return `<svg${out}>`;
  });
}
