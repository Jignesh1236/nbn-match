-- ============================================================================
-- Phase 1 storage: private bucket "registration-files"
-- Run in the Supabase SQL Editor after 001_initial.sql.
-- ============================================================================

------------------------------------------------------------
-- 1. Create the private bucket (public = false)
------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('registration-files', 'registration-files', false)
on conflict (id) do nothing;

------------------------------------------------------------
-- 2. Storage policies
------------------------------------------------------------
-- Anonymous visitors can ONLY upload (insert) files.
-- No SELECT, so they cannot read, list, or download anything.
-- Limits: images (jpg/jpeg/png) and PDF only, max 5 MB each.
create policy "anon upload registration files only"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'registration-files'
  and (
    lower(name) like '%.jpg' or lower(name) like '%.jpeg'
    or lower(name) like '%.png'  or lower(name) like '%.pdf'
  )
  and (
    metadata->>'mimetype' in ('image/jpeg','image/png','application/pdf')
    or metadata->>'mimetype' like 'image/%'
  )
  and coalesce((metadata->>'size')::bigint, 0) <= 5242880
);

-- Admins can read/download files (via signed URLs that expire in 60 seconds,
-- generated in the frontend with supabase.storage.from(...).createSignedUrl).
create policy "admins read registration files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'registration-files'
  and public.is_admin()
);

-- ============================================================================
-- End of 002_storage.sql
-- ============================================================================
