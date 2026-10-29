import assert from 'node:assert/strict';
import test from 'node:test';

import { getAllowedOrigin } from '../supabase/functions/_shared/edge.ts';

test('reflects the caller origin by default so a link works on every device', () => {
  assert.equal(getAllowedOrigin('http://192.168.1.5:5173'), 'http://192.168.1.5:5173');
  assert.equal(getAllowedOrigin('https://nbn.example.com'), 'https://nbn.example.com');
  assert.equal(getAllowedOrigin(null), '*');
});

test('strict mode only allows origins listed in ALLOWED_ORIGIN', () => {
  (globalThis as { Deno?: unknown }).Deno = {
    env: {
      get: (name: string) =>
        name === 'CORS_STRICT_ALLOWLIST'
          ? 'true'
          : name === 'ALLOWED_ORIGIN'
            ? 'https://allowed.example.com'
            : undefined,
    },
  };

  try {
    assert.equal(getAllowedOrigin('https://allowed.example.com'), 'https://allowed.example.com');
    assert.equal(getAllowedOrigin('https://blocked.example.com'), null);
  } finally {
    delete (globalThis as { Deno?: unknown }).Deno;
  }
});
