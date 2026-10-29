import {
  buildJsonResponse,
  errorResponse,
  getAllowedOrigin,
  getServiceClient,
  parseJsonBody,
  sha256Hex,
  successResponse,
} from '../_shared/edge.ts';

Deno.serve(async (req: Request) => {
  const allowedOrigin = getAllowedOrigin(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return buildJsonResponse(204, {}, allowedOrigin);
  }

  if (req.method !== 'POST') {
    return errorResponse('session_invalid', allowedOrigin);
  }

  const body = await parseJsonBody(req);
  const sessionToken = typeof body.session_token === 'string' ? body.session_token : '';

  if (!sessionToken) {
    return errorResponse('session_invalid', allowedOrigin);
  }

  const sessionHash = await sha256Hex(sessionToken);

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('link_my_requests', {
      p_session_hash: sessionHash,
    });

    if (error) {
      return errorResponse('session_invalid', allowedOrigin);
    }

    if (!data || typeof data !== 'object') {
      return errorResponse('session_invalid', allowedOrigin);
    }

    if ('ok' in data && data.ok === false) {
      const code = typeof data.error === 'string' ? data.error : 'session_invalid';
      return errorResponse(code, allowedOrigin);
    }

    return successResponse(data as Record<string, unknown>, allowedOrigin);
  } catch (_error) {
    return errorResponse('session_invalid', allowedOrigin);
  }
});
