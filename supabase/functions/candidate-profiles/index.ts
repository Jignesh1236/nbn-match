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
    const { data, error } = await supabase.rpc('link_list_profiles', {
      p_session_hash: sessionHash,
      p_limit: typeof body.limit === 'number' ? body.limit : 100,
      p_offset: typeof body.offset === 'number' ? body.offset : 0,
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

    const items = Array.isArray((data as any).items) ? (data as any).items : [];
    const signed = await Promise.all(
      items.map(async (item: Record<string, unknown>) => {
        const photoPath = typeof item.photo_path === 'string' ? item.photo_path : null;
        if (!photoPath) {
          return { ...item, photo_url: null };
        }

        // Profile photos are lazy-loaded while the candidate scrolls. A 60s
        // signed URL expired before many images were requested, so they
        // appeared broken on slower phones. One hour covers the whole session.
        const { data: signedData, error: signedError } = await supabase.storage
          .from('registration-files')
          .createSignedUrl(photoPath, 3600);

        return {
          ...item,
          photo_url: !signedError && signedData?.signedUrl ? signedData.signedUrl : null,
        };
      }),
    );

    return successResponse(
      {
        ...(data as Record<string, unknown>),
        items: signed,
      },
      allowedOrigin,
    );
  } catch (_error) {
    return errorResponse('session_invalid', allowedOrigin);
  }
});
