-- ============================================================================
-- 015_enable_friend_requests.sql
-- Remove the friend_requests_enabled gate from link_send_request and
-- enable friend requests on all existing events.
-- ============================================================================

-- Enable on all existing events
update public.events set friend_requests_enabled = true;

-- Change default so new events have it enabled automatically
alter table public.events
  alter column friend_requests_enabled set default true;

-- Patch link_send_request to remove the gate check entirely
create or replace function public.link_send_request(p_session_hash text, p_target_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s record;
  t public.registrations%rowtype;
  ex public.interest_requests%rowtype;
  v_used int;
  v_accepted int;
begin
  select * into s from public.link_session_info(p_session_hash);

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

grant execute on function public.link_send_request to anon, authenticated;
