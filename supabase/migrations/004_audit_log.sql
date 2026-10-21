-- =======================================================================
-- 004_audit_log.sql — Phase 5: registration audit log
-- Idempotent: safe to run on a fresh DB or on a DB that already has
-- the Phase 1 audit_log table.
-- =======================================================================

-- 1️⃣ Create the audit_log table (if it does not already exist)
create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  reg_id uuid references public.registrations(id) on delete cascade,
  admin_user_id uuid references auth.users(id),
  action text not null check (action in ('approve','reject','ban','delete')),
  reason text,
  created_at timestamptz default now()
);

-- 2️⃣ If the table already existed (Phase 1), add the two columns that
--    the new service expects.  “if not exists” makes this safe to repeat.
alter table public.audit_log add column if not exists reg_id uuid
    references public.registrations(id) on delete cascade;
alter table public.audit_log add column if not exists admin_user_id uuid
    references auth.users(id);

-- 3️⃣ Enable RLS and admin‑only policy
alter table public.audit_log enable row level security;

create policy "admin only can audit_log"
  on public.audit_log
  using (is_admin());

-- 4️⃣ Indexes for fast look‑ups by registration, admin, and action
create index if not exists idx_audit_log_reg_id on public.audit_log(reg_id);
create index if not exists idx_audit_log_admin on public.audit_log(admin_user_id);
create index if not exists idx_audit_log_action on public.audit_log(action);
