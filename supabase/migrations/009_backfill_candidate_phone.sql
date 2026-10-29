-- =======================================================================
-- 009_backfill_candidate_phone.sql
-- Migration 008 added public.registrations.phone, but registrations created
-- before that migration only have the phone inside form_data. Candidate links
-- verify the phone against the phone column, so without this backfill every
-- older approved candidate gets "phone_not_on_file" and cannot open a session.
--
-- Safe to run more than once: it only fills rows where phone is still empty.
-- =======================================================================

begin;

update public.registrations
set phone = nullif(regexp_replace(coalesce(form_data ->> 'phone', ''), '\D', '', 'g'), '')
where phone is null
  and coalesce(form_data ->> 'phone', '') <> '';

commit;

-- Check the result:
--   select candidate_code, phone, form_data ->> 'phone' as form_phone
--   from public.registrations
--   where status = 'approved' and deleted_at is null
--   order by candidate_code;
-- Every approved row must have a phone. If some are still null, fix them in
-- the admin screen before generating candidate links.
