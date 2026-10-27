import {
  buildJsonResponse,
  errorResponse,
  getAllowedOrigin,
  getServiceClient,
  normalizeDigits,
  parseJsonBody,
  sha256Hex,
  successResponse,
} from '../_shared/edge.ts';

Deno.serve(async (req: Request) => {
  const allowedOrigin = getAllowedOrigin();

  if (req.method === 'OPTIONS') {
    return buildJsonResponse(204, {}, allowedOrigin);
  }

  if (req.method !== 'POST') {
    return errorResponse('invalid_link', allowedOrigin);
  }

  const body = await parseJsonBody(req);
  const token = typeof body.token === 'string' ? body.token : '';
  const phone = typeof body.phone === 'string' ? body.phone : '';

  if (!token) {
    return errorResponse('invalid_link', allowedOrigin);
  }

  const hash = await sha256Hex(token);
  const cleanedPhone = normalizeDigits(phone);

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('link_open_session', {
      p_token_hash: hash,
      p_phone: cleanedPhone,
    });

    if (error) {
      const msg = typeof error.message === 'string' ? error.message : 'invalid_link';
      const code = ['invalid_link', 'locked', 'not_open', 'closed', 'wrong_phone', 'phone_not_on_file'].includes(msg)
        ? msg
        : 'invalid_link';
      return errorResponse(code, allowedOrigin);
    }

    if (!data || typeof data !== 'object') {
      return errorResponse('invalid_link', allowedOrigin);
    }

    if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
      const code = typeof data.error === 'string' ? data.error : 'invalid_link';
      return errorResponse(code, allowedOrigin);
    }

    return successResponse(data as Record<string, unknown>, allowedOrigin);
  } catch (_error) {
    return errorResponse('invalid_link', allowedOrigin);
  }
});
