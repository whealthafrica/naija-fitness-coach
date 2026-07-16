-- Enable pgvector extension
create extension if not exists vector;

-- Create Tasks Table
create table if not exists public.tasks (
    id text primary key,
    condition text not null,
    title text not null,
    description text not null,
    type text not null,
    difficulty text not null default 'standard', -- 'easy' or 'standard'
    embedding vector(1536), -- for OpenAI embeddings
    created_at timestamptz default now() not null
);

-- Alter Lessons table to add difficulty and embedding columns
alter table public.lessons add column if not exists difficulty text not null default 'standard';
alter table public.lessons add column if not exists embedding vector(1536);

-- Create Coach Flags Table
create table if not exists public.coach_flags (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade not null,
    trigger_reason text not null,
    triggered_at timestamptz default now() not null,
    status text not null default 'pending', -- 'pending', 'approved', 'dismissed'
    proposed_pathway jsonb, -- proposal for simpler pathway (array of tasks/lessons)
    created_at timestamptz default now() not null
);

-- Alter Patient Pathway State to add custom_task_list override column
alter table public.patient_pathway_state add column if not exists custom_task_list jsonb;

-- Enable row level security
alter table public.tasks enable row level security;
alter table public.coach_flags enable row level security;

-- Permissive policies for testing/demo purposes
drop policy if exists "Allow read access to tasks for authenticated users" on public.tasks;
create policy "Allow read access to tasks for authenticated users"
on public.tasks for select using (true);

drop policy if exists "Allow all actions on tasks for service_role" on public.tasks;
create policy "Allow all actions on tasks for service_role"
on public.tasks for all to service_role using (true);

drop policy if exists "Allow read/write access to coach_flags for authenticated users" on public.coach_flags;
create policy "Allow read/write access to coach_flags for authenticated users"
on public.coach_flags for all using (true) with check (true);
