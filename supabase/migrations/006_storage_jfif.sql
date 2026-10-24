-- =======================================================================
-- 006_storage_jfif.sql — Allow .jfif uploads (JPEG variant)
-- Run in the Supabase SQL Editor.
-- =======================================================================

-- Drop and recreate the anon upload policy to include .jfif extension.
drop policy if exists "anon upload registration files only" on storage.objects;

create policy "anon upload registration files only"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'registration-files'
  and (
    lower(name) like '%.jpg'  or lower(name) like '%.jpeg'
    or lower(name) like '%.jfif'
    or lower(name) like '%.png'  or lower(name) like '%.pdf'
  )
  and (
    metadata->>'mimetype' in ('image/jpeg','image/png','application/pdf')
    or metadata->>'mimetype' like 'image/%'
  )
  and coalesce((metadata->>'size')::bigint, 0) <= 5242880
);

-- ============================================================================
-- End of 006_storage_jfif.sql
-- ============================================================================

