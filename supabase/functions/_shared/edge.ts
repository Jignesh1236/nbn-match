export type JsonObject = Record<string, unknown>;

export function getAllowedOrigin(): string | null {
  const raw = (Deno.env.get('ALLOWED_ORIGIN') ?? Deno.env.get('SITE_ORIGIN') ?? '').trim();
  const values = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (values.length === 0) return null;

  return values[0] ?? null;
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
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
          const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}?expiresIn=${expiresIn}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'apikey': key,
            },
          });
          const text = await response.text();
          const json = text ? JSON.parse(text) : null;
          if (!response.ok) {
            return { data: null, error: { message: json?.message ?? 'signed_url_failed' } };
          }
          return {
            data: { signedUrl: json?.signedURL ?? json?.signedUrl ?? null },
            error: null,
          };
        },
      }),
    },
  };
}
