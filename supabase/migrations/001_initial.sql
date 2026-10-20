-- ============================================================================
-- Phase 1 data layer: admins, events, registrations, audit_log
-- Run these statements in the Supabase SQL Editor (Database -> SQL).
-- Do NOT put the service_role key anywhere in the frontend.
-- ============================================================================

------------------------------------------------------------
-- 1. Extensions
------------------------------------------------------------
create extension if not exists pgcrypto;

------------------------------------------------------------
-- 2. admins (1-2 manually created accounts; no in-app creation)
------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.admins enable row level security;

-- Each admin can read only their own row.
-- Deliberately NOT based on is_admin() to avoid policy recursion,
-- because is_admin() queries this same table.
create policy "admins read their own row"
on public.admins
for select
to authenticated
using (user_id = auth.uid());

------------------------------------------------------------
-- is_admin() — returns true only if auth.uid() is in the admins table
------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
as $$
begin
  return exists (
    select 1 from public.admins where user_id = auth.uid()
  );
end;
$$;

------------------------------------------------------------
-- 3. events
------------------------------------------------------------
create table if not exists public.events (
  id uuid not null default gen_random_uuid() primary key,
  event_code text not null unique,
  serial int not null,
  date date not null,
  status text not null default 'open'
    check (status in ('open','closed','finished')),
  price numeric not null default 0,
  discount_price numeric not null default 0,
  max_participants int not null default 0,
  age_range text,
  area text,
  religion text,
  shift text,
  extra_guardian_charge numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "admins full access to events"
on public.events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


------------------------------------------------------------
-- 4. registrations
------------------------------------------------------------
create table if not exists public.registrations (
  id uuid not null default gen_random_uuid() primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  gender text not null check (gender in ('man','woman','other')),
  private_fields text[] not null default '{}',
  photo_path text,
  id_card_path text,
  payment_method text,
  transaction_id text,
  sender_number text,
  guardian_name text,
  guardian_phone text,
  guardian_age int,
  guardian_relation text,
  guardian_charge numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  candidate_code text,
  admin_note text,
  deleted_at timestamptz,
  deleted_reason text,
  deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  form_data jsonb not null default '{}'::jsonb
);

alter table public.registrations enable row level security;

-- Anonymous visitors may INSERT a registration only.
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
  and coalesce(guardian_charge, 0) = 0
);

-- Admins have full access to registrations.
create policy "admins full access to registrations"
on public.registrations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

------------------------------------------------------------
-- 5. audit_log
------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid not null default gen_random_uuid() primary key,
  admin_id uuid not null references public.admins(user_id) on delete cascade,
  action text not null,
  registration_id uuid references public.registrations(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "admins full access to audit_log"
on public.audit_log
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

------------------------------------------------------------
-- 6. Constraints
------------------------------------------------------------
alter table public.registrations
add constraint registrations_transaction_id_event_id_key
unique (event_id, transaction_id);

-- One candidate code per event once assigned (partial unique index so NULLs
-- don't collide; PostgreSQL ADD CONSTRAINT ... UNIQUE does not support WHERE).
create unique index registrations_candidate_code_event_id_key
on public.registrations (event_id, candidate_code)
where candidate_code is not null;


------------------------------------------------------------
-- 7. updated_at trigger
------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

------------------------------------------------------------
-- 8. Trigger: block registration insert when event closed or full
-- SECURITY DEFINER so it can read events/registrations despite RLS.
------------------------------------------------------------
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
  where id = new.event_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  if evt.status <> 'open' then
    raise exception 'Registrations are not open for this event.';
  end if;

  select count(*) into cnt
  from public.registrations
  where event_id = new.event_id
    and deleted_at is null;

  if evt.max_participants > 0 and cnt >= evt.max_participants then
    raise exception 'This event has reached its maximum number of participants.';
  end if;

  return new;
end;
$$;

create trigger trg_check_registration_insert
before insert on public.registrations
for each row
execute function public.check_registration_insert();

------------------------------------------------------------
-- 9. Public function: open event's safe fields (for the form)
-- SECURITY DEFINER so anonymous callers can read event data.
------------------------------------------------------------
create or replace function public.get_open_event()
returns table (
  id uuid,
  event_code text,
  price numeric,
  discount_price numeric,
  max_participants int,
  age_range text,
  area text,
  religion text,
  shift text,
  extra_guardian_charge numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  evt public.events%rowtype;
begin
  select * into evt
  from public.events
  where status = 'open'
  order by created_at desc
  limit 1;

  if not found then
    return;
  end if;

  return query
  select evt.id, evt.event_code, evt.price, evt.discount_price, evt.max_participants,
         evt.age_range, evt.area, evt.religion, evt.shift, evt.extra_guardian_charge;
end;
$$;

grant execute on function public.get_open_event() to anon, authenticated;

------------------------------------------------------------
-- 10. approve_registration(id) — atomic M-/F- code + audit_log
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
  v_prefix text;
  v_next int;
  v_code text;
begin
  select r.event_id, r.gender
  into v_event_id, v_gender
  from public.registrations r
  where r.id = p_registration_id
    and r.deleted_at is null
  for update;

  if not found then
    raise exception 'Registration not found or already deleted.';
  end if;

  v_prefix := case when v_gender = 'woman' then 'F' else 'M' end;

  perform pg_advisory_xact_lock(hashtext('approve_' || v_event_id::text || '_' || v_prefix));

  select coalesce(max(substring(r.candidate_code from 3)::int), 0) + 1
  into v_next
  from public.registrations r
  where r.event_id = v_event_id
    and r.status = 'approved'
    and r.deleted_at is null
    and r.candidate_code is not null
    and r.candidate_code like v_prefix || '-%';

  v_code := v_prefix || '-' || lpad(v_next::text, 3, '0');

  update public.registrations
  set status = 'approved', candidate_code = v_code
  where id = p_registration_id;

  insert into public.audit_log (admin_id, action, registration_id, reason)
  values (auth.uid(), 'approve', p_registration_id,
    'Approved registration and assigned candidate code ' || v_code);

  return v_code;
end;
$$;

------------------------------------------------------------
-- 11. Table-level privileges (RLS is the real gatekeeper)
------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant insert on public.registrations to anon;
grant select, insert, update, delete on public.registrations to authenticated;

grant select on public.events to authenticated;
grant select on public.admins to authenticated;
grant select, insert on public.audit_log to authenticated;

