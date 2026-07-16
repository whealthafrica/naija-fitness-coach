-- SQL Migration: Patient Self Reports (Rough Patch) Table and Policies
-- Path: supabase/migrations/20260722000000_self_reports.sql

-- 1. Create Self Reports Table
create table if not exists public.self_reports (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references public.users(id) on delete cascade not null,
    reason text not null check (reason in ('health_flareup', 'overwhelmed', 'busy_life', 'need_break')),
    note text,
    pause_starts_at timestamptz default now() not null,
    pause_ends_at timestamptz default (now() + interval '7 days') not null,
    created_at timestamptz default now() not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.self_reports enable row level security;

-- 3. Set up RLS Policies
drop policy if exists "Users can view their own self reports" on public.self_reports;
create policy "Users can view their own self reports"
on public.self_reports for select to authenticated using (
    auth.uid() = patient_id or 
    public.get_auth_user_role() in ('coach', 'superadmin')
);

drop policy if exists "Patients can insert their own self reports" on public.self_reports;
create policy "Patients can insert their own self reports"
on public.self_reports for insert to authenticated with check (
    auth.uid() = patient_id
);
