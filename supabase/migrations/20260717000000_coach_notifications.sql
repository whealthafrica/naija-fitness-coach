-- SQL Migration: Coach Notifications & Lesson Configuration Columns
-- Path: supabase/migrations/20260717000000_coach_notifications.sql

-- 1. Create coach notifications table
create table if not exists public.coach_notifications (
    id uuid primary key default gen_random_uuid(),
    coach_id uuid references public.coaches(id) on delete cascade not null,
    type text not null default 'new_client', -- 'new_client' or 'task_choice_alert'
    patient_id uuid references public.users(id) on delete cascade not null,
    unread boolean not null default true,
    created_at timestamptz default now() not null
);

-- Enable Row Level Security (RLS)
alter table public.coach_notifications enable row level security;

-- Setup RLS Policies for coach notifications
drop policy if exists "Coaches can view their own notifications" on public.coach_notifications;
create policy "Coaches can view their own notifications"
on public.coach_notifications for select using (
  (public.get_auth_user_role() = 'coach' and coach_id = public.get_auth_user_coach_id()::uuid)
  or public.get_auth_user_role() = 'superadmin'
);

drop policy if exists "Coaches can update their own notifications" on public.coach_notifications;
create policy "Coaches can update their own notifications"
on public.coach_notifications for update using (
  (public.get_auth_user_role() = 'coach' and coach_id = public.get_auth_user_coach_id()::uuid)
  or public.get_auth_user_role() = 'superadmin'
);

drop policy if exists "Enable insert for authenticated users" on public.coach_notifications;
create policy "Enable insert for authenticated users"
on public.coach_notifications for insert with check (true);

-- 2. Alter lessons table to support configurable checkpoint percentages & coach notifications
alter table public.lessons add column if not exists mid_checkpoint_pct integer not null default 65;
alter table public.lessons add column if not exists end_checkpoint_pct integer not null default 85;
alter table public.lessons add column if not exists notify_coach_opt_1 boolean not null default false;
alter table public.lessons add column if not exists notify_coach_opt_2 boolean not null default true;
alter table public.lessons add column if not exists notify_coach_opt_3 boolean not null default true;

-- 3. Create outreach logs table
create table if not exists public.outreach_logs (
    id uuid primary key default gen_random_uuid(),
    coach_id uuid references public.coaches(id) on delete cascade not null,
    patient_id uuid references public.users(id) on delete cascade not null,
    channel text not null, -- 'WhatsApp', 'Phone Call', 'SMS'
    summary text not null,
    created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.outreach_logs enable row level security;

-- Setup RLS Policies for outreach logs
drop policy if exists "Coaches can view outreach logs for their clients" on public.outreach_logs;
create policy "Coaches can view outreach logs for their clients"
on public.outreach_logs for select using (
  (public.get_auth_user_role() = 'coach' and coach_id = public.get_auth_user_coach_id()::uuid)
  or public.get_auth_user_role() = 'superadmin'
);

drop policy if exists "Coaches can insert outreach logs for their clients" on public.outreach_logs;
create policy "Coaches can insert outreach logs for their clients"
on public.outreach_logs for insert with check (
  (public.get_auth_user_role() = 'coach' and coach_id = public.get_auth_user_coach_id()::uuid)
  or public.get_auth_user_role() = 'superadmin'
);
