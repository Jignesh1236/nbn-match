-- =======================================================================
-- 008_candidate_links.sql
-- Temporary candidate links: a personal link lets an approved candidate see
-- the PUBLIC profiles of the opposite gender and send at most N interest
-- requests (default 8), only inside an admin-set time window.
--
-- RUN ONLY AFTER 007_security_fixes.sql HAS BEEN RUN AND TESTED.
-- Read it first. It runs as one transaction: if anything fails, nothing
-- is changed.
--
-- Design:
--   * Candidates never touch the tables. The candidate page calls Supabase
--     Edge Functions, which call the link_* functions below using the
--     service_role key (kept inside Supabase, never in the React code).
--   * Link tokens are random 64-character secrets. Only the SHA-256 hash is
--     stored. Both hashing and token generation are done with built-in
--     Postgres functions (no extension needed).
--   * The Edge Function hashes the token it receives (SHA-256, lowercase
--     hex of the UTF-8 text) and passes the HASH to the database.
--   * Admin functions (admin_*) are for the logged-in admin screens only.
-- =======================================================================

begin;

------------------------------------------------------------
-- 1. Event settings
------------------------------------------------------------
alter table public.events
  add column if not exists links_open_at timestamptz,
  add column if not exists links_close_at timestamptz,
  add column if not exists max_requests_per_person int not null default 8;

alter table public.events
  add constraint events_links_window_check
  check (links_open_at is null or links_close_at is null or links_close_at > links_open_at);

alter table public.events
  add constraint events_max_requests_check
  check (max_requests_per_person between 1 and 50);

-- Candidate phone as a real column (used for the second check on the link).
-- The form must save the candidate's phone here (see the agent prompt).
alter table public.registrations add column if not exists phone text;

------------------------------------------------------------
-- 2. Phone helper: compare the last 10 digits (handles +880 / 0 prefixes)
------------------------------------------------------------
create or replace function public.norm_phone(p text)
returns text
language sql
immutable
as $$
  select case when length(d) >= 10 then right(d, 10) end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;

------------------------------------------------------------
-- 3. Tables (no access for anon; admins read only what they need)
------------------------------------------------------------
create table public.access_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  failed_attempts int not null default 0,
  locked_at timestamptz
);

-- Only one active (not revoked) link per candidate.
create unique index access_links_one_active_per_registration
  on public.access_links (registration_id) where revoked_at is null;
create index idx_access_links_event on public.access_links (event_id);

create table public.access_sessions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.access_links(id) on delete cascade,
  session_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index idx_access_sessions_expires on public.access_sessions (expires_at);

create table public.interest_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  from_registration_id uuid not null references public.registrations(id) on delete restrict,
  to_registration_id uuid not null references public.registrations(id) on delete restrict,
  status text not null default 'sent' check (status in ('sent','withdrawn')),
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint interest_requests_not_self check (from_registration_id <> to_registration_id),
  constraint interest_requests_unique_pair unique (event_id, from_registration_id, to_registration_id)
);
create index idx_interest_requests_from
  on public.interest_requests (event_id, from_registration_id, status);
create index idx_interest_requests_to
  on public.interest_requests (event_id, to_registration_id, status);

-- Allowlist of form_data keys that may appear on a shared profile.
-- EMPTY BY DEFAULT = profiles show only candidate code and photo until you
-- add keys here (after the client confirms which fields are public).
create table public.public_profile_fields (
  field_key text primary key,
  sort_order int not null default 0
);

------------------------------------------------------------
-- 4. RLS and privileges
------------------------------------------------------------
alter table public.access_links enable row level security;
alter table public.access_sessions enable row level security;
alter table public.interest_requests enable row level security;
alter table public.public_profile_fields enable row level security;

create policy "admins read access_links"
on public.access_links for select to authenticated
using (public.is_admin());

create policy "admins read interest_requests"
on public.interest_requests for select to authenticated
using (public.is_admin());

create policy "admins manage public_profile_fields"
on public.public_profile_fields for all to authenticated
using (public.is_admin()) with check (public.is_admin());

revoke all on public.access_links, public.access_sessions,
  public.interest_requests, public.public_profile_fields
  from anon, authenticated;

-- Admins may read link status but never the token hash.
grant select (id, event_id, registration_id, created_at, revoked_at,
              last_used_at, failed_attempts, locked_at)
  on public.access_links to authenticated;
grant select on public.interest_requests to authenticated;
grant select, insert, update, delete on public.public_profile_fields to authenticated;

grant all on public.access_links, public.access_sessions,
  public.interest_requests, public.public_profile_fields to service_role;

------------------------------------------------------------
-- 5. Views
------------------------------------------------------------
-- Public profile of an approved candidate: code, photo path, and ONLY the
-- form_data keys in the allowlist that the candidate did not mark private.
create or replace view public.public_profiles
with (security_invoker = true) as
select r.id as registration_id,
       r.event_id,
       r.gender,
       r.candidate_code,
       r.photo_path,
       coalesce((
         select jsonb_object_agg(f.field_key, r.form_data -> f.field_key)
         from public.public_profile_fields f
         where r.form_data ? f.field_key
           and not (f.field_key = any (r.private_fields))
       ), '{}'::jsonb) as profile
from public.registrations r
where r.status = 'approved'
  and r.deleted_at is null;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to service_role;

-- Admin view of requests, with mutual interest highlighted.
create or replace view public.admin_request_pairs
with (security_invoker = true) as
select ir.event_id,
       fr.candidate_code as from_code,
       tr.candidate_code as to_code,
       ir.status,
       ir.created_at,
       (ir.status = 'sent' and exists (
          select 1 from public.interest_requests x
          where x.event_id = ir.event_id
            and x.from_registration_id = ir.to_registration_id
            and x.to_registration_id = ir.from_registration_id
            and x.status = 'sent'
       )) as is_mutual
from public.interest_requests ir
join public.registrations fr on fr.id = ir.from_registration_id
join public.registrations tr on tr.id = ir.to_registration_id;

revoke all on public.admin_request_pairs from anon, authenticated;
grant select on public.admin_request_pairs to authenticated;

------------------------------------------------------------
-- 6. ADMIN functions (logged-in admin only)
------------------------------------------------------------
-- Creates a link for every approved candidate of the event that has no
-- active link. Returns each plain token ONCE; only hashes are stored.
create or replace function public.admin_generate_links(p_event_id uuid)
returns table (
  out_registration_id uuid,
  out_candidate_code text,
  out_gender text,
  out_token text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  r record;
  v_token text;
  v_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  for r in
    select reg.id, reg.candidate_code, reg.gender
    from public.registrations reg
    where reg.event_id = p_event_id
      and reg.status = 'approved'
      and reg.deleted_at is null
      and not exists (
        select 1 from public.access_links l
        where l.registration_id = reg.id and l.revoked_at is null
      )
    order by reg.candidate_code
  loop
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

    insert into public.access_links (event_id, registration_id, token_hash)
    values (p_event_id, r.id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));

    out_registration_id := r.id;
    out_candidate_code := r.candidate_code;
    out_gender := r.gender;
    out_token := v_token;
    v_count := v_count + 1;
    return next;
  end loop;

  insert into public.audit_log (admin_user_id, action, reg_id, reason)
  values (auth.uid(), 'links_generate', null,
          'Generated ' || v_count || ' links for event ' || p_event_id::text);
end;
$$;

-- Revokes the old link and returns a new token (shown once).
create or replace function public.admin_regenerate_link(p_registration_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  select r.event_id into v_event_id
  from public.registrations r
  where r.id = p_registration_id
    and r.status = 'approved'
    and r.deleted_at is null;

  if not found then
    raise exception 'Approved registration not found.';
  end if;

  update public.access_links
  set revoked_at = now()
  where registration_id = p_registration_id and revoked_at is null;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.access_links (event_id, registration_id, token_hash)
  values (v_event_id, p_registration_id,
          encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));

  insert into public.audit_log (admin_user_id, action, reg_id, reason)
  values (auth.uid(), 'link_regenerate', p_registration_id, 'Regenerated access link');

  return v_token;
end;
$$;

create or replace function public.admin_revoke_link(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  update public.access_links
  set revoked_at = now()
  where registration_id = p_registration_id and revoked_at is null;

  insert into public.audit_log (admin_user_id, action, reg_id, reason)
  values (auth.uid(), 'link_revoke', p_registration_id, 'Revoked access link');
end;
$$;

create or replace function public.admin_reset_link_lock(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  update public.access_links
  set failed_attempts = 0, locked_at = null
  where registration_id = p_registration_id and revoked_at is null;

  insert into public.audit_log (admin_user_id, action, reg_id, reason)
  values (auth.uid(), 'link_unlock', p_registration_id, 'Reset failed-attempt lock');
end;
$$;

revoke all on function public.admin_generate_links(uuid) from public, anon, authenticated;
revoke all on function public.admin_regenerate_link(uuid) from public, anon, authenticated;
revoke all on function public.admin_revoke_link(uuid) from public, anon, authenticated;
revoke all on function public.admin_reset_link_lock(uuid) from public, anon, authenticated;
grant execute on function public.admin_generate_links(uuid) to authenticated;
grant execute on function public.admin_regenerate_link(uuid) to authenticated;
grant execute on function public.admin_revoke_link(uuid) to authenticated;
grant execute on function public.admin_reset_link_lock(uuid) to authenticated;

------------------------------------------------------------
-- 7. CANDIDATE functions (called ONLY by Edge Functions via service_role)
------------------------------------------------------------
-- Helper: resolves a valid session. Raises 'session_invalid' if the session
-- expired, the link was revoked or locked, the candidate is no longer
-- approved, or the event window is not open (database clock).
create or replace function public.link_session_info(p_session_hash text)
returns table (
  link_id uuid,
  registration_id uuid,
  event_id uuid,
  gender text,
  candidate_code text,
  max_requests int,
  closes_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  return query
  select l.id, l.registration_id, l.event_id, r.gender, r.candidate_code,
         e.max_requests_per_person, e.links_close_at
  from public.access_sessions s
  join public.access_links l on l.id = s.link_id
  join public.registrations r on r.id = l.registration_id
  join public.events e on e.id = l.event_id
  where s.session_hash = p_session_hash
    and s.expires_at > now()
    and l.revoked_at is null
    and l.locked_at is null
    and r.status = 'approved'
    and r.deleted_at is null
    and e.links_open_at is not null
    and e.links_close_at is not null
    and now() >= e.links_open_at
    and now() < e.links_close_at;

  if not found then
    raise exception 'session_invalid';
  end if;
end;
$$;

-- Step 1 for the candidate: link token hash + registered phone -> session.
-- Returns jsonb (not an exception) so failed attempts are really counted.
create or replace function public.link_open_session(p_token_hash text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l public.access_links%rowtype;
  r public.registrations%rowtype;
  e public.events%rowtype;
  v_session text;
  v_used int;
begin
  delete from public.access_sessions where expires_at < now();

  select * into l
  from public.access_links
  where token_hash = p_token_hash
  for update;

  if not found or l.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;

  select * into r from public.registrations where id = l.registration_id;
  if r.status <> 'approved' or r.deleted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;

  select * into e from public.events where id = l.event_id;

  if l.locked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  if e.links_open_at is null or now() < e.links_open_at then
    return jsonb_build_object('ok', false, 'error', 'not_open', 'opens_at', e.links_open_at);
  end if;
  if e.links_close_at is null or now() >= e.links_close_at then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  if public.norm_phone(r.phone) is null then
    return jsonb_build_object('ok', false, 'error', 'phone_not_on_file');
  end if;

  if public.norm_phone(p_phone) is distinct from public.norm_phone(r.phone) then
    update public.access_links
    set failed_attempts = failed_attempts + 1,
        locked_at = case when failed_attempts + 1 >= 5 then now() else locked_at end
    where id = l.id;
    return jsonb_build_object('ok', false, 'error', 'wrong_phone',
                              'attempts_left', greatest(5 - (l.failed_attempts + 1), 0));
  end if;

  v_session := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.access_sessions (link_id, session_hash, expires_at)
  values (l.id,
          encode(sha256(convert_to(v_session, 'UTF8')), 'hex'),
          least(now() + interval '2 hours', e.links_close_at));

  update public.access_links
  set failed_attempts = 0, last_used_at = now()
  where id = l.id;

  select count(*) into v_used
  from public.interest_requests
  where event_id = e.id and from_registration_id = r.id and status = 'sent';

  return jsonb_build_object(
    'ok', true,
    'session_token', v_session,
    'candidate_code', r.candidate_code,
    'gender', r.gender,
    'opens_at', e.links_open_at,
    'closes_at', e.links_close_at,
    'server_now', now(),
    'max_requests', e.max_requests_per_person,
    'requests_used', v_used
  );
end;
$$;

-- Opposite-gender public profiles for the same event (paged).
create or replace function public.link_list_profiles(
  p_session_hash text,
  p_limit int default 100,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_items jsonb;
  v_used int;
begin
  select * into s from public.link_session_info(p_session_hash);

  select coalesce(jsonb_agg(jsonb_build_object(
           'candidate_code', p.candidate_code,
           'photo_path', p.photo_path,
           'profile', p.profile,
           'requested', exists (
             select 1 from public.interest_requests ir
             where ir.event_id = s.event_id
               and ir.from_registration_id = s.registration_id
               and ir.to_registration_id = p.registration_id
               and ir.status = 'sent')
         ) order by p.candidate_code), '[]'::jsonb)
  into v_items
  from (
    select pp.*
    from public.public_profiles pp
    where pp.event_id = s.event_id
      and ((s.gender = 'man' and pp.gender = 'woman')
        or (s.gender = 'woman' and pp.gender = 'man'))
    order by pp.candidate_code
    limit least(greatest(p_limit, 1), 200)
    offset greatest(p_offset, 0)
  ) p;

  select count(*) into v_used
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent';

  return jsonb_build_object(
    'ok', true,
    'items', v_items,
    'requests_used', v_used,
    'max_requests', s.max_requests,
    'closes_at', s.closes_at,
    'server_now', now()
  );
end;
$$;

-- Send a request: opposite gender, same event, approved, no duplicate,
-- maximum N active requests (checked under a per-sender lock).
create or replace function public.link_send_request(p_session_hash text, p_target_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  t public.registrations%rowtype;
  ex public.interest_requests%rowtype;
  v_used int;
begin
  select * into s from public.link_session_info(p_session_hash);

  perform pg_advisory_xact_lock(hashtext('link_req_' || s.registration_id::text));

  select * into t
  from public.registrations
  where registrations.event_id = s.event_id
    and registrations.candidate_code = upper(trim(p_target_code))
    and registrations.status = 'approved'
    and registrations.deleted_at is null
    and ((s.gender = 'man' and registrations.gender = 'woman')
      or (s.gender = 'woman' and registrations.gender = 'man'));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_target');
  end if;

  select count(*) into v_used
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent';

  select * into ex
  from public.interest_requests
  where event_id = s.event_id
    and from_registration_id = s.registration_id
    and to_registration_id = t.id;

  if found and ex.status = 'sent' then
    return jsonb_build_object('ok', false, 'error', 'already_sent',
                              'requests_used', v_used, 'max_requests', s.max_requests);
  end if;

  if v_used >= s.max_requests then
    return jsonb_build_object('ok', false, 'error', 'limit_full',
                              'requests_used', v_used, 'max_requests', s.max_requests);
  end if;

  if found then
    update public.interest_requests
    set status = 'sent', withdrawn_at = null, created_at = now()
    where id = ex.id;
  else
    insert into public.interest_requests (event_id, from_registration_id, to_registration_id)
    values (s.event_id, s.registration_id, t.id);
  end if;

  return jsonb_build_object('ok', true,
                            'requests_used', v_used + 1, 'max_requests', s.max_requests);
end;
$$;

create or replace function public.link_withdraw_request(p_session_hash text, p_target_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_used int;
begin
  select * into s from public.link_session_info(p_session_hash);

  perform pg_advisory_xact_lock(hashtext('link_req_' || s.registration_id::text));

  update public.interest_requests ir
  set status = 'withdrawn', withdrawn_at = now()
  from public.registrations t
  where ir.event_id = s.event_id
    and ir.from_registration_id = s.registration_id
    and ir.to_registration_id = t.id
    and t.candidate_code = upper(trim(p_target_code))
    and ir.status = 'sent';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into v_used
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent';

  return jsonb_build_object('ok', true,
                            'requests_used', v_used, 'max_requests', s.max_requests);
end;
$$;

create or replace function public.link_my_requests(p_session_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_items jsonb;
  v_used int;
begin
  select * into s from public.link_session_info(p_session_hash);

  select coalesce(jsonb_agg(jsonb_build_object(
           'candidate_code', t.candidate_code,
           'status', ir.status,
           'created_at', ir.created_at
         ) order by ir.created_at), '[]'::jsonb)
  into v_items
  from public.interest_requests ir
  join public.registrations t on t.id = ir.to_registration_id
  where ir.event_id = s.event_id
    and ir.from_registration_id = s.registration_id;

  select count(*) into v_used
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent';

  return jsonb_build_object('ok', true, 'items', v_items,
                            'requests_used', v_used, 'max_requests', s.max_requests,
                            'closes_at', s.closes_at, 'server_now', now());
end;
$$;

-- Candidate functions: ONLY the service_role (Edge Functions) may run them.
revoke all on function public.link_session_info(text) from public, anon, authenticated;
revoke all on function public.link_open_session(text, text) from public, anon, authenticated;
revoke all on function public.link_list_profiles(text, int, int) from public, anon, authenticated;
revoke all on function public.link_send_request(text, text) from public, anon, authenticated;
revoke all on function public.link_withdraw_request(text, text) from public, anon, authenticated;
revoke all on function public.link_my_requests(text) from public, anon, authenticated;

grant execute on function public.link_session_info(text) to service_role;
grant execute on function public.link_open_session(text, text) to service_role;
grant execute on function public.link_list_profiles(text, int, int) to service_role;
grant execute on function public.link_send_request(text, text) to service_role;
grant execute on function public.link_withdraw_request(text, text) to service_role;
grant execute on function public.link_my_requests(text) to service_role;

commit;

-- =======================================================================
-- AFTER RUNNING (do these separately)
-- =======================================================================
-- 1) Choose which profile fields are public. The keys must match the keys
--    inside registrations.form_data. Ask the agent to list the real keys,
--    then confirm the list with the client. Example only:
--    insert into public.public_profile_fields (field_key, sort_order) values
--      ('occupation', 1), ('last_education_level', 2);
--
-- 2) Set the access window and limit for the event, for example:
--    update public.events
--    set links_open_at = '2026-11-20 09:00+06',
--        links_close_at = '2026-11-23 21:00+06',
--        max_requests_per_person = 8
--    where event_code = '...';
--
-- 3) Check that nothing is open to anon:
--    select routine_name, grantee from information_schema.routine_privileges
--    where routine_schema = 'public' and grantee in ('anon','PUBLIC','authenticated')
--      and routine_name like 'link\_%';      -- expect no rows
--
-- NOTE: The SQL editor runs without a logged-in admin, so admin_* functions
-- cannot be tested there ("Not authorized" is correct). Test them from the
-- admin screen.
-- =======================================================================
