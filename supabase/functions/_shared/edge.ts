export type JsonObject = Record<string, unknown>;

/** Read a Supabase Edge Function secret without assuming the Deno global exists. */
function readEnv(name: string): string {
  const deno = (globalThis as {
    Deno?: { env?: { get: (key: string) => string | undefined } };
  }).Deno;
  if (!deno?.env?.get) return '';
  return (deno.env.get(name) ?? '').trim();
}

/**
 * CORS for the candidate endpoints.
 *
 * These endpoints are authorised by unguessable link/session tokens plus the
 * candidate's registered phone number, so CORS is not the security boundary.
 * An earlier version returned one fixed origin from ALLOWED_ORIGIN. That made
 * a personal link work on the machine that generated it but fail on every
 * other device (LAN IP, preview URL, custom domain): the browser origin did
 * not match the fixed value, so the response was blocked before the app could
 * read it. We now reflect the caller's Origin so the same link works from any
 * device.
 *
 * To restore strict browser-origin checking, set CORS_STRICT_ALLOWLIST=true
 * and list the exact origins in ALLOWED_ORIGIN (comma separated, or "*").
 */
export function getAllowedOrigin(requestOrigin?: string | null): string | null {
  const origin = (requestOrigin ?? '').trim();
  const strict = readEnv('CORS_STRICT_ALLOWLIST').toLowerCase();

  if (strict !== 'true') {
    return origin || '*';
  }

  const raw = readEnv('ALLOWED_ORIGIN') || readEnv('SITE_ORIGIN');
  const values = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (values.length === 0) return origin || null;
  if (values.includes('*')) return '*';
  if (!origin) return values[0] ?? null;

  return values.includes(origin) ? origin : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeDigits(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
}

export function buildJsonResponse(status: number, body: JsonObject, allowedOrigin: string | null): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    headers.set('Vary', 'Origin');
  }

  const isNoContentStatus = status === 204 || status === 205 || status === 304;
  const responseBody = isNoContentStatus ? null : JSON.stringify(body);

  return new Response(responseBody, {
    status,
    headers,
  });
}

export function parseJsonBody(req: Request): Promise<JsonObject> {
  return req.headers.get('content-type')?.includes('application/json')
    ? req.json().catch(() => ({}))
    : Promise.resolve({});
}

export const ERROR_HTTP_STATUS: Record<string, number> = {
  invalid_link: 404,
  locked: 423,
  not_open: 403,
  closed: 410,
  invalid_number: 400,
  wrong_phone: 401,
  phone_not_on_file: 400,
  session_invalid: 401,
  invalid_target: 404,
  already_sent: 409,
  limit_full: 403,
};

export function errorResponse(code: string, allowedOrigin: string | null): Response {
  const status = ERROR_HTTP_STATUS[code] ?? 400;
  return buildJsonResponse(status, { ok: false, error: code }, allowedOrigin);
}

export function successResponse(body: JsonObject, allowedOrigin: string | null): Response {
  return buildJsonResponse(200, body, allowedOrigin);
}

export function getServiceClient() {
  const url = readEnv('SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createClient(url: string, key: string, options: Record<string, unknown>) {
  return {
    url,
    key,
    options,
    rpc: async (name: string, params: Record<string, unknown> = {}) => {
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'apikey': key,
        },
        body: JSON.stringify(params),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) {
        const errorText = typeof data === 'string' ? data : data?.message ?? 'rpc_failed';
        return { data: null, error: { message: errorText } };
      }

      return { data, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, expiresIn: number) => {
          const encodedPath = path
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
          const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'apikey': key,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expiresIn }),
          });
          const text = await response.text();
          const json = text ? JSON.parse(text) : null;
          if (!response.ok) {
            return { data: null, error: { message: json?.message ?? 'signed_url_failed' } };
          }

          const relative = json?.signedURL ?? json?.signedUrl ?? null;
          if (!relative) {
            return { data: null, error: { message: 'signed_url_missing' } };
          }

          const signedUrl = String(relative).startsWith('http')
            ? String(relative)
            : `${url}/storage/v1${relative}`;

          return {
            data: { signedUrl },
            error: null,
          };
        },
      }),
    },
  };
}
