-- =======================================================================
-- 007_security_fixes.sql
-- Fixes found in the review of 001-006. READ IT BEFORE RUNNING.
-- Run in the Supabase SQL Editor. It runs as one transaction: if any
-- statement fails, nothing is changed.
--
-- IMPORTANT: section 3 rewrites existing event codes. If you already shared
-- real event codes with the client, delete the "3b" block first.
-- =======================================================================

begin;

------------------------------------------------------------
-- 1. audit_log: reconcile the two column sets (non-destructive)
--    001 created admin_id / registration_id (admin_id NOT NULL).
--    004 added admin_user_id / reg_id. Keep all four for now, but make
--    admin_id optional so inserts that use the new columns do not fail,
--    and copy old values into the new columns.
--    Old columns are dropped later, after the frontend is confirmed to use
--    only admin_user_id and reg_id.
------------------------------------------------------------
alter table public.audit_log alter column admin_id drop not null;

update public.audit_log
set reg_id = coalesce(reg_id, registration_id),
    admin_user_id = coalesce(admin_user_id, admin_id)
where reg_id is null or admin_user_id is null;

-- 004 added a duplicate policy with no role restriction; 001's policy is enough.
drop policy if exists "admin only can audit_log" on public.audit_log;

------------------------------------------------------------
-- 2. approve_registration: admin check, pending-only, no code reuse
------------------------------------------------------------
create or replace function public.approve_registration(p_registration_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_gender text;
  v_status text;
  v_prefix text;
  v_next int;
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  select r.event_id, r.gender, r.status
  into v_event_id, v_gender, v_status
  from public.registrations r
  where r.id = p_registration_id
    and r.deleted_at is null
  for update;

  if not found then
    raise exception 'Registration not found or already deleted.';
  end if;

  if v_status <> 'pending' then
    raise exception 'Only pending registrations can be approved (current status: %).', v_status;
  end if;

  v_prefix := case when v_gender = 'woman' then 'F' else 'M' end;

  perform pg_advisory_xact_lock(hashtext('approve_' || v_event_id::text || '_' || v_prefix));

  -- Look at EVERY code ever issued for this event and prefix (including
  -- deleted or rejected rows) so numbers are never reused.
  select coalesce(max(substring(r.candidate_code from 3)::int), 0) + 1
  into v_next
  from public.registrations r
  where r.event_id = v_event_id
    and r.candidate_code like v_prefix || '-%';

  v_code := v_prefix || '-' || lpad(v_next::text, 3, '0');

  update public.registrations
  set status = 'approved', candidate_code = v_code
  where id = p_registration_id;

  insert into public.audit_log (admin_user_id, action, reg_id, reason)
  values (auth.uid(), 'approve', p_registration_id,
    'Approved registration and assigned candidate code ' || v_code);

  return v_code;
end;
$$;

revoke all on function public.approve_registration(uuid) from public, anon, authenticated;
grant execute on function public.approve_registration(uuid) to authenticated;

------------------------------------------------------------
-- 3. Event code: serial + YY + MM + nth  (client example: 126061)
--    003 built YY + serial + MM + nth, which gives 261061.
------------------------------------------------------------
create or replace function public.assign_event_code()
returns trigger
language plpgsql
as $$
declare
  v_serial int;
  v_year text;
  v_month text;
  v_nth int;
begin
  if new.serial is null then
    v_serial := nextval('public.events_serial_seq');
    new.serial := v_serial;
  else
    v_serial := new.serial;
  end if;

  if new.event_code is null or new.event_code = '' then
    perform pg_advisory_xact_lock(hashtext('event_code_' || to_char(new.date, 'YYYY-MM')));
    v_year := to_char(new.date, 'YY');
    v_month := to_char(new.date, 'MM');
    select count(*) + 1 into v_nth
    from public.events
    where date_trunc('month', date) = date_trunc('month', new.date);
    new.event_code := v_serial::text || v_year || v_month || v_nth::text;
  end if;

  return new;
end;
$$;

-- 3b. Rewrite codes of events that already exist (registrations point to
--     events by id, so nothing else breaks). Remove this block if the
--     existing codes were already shared with the client.
alter table public.events disable trigger trg_freeze_event_code;

with numbered as (
  select id, serial, date,
         row_number() over (
           partition by date_trunc('month', date)
           order by created_at, id
         ) as nth
  from public.events
)
update public.events e
set event_code = n.serial::text || to_char(n.date, 'YY') || to_char(n.date, 'MM') || n.nth::text
from numbered n
where n.id = e.id;

alter table public.events enable trigger trg_freeze_event_code;

------------------------------------------------------------
-- 4. Registrations: stricter public insert + safe capacity check
------------------------------------------------------------
drop policy if exists "anon insert registration only" on public.registrations;

create policy "anon insert registration only"
on public.registrations
for insert
to anon
with check (
  status = 'pending'
  and candidate_code is null
  and admin_note is null
  and deleted_at is null
  and deleted_by is null
  and deleted_reason is null
  and coalesce(guardian_charge, 0) = 0
  -- own photo and own ID card are required
  and photo_path is not null
  and id_card_path is not null
  -- stop oversized junk
  and pg_column_size(form_data) < 100000
  and coalesce(cardinality(private_fields), 0) <= 100
);

-- Lock the event row so two simultaneous registrations cannot both take the
-- last seat, and do not count rejected registrations against the limit.
create or replace function public.check_registration_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evt public.events%rowtype;
  cnt int;
begin
  select * into evt
  from public.events
  where id = new.event_id
  for update;

  if not found then
    raise exception 'Event not found.';
  end if;

  if evt.status <> 'open' then
    raise exception 'Registrations are not open for this event.';
  end if;

  select count(*) into cnt
  from public.registrations
  where event_id = new.event_id
    and deleted_at is null
    and status <> 'rejected';

  if evt.max_participants > 0 and cnt >= evt.max_participants then
    raise exception 'This event has reached its maximum number of participants.';
  end if;

  return new;
end;
$$;

------------------------------------------------------------
-- 5. Privileges: nothing for anon except inserting a registration;
--    no hard deletes; audit log cannot be edited or deleted.
------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant insert on public.registrations to anon;

revoke delete on public.registrations from authenticated;

revoke all on public.events from authenticated;
grant select, insert, update on public.events to authenticated;

revoke update, delete on public.audit_log from authenticated;

------------------------------------------------------------
-- 6. Indexes for the admin screens
------------------------------------------------------------
create index if not exists idx_registrations_event on public.registrations (event_id);
create index if not exists idx_registrations_event_status on public.registrations (event_id, status);
create index if not exists idx_registrations_event_gender on public.registrations (event_id, gender);
create index if not exists idx_registrations_created_at on public.registrations (created_at desc);

------------------------------------------------------------
-- 7. Storage: enforce size and type at the bucket level
--    (policy metadata checks are not a reliable limit).
------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/pjpeg','image/png','application/pdf']
where id = 'registration-files';

drop policy if exists "anon upload registration files only" on storage.objects;

create policy "anon upload registration files only"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'registration-files'
  and lower(name) ~ '\.(jpe?g|jfif|png|pdf)$'
);

commit;

-- =======================================================================
-- CHECK QUERIES (run these separately after the migration)
-- =======================================================================
-- 1) Every table should show rowsecurity = true
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
--
-- 2) anon should only have INSERT on registrations
-- select table_name, privilege_type from information_schema.role_table_grants
-- where grantee = 'anon' and table_schema = 'public';
--
-- 3) approve_registration should NOT be executable by anon or PUBLIC
-- select routine_name, grantee from information_schema.routine_privileges
-- where routine_schema = 'public' and grantee in ('anon','PUBLIC');
--
-- 4) The event code should look like 126061
-- select event_code, serial, date from public.events order by created_at;
