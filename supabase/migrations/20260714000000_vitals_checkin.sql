-- Create Vitals Log Table
create table if not exists public.vitals_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade not null,
    systolic integer,
    diastolic integer,
    blood_sugar numeric(5, 2),
    weight numeric(5, 2),
    recorded_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.vitals_log enable row level security;

-- Policies for security
drop policy if exists "Users can manage their own vitals log" on public.vitals_log;
create policy "Users can manage their own vitals log"
on public.vitals_log for all to authenticated using (
    auth.uid() = user_id
) with check (
    auth.uid() = user_id
);

drop policy if exists "Allow all actions on vitals log for service_role" on public.vitals_log;
create policy "Allow all actions on vitals log for service_role"
on public.vitals_log for all to service_role using (true);
