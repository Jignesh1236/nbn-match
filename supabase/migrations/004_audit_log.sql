-- ==================================-----------------------
-- 004_audit_log.sql — Phase 5: registration audit log
-- ==================================-----------------------
-- Purpose: tracks every admin action (approve, reject, ban, delete)
-- on registrations. All columns are NOT NULL except reason.
-- The admin_user_id references auth.users.id; is_admin() RLS
-- should protect this table.
-- ==================================-----------------------
-- 1. Create the audit_log table
-- ==================================-----------------------
create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  reg_id uuid not null references public.registrations(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id),
  action text not null check (action in ('approve','reject','ban','delete')),
  reason text,
  created_at timestamptz default now()
);

-- 2. Enable RLS and admin‑only policy
alter table public.audit_log enable row level security;

create policy "admin only can audit_log"
  on public.audit_log
  using (is_admin());

-- 3. Index for fast look‑ups by registration
create index if not exists idx_audit_log_reg_id on public.audit_log(reg_id);
create index if not exists idx_audit_log_admin on public.audit_log(admin_user_id);
create index if not exists idx_audit_log_action on public.audit_log(action);

-- 4. Comment so future devs understand the purpose
comment on table public.audit_log is 'Stores every admin approve/reject/ban/delete action on registrations, linked to the registration and the admin user.';
comment on column public.audit_log.action is 'One of: approve, reject, ban, delete';
comment on column public.audit_log.reason is 'Free‑text reason entered by the admin (may be empty)';