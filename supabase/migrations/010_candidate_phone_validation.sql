-- =======================================================================
-- 010_candidate_phone_validation.sql
-- Candidate links must be opened with the phone number saved on the
-- registration the link was generated for.
--
-- The verification already happened inside link_open_session(), but two
-- gaps remained:
--   * a malformed number was counted as a wrong attempt, and
--   * admin_generate_links() happily created links for registrations with
--     no usable phone, producing a link nobody could ever open.
--
-- This migration:
--   1. fills registrations.phone from form_data when the column is empty,
--   2. refuses to create/regenerate a link when the phone is not usable,
--   3. returns a distinct 'invalid_number' code for malformed input, and
--   4. keeps the last-10-digits comparison used by public.norm_phone().
--
-- Safe to run more than once.
-- =======================================================================

begin;

------------------------------------------------------------
-- 1. Make sure the phone column is usable for every registration
------------------------------------------------------------
update public.registrations
set phone = nullif(regexp_replace(coalesce(form_data ->> 'phone', ''), '\D', '', 'g'), '')
where public.norm_phone(phone) is null
  and coalesce(form_data ->> 'phone', '') <> '';

------------------------------------------------------------
-- 2. Only generate links for candidates with a usable phone
------------------------------------------------------------
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
  v_skipped int := 0;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  for r in
    select reg.id, reg.candidate_code, reg.gender, reg.phone
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
    -- A link is useless without a phone to verify. Skip it and report the
    -- count in the audit log instead of creating a link nobody can open.
    if public.norm_phone(r.phone) is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

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
          'Generated ' || v_count || ' links for event ' || p_event_id::text ||
          '; skipped ' || v_skipped || ' without a valid phone');
end;
$$;

create or replace function public.admin_regenerate_link(p_registration_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_phone text;
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.';
  end if;

  select r.event_id, r.phone into v_event_id, v_phone
  from public.registrations r
  where r.id = p_registration_id
    and r.status = 'approved'
    and r.deleted_at is null;

  if not found then
    raise exception 'Approved registration not found.';
  end if;

  if public.norm_phone(v_phone) is null then
    raise exception 'phone_not_on_file';
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

revoke all on function public.admin_generate_links(uuid) from public, anon, authenticated;
revoke all on function public.admin_regenerate_link(uuid) from public, anon, authenticated;
grant execute on function public.admin_generate_links(uuid) to authenticated;
grant execute on function public.admin_regenerate_link(uuid) to authenticated;

------------------------------------------------------------
-- 3. Separate malformed input from a genuine wrong number
------------------------------------------------------------
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
  if e.links_open_at is not null and now() < e.links_open_at then
    return jsonb_build_object('ok', false, 'error', 'not_open', 'opens_at', e.links_open_at);
  end if;
  if e.links_close_at is not null and now() >= e.links_close_at then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  if public.norm_phone(r.phone) is null then
    return jsonb_build_object('ok', false, 'error', 'phone_not_on_file');
  end if;

  -- A malformed number is not an attempt on this link: do not lock it.
  if public.norm_phone(p_phone) is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_number');
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
          least(now() + interval '2 hours', case when e.links_close_at is null then now() + interval '2 hours' else e.links_close_at end));

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

revoke all on function public.link_open_session(text, text) from public, anon, authenticated;
grant execute on function public.link_open_session(text, text) to service_role;

commit;

-- Check after running:
--   select candidate_code, phone, form_data ->> 'phone' as form_phone
--   from public.registrations
--   where status = 'approved' and deleted_at is null
--   order by candidate_code;
-- Every approved row that needs a link must have a 10+ digit phone.
