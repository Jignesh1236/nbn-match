create or replace function public.event_registration_gender_counts()
returns table (event_id uuid, men bigint, women bigint)
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
  select e.id,
         count(r.id) filter (where r.gender = 'man'),
         count(r.id) filter (where r.gender = 'woman')
  from public.events e
  left join public.registrations r
    on r.event_id = e.id
   and r.deleted_at is null
  group by e.id;
end;
$$;

revoke all on function public.event_registration_gender_counts() from anon, authenticated, public;
grant execute on function public.event_registration_gender_counts() to authenticated;
