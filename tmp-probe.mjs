import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const BUCKET = 'registration-files';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function tryUpload(label, body, opts) {
  const path = `registrations/probe-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error, data } = await supabase.storage.from(BUCKET).upload(path, body, opts);
  console.log(label.padEnd(30), error ? `ERR ${error.statusCode ?? ''} ${error.message}` : 'OK');
  if (data) console.log('   ->', data.path);
}


async function main() {
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` },
  });
  console.log('bucket status', r.status, await r.text());

  await tryUpload('I empty file', new File([], 'photo.jpg', { type: 'image/jpeg' }), { metadata: { mimetype: 'image/jpeg' }, upsert: false });
  const big = Buffer.alloc(6 * 1024 * 1024, 1);
  await tryUpload('J 6MB file', new File([big], 'big.jpg', { type: 'image/jpeg' }), { metadata: { mimetype: 'image/jpeg' }, upsert: false });
  await tryUpload('K dup path', new File([PNG], 'probe-fixed.jpg', { type: 'image/jpeg' }), { metadata: { mimetype: 'image/jpeg' }, upsert: false });
  await tryUpload('L dup path again', new File([PNG], 'probe-fixed.jpg', { type: 'image/jpeg' }), { metadata: { mimetype: 'image/jpeg' }, upsert: false });
}

main().catch(e => { console.error('THREW', e); process.exit(1); });


