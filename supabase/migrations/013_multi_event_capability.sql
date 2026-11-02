-- ============================================================================
-- 013_multi_event_capability.sql
-- Support multiple events per day with per-event capacity and per-event
-- friend-request (interest request) gating.
--
-- RUN IN THE SUPABASE SQL EDITOR AFTER 012_gender_capacity.sql.
-- ============================================================================

begin;

------------------------------------------------------------
-- 1. friend_requests_enabled on events
------------------------------------------------------------
alter table public.events
  add column if not exists friend_requests_enabled boolean not null default false;

------------------------------------------------------------
-- 2. get_open_events() — all open events with gender counts
------------------------------------------------------------
drop function if exists public.get_open_events();

create function public.get_open_events()
returns table (
  id uuid,
  event_code text,
  date date,
  price numeric,
  discount_price numeric,
  max_participants int,
  age_range text,
  area text,
  religion text,
  shift text,
  extra_guardian_charge numeric,
  friend_requests_enabled boolean,
  men_registered bigint,
  women_registered bigint,
  men_remaining bigint,
  women_remaining bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_men bigint;
  v_women bigint;
  v_half bigint;
begin
  return query
  select e.id,
         e.event_code,
         e.date,
         e.price,
         e.discount_price,
         e.max_participants,
         e.age_range,
         e.area,
         e.religion,
         e.shift,
         e.extra_guardian_charge,
         e.friend_requests_enabled,
         count(r.id) filter (
           where r.gender = 'man' and r.deleted_at is null and r.status <> 'rejected'
         ) as men_registered,
         count(r.id) filter (
           where r.gender = 'woman' and r.deleted_at is null and r.status <> 'rejected'
         ) as women_registered,
         case when e.max_participants = 0 then null
              else greatest(e.max_participants::bigint / 2 -
                   count(r.id) filter (
                     where r.gender = 'man' and r.deleted_at is null and r.status <> 'rejected'
                   ), 0) end as men_remaining,
         case when e.max_participants = 0 then null
              else greatest(e.max_participants::bigint / 2 -
                   count(r.id) filter (
                     where r.gender = 'woman' and r.deleted_at is null and r.status <> 'rejected'
                   ), 0) end as women_remaining
  from public.events e
  left join public.registrations r on r.event_id = e.id
  where e.status = 'open'
  group by e.id
  order by e.created_at asc;
end;
$$;

revoke all on function public.get_open_events() from public, anon, authenticated;
grant execute on function public.get_open_events() to anon, authenticated;

------------------------------------------------------------
-- 3. Gate friend-request sending on friend_requests_enabled
------------------------------------------------------------
-- link_send_request already scopes by event_id via the session; add the
-- friend_requests_enabled check so the API is blocked for events without it.
-- (The function is recreated here to add the gate.)
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
  v_friend_enabled boolean;
begin
  select * into s from public.link_session_info(p_session_hash);

  select friend_requests_enabled into v_friend_enabled
  from public.events
  where id = s.event_id;

  if not v_friend_enabled then
    return jsonb_build_object('ok', false, 'error', 'friend_requests_disabled');
  end if;

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

commit;