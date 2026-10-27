import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const SESSION_KEY = 'nbn_candidate_session_token';
const CANDIDATE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const functionHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
});

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

async function callCandidateFunction<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${CANDIDATE_FUNCTIONS_URL}/${fn}`, {
    method: 'POST',
    headers: functionHeaders(),
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = typeof payload?.error === 'string' ? payload.error : 'session_invalid';
    const error = new Error(code) as Error & { code?: string };
    error.code = code;
    throw error;
  }

  return payload as T;
}

type ProfileItem = {
  candidate_code: string;
  photo_path?: string | null;
  photo_url?: string | null;
  profile?: Record<string, unknown>;
  requested?: boolean;
};

type RequestItem = {
  candidate_code: string;
  status: 'sent' | 'withdrawn';
  created_at: string;
};

type CandidateOpenResponse = {
  ok: true;
  session_token: string;
  candidate_code: string;
  gender: string;
  opens_at: string;
  closes_at: string;
  server_now: string;
  max_requests: number;
  requests_used: number;
};

type CandidateProfilesResponse = {
  ok: true;
  items: ProfileItem[];
  requests_used: number;
  max_requests: number;
  closes_at: string;
  server_now: string;
};

type CandidateMyRequestsResponse = {
  ok: true;
  items: RequestItem[];
  requests_used: number;
  max_requests: number;
  closes_at: string;
  server_now: string;
};

type CandidateActionResponse = {
  ok: true;
  requests_used: number;
  max_requests: number;
};

function CandidatePage() {
  const navigate = useNavigate();
  const params = useParams();
  const routeToken = params.token ?? '';
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [requestsUsed, setRequestsUsed] = useState(0);
  const [maxRequests, setMaxRequests] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});
  const [serverNow, setServerNow] = useState<number | null>(null);
  const [closesAt, setClosesAt] = useState<number | null>(null);
  const [candidateCode, setCandidateCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(!sessionToken && !!routeToken);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const lastSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      const tag = document.createElement('meta');
      tag.name = 'robots';
      tag.content = 'noindex, nofollow';
      document.head.appendChild(tag);
    } else {
      meta.setAttribute('content', 'noindex, nofollow');
    }

    const referrer = document.querySelector('meta[name="referrer"]');
    if (!referrer) {
      const tag = document.createElement('meta');
      tag.name = 'referrer';
      tag.content = 'no-referrer';
      document.head.appendChild(tag);
    } else {
      referrer.setAttribute('content', 'no-referrer');
    }

    document.title = 'Candidate access | NBN';

    return () => {
      // leave metadata set to noindex for this route only.
    };
  }, []);

  useEffect(() => {
    if (!routeToken) {
      if (sessionToken) {
        setShowPhoneForm(false);
        setVerified(true);
      } else {
        setShowPhoneForm(false);
      }
      return;
    }

    if (!sessionToken) {
      setShowPhoneForm(true);
    }
  }, [routeToken, sessionToken]);

  const countdownSeconds = useMemo(() => {
    if (!closesAt || !serverNow) return null;
    return Math.max(0, Math.ceil((closesAt - serverNow) / 1000));
  }, [closesAt, serverNow]);

  useEffect(() => {
    const tick = () => setServerNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadSessionData = async (activeSessionToken: string) => {
    setLoadingProfiles(true);
    setError(null);

    try {
      const [profilesRes, requestsRes] = await Promise.all([
        callCandidateFunction<CandidateProfilesResponse>('candidate-profiles', {
          session_token: activeSessionToken,
        }),
        callCandidateFunction<CandidateMyRequestsResponse>('candidate-my-requests', {
          session_token: activeSessionToken,
        }),
      ]);

      setProfiles(profilesRes.items ?? []);
      setRequests(requestsRes.items ?? []);
      setRequestsUsed(profilesRes.requests_used ?? requestsRes.requests_used ?? 0);
      setMaxRequests(profilesRes.max_requests ?? requestsRes.max_requests ?? 8);
      setClosesAt(Date.parse(profilesRes.closes_at || requestsRes.closes_at || new Date().toISOString()));
      setServerNow(Date.parse(profilesRes.server_now || requestsRes.server_now || new Date().toISOString()));
      setVerified(true);
      setHasLoadedSession(true);
    } catch (err) {
      const code = err instanceof Error && err.message ? err.message : 'session_invalid';
      setError(code);
      sessionStorage.removeItem(SESSION_KEY);
      setSessionToken(null);
      setVerified(false);
      setHasLoadedSession(true);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    if (lastSessionRef.current === sessionToken) return;

    lastSessionRef.current = sessionToken;
    void loadSessionData(sessionToken);
  }, [sessionToken]);

  useEffect(() => {
    if (!routeToken || !sessionToken) return;
    if (window.location.pathname !== '/v') {
      navigate('/v', { replace: true });
    }
  }, [routeToken, sessionToken, navigate]);

  const verifyPhone = async () => {
    if (!routeToken) {
      setError('invalid_link');
      return;
    }

    const digitsPhone = normalizeDigits(phone);
    if (!digitsPhone) {
      setError('wrong_phone');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const payload = await callCandidateFunction<CandidateOpenResponse>('candidate-open', {
        token: routeToken,
        phone: digitsPhone,
      });

      setCandidateCode(payload.candidate_code || '');
      sessionStorage.setItem(SESSION_KEY, payload.session_token);
      setSessionToken(payload.session_token);
      setRequestsUsed(payload.requests_used ?? 0);
      setMaxRequests(payload.max_requests ?? 8);
      setClosesAt(Date.parse(payload.closes_at));
      setServerNow(Date.parse(payload.server_now));
      setVerified(true);
      setShowPhoneForm(false);
      navigate('/v', { replace: true });
    } catch (err) {
      const code = err instanceof Error && err.message ? err.message : 'invalid_link';
      setError(code);
    } finally {
      setVerifying(false);
    }
  };

  const applyAction = async (targetCode: string, type: 'send' | 'withdraw') => {
    if (!sessionToken) return;
    setActioning(prev => ({ ...prev, [targetCode]: true }));
    setError(null);

    try {
      const fn = type === 'send' ? 'candidate-send-request' : 'candidate-withdraw-request';
      const result = await callCandidateFunction<CandidateActionResponse>(fn, {
        session_token: sessionToken,
        target_code: targetCode,
      });

      setRequestsUsed(result.requests_used ?? requestsUsed);
      setMaxRequests(result.max_requests ?? maxRequests);
      await loadSessionData(sessionToken);
    } catch (err) {
      const code = err instanceof Error && err.message ? err.message : 'session_invalid';
      setError(code);
    } finally {
      setActioning(prev => ({ ...prev, [targetCode]: false }));
    }
  };

  const hasReachedLimit = requestsUsed >= maxRequests;
  const isTimeOver = countdownSeconds !== null && countdownSeconds <= 0;

  if (!sessionToken && routeToken && !verified && showPhoneForm) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.badge}>Candidate access</div>
          <h1 style={styles.title}>Enter your phone number</h1>
          <p style={styles.subtitle}>Use the phone saved on your registration to continue.</p>
          <input
            type='tel'
            inputMode='numeric'
            autoComplete='tel'
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder='e.g. 01712345678'
            style={styles.input}
            aria-label='Phone number'
          />
          {error && <div style={styles.error}>{error}</div>}
          <button
            type='button'
            disabled={verifying}
            onClick={verifyPhone}
            style={{ ...styles.button, opacity: verifying ? 0.7 : 1 }}
          >
            {verifying ? 'Checking...' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  if (!sessionToken && !routeToken && !hasLoadedSession) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.badge}>Candidate access</div>
          <h1 style={styles.title}>No active session</h1>
          <p style={styles.subtitle}>Please use your personal link to continue.</p>
        </div>
      </div>
    );
  }

  if (!sessionToken && !routeToken && hasLoadedSession) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.badge}>Candidate access</div>
          <h1 style={styles.title}>Session expired</h1>
          <p style={styles.subtitle}>Please reopen your personal link and verify again.</p>
        </div>
      </div>
    );
  }

  if (loadingProfiles || !sessionToken) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.badge}>Candidate access</div>
          <h1 style={styles.title}>Loading profiles...</h1>
        </div>
      </div>
    );
  }

  if (isTimeOver) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.badge}>Time is over</div>
          <h1 style={styles.title}>This candidate link is no longer active.</h1>
          <p style={styles.subtitle}>The request window has ended.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.watermark}>Candidate code: {candidateCode || '—'}</div>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badge}>Available matches</div>
            <h1 style={styles.title}>Your profile list</h1>
          </div>
          <div style={styles.countBox}>
            {countdownSeconds !== null ? `${Math.max(0, Math.floor(countdownSeconds / 60))}m ${Math.max(0, countdownSeconds % 60)}s left` : 'Checking...'}
          </div>
        </div>

        <div style={styles.counterBar}>
          <span>{requestsUsed} of {maxRequests} requests used</span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {hasReachedLimit && (
          <div style={styles.limitBox}>Limit Full — You have used all {maxRequests} requests for this link.</div>
        )}

        <div style={styles.profileGrid}>
          {profiles.map(profile => {
            const requested = !!profile.requested;
            const key = profile.candidate_code;
            const isBusy = !!actioning[key];
            const canSend = !requested && !hasReachedLimit;

            return (
              <article key={key} style={styles.profileCard}>
                <div style={styles.imageWrap}>
                  {profile.photo_url ? (
                    <img
                      src={profile.photo_url}
                      alt={profile.candidate_code}
                      loading='lazy'
                      referrerPolicy='no-referrer'
                      style={styles.image}
                    />
                  ) : (
                    <div style={styles.imagePlaceholder}>No photo</div>
                  )}
                </div>

                <div style={styles.profileBody}>
                  <div style={styles.code}>{profile.candidate_code}</div>
                  {profile.profile && Object.entries(profile.profile).slice(0, 6).map(([label, value]) => (
                    <div key={`${key}-${label}`} style={styles.profileLine}>
                      <strong>{label}:</strong> {String(value ?? '—')}
                    </div>
                  ))}
                </div>

                <button
                  type='button'
                  onClick={() => applyAction(key, requested ? 'withdraw' : 'send')}
                  disabled={isBusy || (!canSend && !requested)}
                  style={{
                    ...styles.actionButton,
                    ...(requested ? styles.withdraw : styles.send),
                    opacity: isBusy || (!canSend && !requested) ? 0.6 : 1,
                  }}
                >
                  {isBusy ? 'Please wait...' : requested ? 'Withdraw' : 'Send'}
                </button>
              </article>
            );
          })}
        </div>

        <div style={styles.requestsCard}>
          <h2 style={styles.sectionTitle}>Your requests</h2>
          {requests.length === 0 ? (
            <p style={styles.muted}>No requests yet.</p>
          ) : (
            <ul style={styles.requestList}>
              {requests.map(request => (
                <li key={`${request.candidate_code}-${request.created_at}`} style={styles.requestRow}>
                  <span>{request.candidate_code}</span>
                  <span style={request.status === 'sent' ? styles.sentStatus : styles.withdrawnStatus}>
                    {request.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#fdf5f7',
    color: '#270d15',
    fontFamily: 'system-ui, sans-serif',
    padding: '16px',
  },
  container: {
    maxWidth: 980,
    margin: '0 auto',
    paddingBottom: 32,
  },
  card: {
    maxWidth: 520,
    margin: '20vh auto 0',
    background: '#ffffff',
    borderRadius: 18,
    border: '1px solid #efd2da',
    padding: 24,
    boxShadow: '0 10px 30px rgba(116, 18, 47, 0.08)',
  },
  badge: {
    display: 'inline-block',
    background: '#fbeaf0',
    color: '#7a1b42',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '12px 0 8px',
    fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
    lineHeight: 1.2,
  },
  subtitle: {
    margin: 0,
    color: '#5f4150',
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 18,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #e7c9d3',
    fontSize: 16,
    outline: 'none',
  },
  button: {
    width: '100%',
    marginTop: 18,
    border: 'none',
    borderRadius: 12,
    padding: '14px 16px',
    color: '#fff',
    background: '#9c2c52',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
  },
  error: {
    marginTop: 16,
    padding: '10px 12px',
    borderRadius: 10,
    background: '#fff1f3',
    border: '1px solid #f3c5d1',
    color: '#8d2944',
    fontSize: 14,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    marginTop: 12,
  },
  countBox: {
    background: '#ffffff',
    border: '1px solid #ecd6dc',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: '#7b1d46',
  },
  counterBar: {
    background: '#fef3f7',
    border: '1px solid #f0d7e0',
    borderRadius: 12,
    padding: '10px 12px',
    marginBottom: 16,
    fontWeight: 700,
  },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 16,
  },
  profileCard: {
    background: '#fff',
    border: '1px solid #eed6df',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 8px 16px rgba(81, 22, 32, 0.04)',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: '4 / 4.5',
    background: '#f7ebef',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#754a5d',
    fontWeight: 600,
  },
  profileBody: {
    padding: 14,
  },
  code: {
    fontWeight: 800,
    color: '#5a1838',
    marginBottom: 8,
  },
  profileLine: {
    fontSize: 13,
    color: '#4c2d39',
    lineHeight: 1.5,
    marginBottom: 2,
  },
  actionButton: {
    display: 'block',
    width: 'calc(100% - 24px)',
    margin: '0 12px 12px',
    padding: '12px 14px',
    border: 'none',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  send: {
    background: '#9c2c52',
    color: '#fff',
  },
  withdraw: {
    background: '#efeae7',
    color: '#3d2c32',
  },
  requestsCard: {
    marginTop: 20,
    background: '#fff',
    border: '1px solid #eed6df',
    borderRadius: 18,
    padding: 16,
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: 20,
  },
  muted: {
    color: '#6d5361',
    margin: 0,
  },
  requestList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: 10,
  },
  requestRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottom: '1px solid #f3e8eb',
    paddingBottom: 8,
  },
  sentStatus: {
    color: '#2b7a4b',
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  withdrawnStatus: {
    color: '#8b5a65',
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  limitBox: {
    marginBottom: 16,
    padding: '12px 14px',
    background: '#fff3dd',
    border: '1px solid #f1d6a4',
    color: '#704b10',
    borderRadius: 12,
    fontWeight: 700,
  },
  watermark: {
    position: 'fixed',
    right: 12,
    bottom: 12,
    transform: 'rotate(-12deg)',
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: '0.12em',
    color: 'rgba(100, 30, 50, 0.15)',
    pointerEvents: 'none',
    userSelect: 'none',
  },
};

export default CandidatePage;
