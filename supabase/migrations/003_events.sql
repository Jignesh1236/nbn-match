-- ============================================================================
-- 003_events.sql — Phase 4: event_code auto-generation + admin counts
-- Run in the Supabase SQL Editor after 001_initial.sql.
-- ============================================================================
--
-- Event code format (6 digits, e.g. 126061):
--   YY          last two digits of the year  → 26  (2026)
--   serial      global event serial          → 1
--   MM          two-digit month              → 06  (June)
--   N           nth event created that month → 1
--   combined: "26" || "1" || "06" || "1" = 126061
--
-- The code is stamped by a BEFORE INSERT trigger; the serial comes from a
-- sequence so two admins creating events at once cannot collide. The code
-- and serial are frozen after insert (an update trigger rejects changes),
-- so existing registrations keep pointing at a stable identifier.

------------------------------------------------------------
-- 1. Serial sequence
------------------------------------------------------------
create sequence if not exists public.events_serial_seq;

-- Existing tables created without a generator may already hold rows; if the
-- table has a serial column, advance the sequence past the highest value.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'serial'
  ) then
    perform setval(
      'public.events_serial_seq',
      coalesce((select max(serial) from public.events), 0) + 1,
      false
    );
  end if;
end;
$$;

------------------------------------------------------------
-- 2. Code generator
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
  -- Only assign; never overwrite an explicitly provided code/serial.
  if new.serial is null then
    v_serial := nextval('public.events_serial_seq');
    new.serial := v_serial;
  else
    v_serial := new.serial;
  end if;

  if new.event_code is null or new.event_code = '' then
    -- Serialize concurrent inserts so two events in the same month cannot
    -- both read the same "nth" count. Advisory locks are transactional and
    -- release automatically at commit/rollback.
    perform pg_advisory_xact_lock(hashtext('event_code_' || to_char(new.date, 'YYYY-MM')));
    v_year := to_char(new.date, 'YY');
    v_month := to_char(new.date, 'MM');
    select count(*) + 1 into v_nth
    from public.events
    where date_trunc('month', date) = date_trunc('month', new.date);
    new.event_code := v_year || v_serial::text || v_month || v_nth::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_event_code on public.events;
create trigger trg_assign_event_code
before insert on public.events
for each row
execute function public.assign_event_code();

------------------------------------------------------------
-- 3. Freeze code + serial after insert
------------------------------------------------------------
create or replace function public.freeze_event_code()
returns trigger
language plpgsql
as $$
begin
  if new.serial <> old.serial then
    raise exception 'events.serial is immutable once assigned.';
  end if;
  if new.event_code <> old.event_code then
    raise exception 'events.event_code is immutable once assigned.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freeze_event_code on public.events;
create trigger trg_freeze_event_code
before update on public.events
for each row
execute function public.freeze_event_code();

------------------------------------------------------------
-- 4. Admin registration counts per event (single round trip)
------------------------------------------------------------
create or replace function public.event_registration_counts()
returns table (event_id uuid, total bigint, approved bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  return query
  select r.event_id,
         count(*) filter (where r.deleted_at is null),
         count(*) filter (where r.deleted_at is null and r.status = 'approved')
  from public.registrations r
  group by r.event_id;
end;
$$;

revoke all on function public.event_registration_counts() from anon, authenticated, public;
grant execute on function public.event_registration_counts() to authenticated;
