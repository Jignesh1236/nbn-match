begin;

do $$
declare
  invalid_events text;
begin
  select string_agg(event_code || ' (' || max_participants || ')', ', ')
  into invalid_events
  from public.events
  where max_participants < 0 or mod(max_participants, 2) <> 0;

  if invalid_events is not null then
    raise exception 'Set these event capacities to zero or a non-negative even number before applying this migration: %', invalid_events;
  end if;
end;
$$;

alter table public.events
  add constraint events_max_participants_even
  check (max_participants >= 0 and mod(max_participants, 2) = 0);

create or replace function public.check_registration_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evt public.events%rowtype;
  total_count bigint;
  gender_count bigint;
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

  if evt.max_participants < 0 or mod(evt.max_participants, 2) <> 0 then
    raise exception 'Event capacity must be zero or a non-negative even number.';
  end if;

  select count(*) into total_count
  from public.registrations
  where event_id = new.event_id
    and deleted_at is null
    and status <> 'rejected';

  if evt.max_participants > 0 and total_count >= evt.max_participants then
    raise exception 'This event has reached its maximum number of participants.';
  end if;

  if evt.max_participants > 0 and new.gender in ('man', 'woman') then
    select count(*) into gender_count
    from public.registrations
    where event_id = new.event_id
      and gender = new.gender
      and deleted_at is null
      and status <> 'rejected';

    if gender_count >= evt.max_participants / 2 then
      if new.gender = 'man' then
        raise exception 'This event has reached its maximum number of male participants.';
      else
        raise exception 'This event has reached its maximum number of female participants.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_registration_gender_change()
returns trigger
language plpgsql
as $$
begin
  if new.gender is distinct from old.gender then
    raise exception 'Registration gender cannot be changed after submission.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_registration_gender_change on public.registrations;
create trigger trg_prevent_registration_gender_change
before update of gender on public.registrations
for each row
execute function public.prevent_registration_gender_change();

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
         count(*) filter (where r.deleted_at is null and r.status <> 'rejected'),
         count(*) filter (where r.deleted_at is null and r.status = 'approved')
  from public.registrations r
  group by r.event_id;
end;
$$;

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
         count(r.id) filter (
           where r.gender = 'man' and r.deleted_at is null and r.status <> 'rejected'
         ),
         count(r.id) filter (
           where r.gender = 'woman' and r.deleted_at is null and r.status <> 'rejected'
         )
  from public.events e
  left join public.registrations r on r.event_id = e.id
  group by e.id;
end;
$$;

revoke all on function public.event_registration_counts() from anon, authenticated, public;
grant execute on function public.event_registration_counts() to authenticated;
revoke all on function public.event_registration_gender_counts() from anon, authenticated, public;
grant execute on function public.event_registration_gender_counts() to authenticated;

drop function public.get_open_event();
create function public.get_open_event()
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
  extra_guardian_charge numeric,
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
  evt public.events%rowtype;
  v_men bigint;
  v_women bigint;
begin
  select * into evt
  from public.events
  where status = 'open'
  order by created_at desc
  limit 1;

  if not found then
    return;
  end if;

  select count(*) filter (where gender = 'man'),
         count(*) filter (where gender = 'woman')
  into v_men, v_women
  from public.registrations
  where event_id = evt.id
    and deleted_at is null
    and status <> 'rejected';

  return query
  select evt.id,
         evt.event_code,
         evt.price,
         evt.discount_price,
         evt.max_participants,
         evt.age_range,
         evt.area,
         evt.religion,
         evt.shift,
         evt.extra_guardian_charge,
         v_men,
         v_women,
         case when evt.max_participants = 0 then null
              else greatest(evt.max_participants::bigint / 2 - v_men, 0) end,
         case when evt.max_participants = 0 then null
              else greatest(evt.max_participants::bigint / 2 - v_women, 0) end;
end;
$$;

revoke all on function public.get_open_event() from public;
grant execute on function public.get_open_event() to anon, authenticated;

commit;
