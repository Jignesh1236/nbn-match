-- ============================================================================
-- 014_friend_request_limits.sql
-- Run AFTER 013_multi_event_capability.sql.
-- ============================================================================

-- Step 1: Widen status column and add 'accepted' to constraint.
-- Drop the dependent view first, then recreate after.
DO $$
BEGIN
  DROP VIEW IF EXISTS public.admin_request_pairs;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'interest_requests' AND constraint_name = 'interest_requests_check'
  ) THEN
    ALTER TABLE public.interest_requests DROP CONSTRAINT interest_requests_check;
  END IF;

  ALTER TABLE public.interest_requests ALTER COLUMN status TYPE text;

  ALTER TABLE public.interest_requests
    ADD CONSTRAINT interest_requests_check
    CHECK (status IN ('sent', 'withdrawn', 'accepted'));

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interest_requests' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE public.interest_requests ADD COLUMN accepted_at timestamptz;
  END IF;
END $$;

-- Recreate admin_request_pairs (now includes 'accepted' in is_mutual)
create or replace view public.admin_request_pairs
with (security_invoker = true) as
select ir.event_id,
       fr.candidate_code as from_code,
       tr.candidate_code as to_code,
       ir.status,
       ir.created_at,
       ir.accepted_at,
       (ir.status in ('sent', 'accepted') and exists (
          select 1 from public.interest_requests x
          where x.event_id = ir.event_id
            and x.from_registration_id = ir.to_registration_id
            and x.to_registration_id = ir.from_registration_id
            and x.status in ('sent', 'accepted')
       )) as is_mutual
from public.interest_requests ir
join public.registrations fr on fr.id = ir.from_registration_id
join public.registrations tr on tr.id = ir.to_registration_id;

revoke all on public.admin_request_pairs from anon, authenticated;
grant select on public.admin_request_pairs to authenticated;

-- Step 2: link_send_request — max 8 sent, pre-checks max 4 accepted
drop function if exists public.link_send_request(p_session_hash text, p_target_code text);

create or replace function public.link_send_request(p_session_hash text, p_target_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s record;
  t public.registrations%rowtype;
  ex public.interest_requests%rowtype;
  v_used int;
  v_accepted int;
  v_friend_enabled boolean;
begin
  select * into s from public.link_session_info(p_session_hash);

  select friend_requests_enabled into v_friend_enabled
  from public.events where id = s.event_id;

  if not v_friend_enabled then
    return jsonb_build_object('ok', false, 'error', 'friend_requests_disabled');
  end if;

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

  if v_used >= 8 then
    return jsonb_build_object('ok', false, 'error', 'sent_limit_full',
                              'requests_used', v_used, 'max_requests', 8);
  end if;

  select count(*) into v_accepted
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'accepted';

  if v_accepted >= 4 then
    return jsonb_build_object('ok', false, 'error', 'accepted_limit_full',
                              'accepted_count', v_accepted, 'max_accepted', 4);
  end if;

  select * into ex
  from public.interest_requests
  where event_id = s.event_id
    and from_registration_id = s.registration_id
    and to_registration_id = t.id;

  if found and ex.status = 'sent' then
    return jsonb_build_object('ok', false, 'error', 'already_sent',
                              'requests_used', v_used, 'max_requests', 8);
  end if;

  perform pg_advisory_xact_lock(hashtext('link_req_' || s.registration_id::text));

  select count(*) into v_used
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent';

  if v_used >= 8 then
    return jsonb_build_object('ok', false, 'error', 'sent_limit_full',
                              'requests_used', v_used, 'max_requests', 8);
  end if;

  if not found then
    insert into public.interest_requests (event_id, from_registration_id, to_registration_id)
    values (s.event_id, s.registration_id, t.id);
  end if;

  return jsonb_build_object('ok', true, 'requests_used', v_used + 1, 'max_requests', 8);
end;
$$;

-- Step 3: link_accept_request — new, max 4 accepted
create or replace function public.link_accept_request(p_session_hash text, p_target_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s record;
  ex public.interest_requests%rowtype;
  v_used int;
  v_accepted int;
begin
  select * into s from public.link_session_info(p_session_hash);

  select * into ex
  from public.interest_requests
  where event_id = s.event_id
    and from_registration_id = s.registration_id
    and to_registration_id = (
      select id from public.registrations where candidate_code = upper(trim(p_target_code))
    )
    and status = 'sent';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into v_accepted
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'accepted';

  if v_accepted >= 4 then
    return jsonb_build_object('ok', false, 'error', 'accepted_limit_full',
                              'accepted_count', v_accepted, 'max_accepted', 4);
  end if;

  perform pg_advisory_xact_lock(hashtext('link_accept_req_' || s.registration_id::text));

  update public.interest_requests
  set status = 'accepted', accepted_at = now()
  where id = ex.id;

  select count(*) into v_used
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent';

  return jsonb_build_object('ok', true,
                            'requests_used', v_used,
                            'accepted_count', v_accepted + 1,
                            'max_accepted', 4,
                            'ready_for_event', true);
end;
$$;

-- Step 4: link_my_requests — sent list (max 8) + accepted list
drop function if exists public.link_my_requests(p_session_hash text);

create or replace function public.link_my_requests(p_session_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s record;
  v_sent jsonb;
  v_accepted_items jsonb;
begin
  select * into s from public.link_session_info(p_session_hash);

  select coalesce(jsonb_agg(
    jsonb_build_object('candidate_code', t.candidate_code, 'status', ir.status, 'created_at', ir.created_at)
    order by ir.created_at
  ), '[]'::jsonb)
  into v_sent
  from (
    select * from public.interest_requests
    where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent'
    order by created_at limit 8
  ) ir
  join public.registrations t on t.id = ir.to_registration_id;

  select coalesce(jsonb_agg(
    jsonb_build_object('candidate_code', t.candidate_code, 'accepted_at', ir.accepted_at)
    order by ir.accepted_at
  ), '[]'::jsonb)
  into v_accepted_items
  from public.interest_requests ir
  join public.registrations t on t.id = ir.to_registration_id
  where ir.event_id = s.event_id
    and ir.from_registration_id = s.registration_id
    and ir.status = 'accepted';

  return jsonb_build_object(
    'ok', true,
    'items', v_sent,
    'requests_used', jsonb_array_length(v_sent),
    'max_requests', 8,
    'accepted_items', v_accepted_items,
    'accepted_count', jsonb_array_length(v_accepted_items),
    'max_accepted', 4,
    'closes_at', s.closes_at,
    'server_now', now()
  );
end;
$$;

-- Step 5: link_withdraw_request — handles 'sent' and 'accepted'
drop function if exists public.link_withdraw_request(p_session_hash text, p_target_code text);

create or replace function public.link_withdraw_request(p_session_hash text, p_target_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s record;
  v_used int;
begin
  select * into s from public.link_session_info(p_session_hash);

  update public.interest_requests ir
  set status = 'withdrawn', withdrawn_at = now()
  from public.registrations t
  where ir.event_id = s.event_id
    and ir.from_registration_id = s.registration_id
    and ir.to_registration_id = t.id
    and t.candidate_code = upper(trim(p_target_code))
    and ir.status in ('sent', 'accepted');

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into v_used
  from public.interest_requests
  where event_id = s.event_id and from_registration_id = s.registration_id and status = 'sent';

  return jsonb_build_object('ok', true, 'requests_used', v_used, 'max_requests', 8);
end;
$$;

-- Step 6: Document
comment on table public.interest_requests is
  'Friend requests between registrants. Status: sent, withdrawn, accepted. Max 8 sent per user per event, max 4 accepted per user per event.';

grant execute on function public.link_send_request     to anon, authenticated;
grant execute on function public.link_accept_request   to anon, authenticated;
grant execute on function public.link_my_requests      to anon, authenticated;
grant execute on function public.link_withdraw_request to anon, authenticated;
