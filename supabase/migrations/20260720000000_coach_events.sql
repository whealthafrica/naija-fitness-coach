-- SQL Migration: Coach Scheduled Events Table and RLS
-- Path: supabase/migrations/20260720000000_coach_events.sql

create table if not exists public.coach_events (
    id uuid primary key default gen_random_uuid(),
    coach_id uuid references public.coaches(id) on delete cascade not null,
    title text not null,
    description text,
    event_datetime timestamptz not null,
    status text not null default 'upcoming' check (status in ('upcoming', 'cancelled')),
    created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.coach_events enable row level security;

-- Policies:
-- 1. Coaches can insert, update, select, and delete events belonging to themselves.
-- Ensure any existing policies are replaced to avoid duplicate-create errors
drop policy if exists "Coaches manage their own events" on public.coach_events;
create policy "Coaches manage their own events" on public.coach_events
for all using (
  (public.get_auth_user_role() = 'coach' and coach_id = public.get_auth_user_coach_id()::uuid)
);

-- 2. Patients can select events belonging to their assigned coach.
drop policy if exists "Patients view their assigned coach events" on public.coach_events;
create policy "Patients view their assigned coach events" on public.coach_events
for select using (
  (public.get_auth_user_role() = 'patient' and coach_id = public.get_auth_user_coach_id()::uuid)
);

-- 3. Superadmins can manage all events.
drop policy if exists "Superadmins manage all events" on public.coach_events;
create policy "Superadmins manage all events" on public.coach_events
for all using (
  public.get_auth_user_role() = 'superadmin'
);
