-- Alter public.coaches table to add metadata columns
alter table public.coaches add column if not exists code text unique;
alter table public.coaches add column if not exists illustration text;
alter table public.coaches add column if not exists intro text;
alter table public.coaches add column if not exists rank_up_quote text;

-- Create lessons table (supporting condition pathways & general library)
create table if not exists public.lessons (
    id uuid primary key default gen_random_uuid(),
    condition text, -- Nullable. If null, it belongs to the General Library
    section text not null,
    title text not null,
    youtube_id text not null,
    duration_text text not null,
    duration_seconds integer not null,
    position_index integer, -- Nullable. 0-5 for sequence gating, null for General Library
    created_at timestamptz default now() not null
);

-- Create scenario questions table (for recall checks on timed tasks)
create table if not exists public.scenario_questions (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid references public.lessons(id) on delete cascade not null,
    question_text text not null,
    options jsonb not null default '[]'::jsonb, -- Array of options: ["Option A", "Option B"]
    correct_option text not null,
    created_at timestamptz default now() not null
);

-- Enable Row Level Security (RLS)
alter table public.lessons enable row level security;
alter table public.scenario_questions enable row level security;

-- Setup RLS Read Policies for authenticated and anonymous users
drop policy if exists "Allow read access to lessons for all" on public.lessons;
create policy "Allow read access to lessons for all" 
on public.lessons for select using (true);

drop policy if exists "Allow read access to scenario_questions for all" on public.scenario_questions;
create policy "Allow read access to scenario_questions for all" 
on public.scenario_questions for select using (true);

-- Setup RLS Write Policies for admin access
drop policy if exists "Allow all actions on lessons for authenticated users" on public.lessons;
create policy "Allow all actions on lessons for authenticated users" 
on public.lessons for all using (true) with check (true);

drop policy if exists "Allow all actions on scenario_questions for authenticated users" on public.scenario_questions;
create policy "Allow all actions on scenario_questions for authenticated users" 
on public.scenario_questions for all using (true) with check (true);
