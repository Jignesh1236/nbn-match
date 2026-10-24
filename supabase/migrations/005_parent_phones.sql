-- =======================================================================
-- 005_parent_phones.sql — Phase 6: father & mother phone numbers
-- Idempotent: safe to run on a fresh DB or on a DB that already has
-- the columns.
-- =======================================================================

alter table public.registrations add column if not exists father_phone text;
alter table public.registrations add column if not exists mother_phone text;
alter table public.registrations add column if not exists accompanying_nid_path text;