-- Create Coaches Table
create table public.coaches (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz default now() not null
);

-- Create Users Table (extends auth.users)
create table public.users (
    id uuid primary key references auth.users on delete cascade,
    phone text unique not null,
    name text,
    condition text,
    coach_id uuid references public.coaches(id) on delete set null,
    created_at timestamptz default now() not null
);

-- Create Pathways Table (composite primary key of condition + level)
create table public.pathways (
    condition text not null,
    level integer not null,
    task_list jsonb not null default '[]'::jsonb,
    created_at timestamptz default now() not null,
    primary key (condition, level)
);

-- Create Patient Pathway State Table
create table public.patient_pathway_state (
    user_id uuid primary key references public.users(id) on delete cascade,
    current_level integer not null default 1,
    rolling_completion_rate numeric(5, 2) not null default 0.00,
    last_evaluated_at timestamptz,
    created_at timestamptz default now() not null
);

-- Create Checkins Table
create table public.checkins (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade not null,
    date date not null default current_date,
    task_responses jsonb not null default '[]'::jsonb,
    open_text text,
    synced_at timestamptz default now() not null
);

-- Enable RLS on all tables
alter table public.coaches enable row level security;
alter table public.users enable row level security;
alter table public.pathways enable row level security;
alter table public.patient_pathway_state enable row level security;
alter table public.checkins enable row level security;

-- Permissive policies for testing (Step 3 requires enabling RLS with policies)
-- Coaches Policies
drop policy if exists "Allow read access to coaches for authenticated users" on public.coaches;
create policy "Allow read access to coaches for authenticated users"
on public.coaches for select to authenticated using (true);

drop policy if exists "Allow all actions for coaches (service role/admin)" on public.coaches;
create policy "Allow all actions for coaches (service role/admin)"
on public.coaches for all to service_role using (true);

-- Users Policies
drop policy if exists "Users can view and update their own profile" on public.users;
create policy "Users can view and update their own profile"
on public.users for all to authenticated using (
    auth.uid() = id
) with check (
    auth.uid() = id
);

drop policy if exists "Allow all actions on users for service_role" on public.users;
create policy "Allow all actions on users for service_role"
on public.users for all to service_role using (true);

-- Pathways Policies
drop policy if exists "Allow read access to pathways for authenticated users" on public.pathways;
create policy "Allow read access to pathways for authenticated users"
on public.pathways for select to authenticated using (true);

drop policy if exists "Allow all actions on pathways for service_role" on public.pathways;
create policy "Allow all actions on pathways for service_role"
on public.pathways for all to service_role using (true);

-- Patient Pathway State Policies
drop policy if exists "Users can view and update their own pathway state" on public.patient_pathway_state;
create policy "Users can view and update their own pathway state"
on public.patient_pathway_state for all to authenticated using (
    auth.uid() = user_id
) with check (
    auth.uid() = user_id
);

drop policy if exists "Allow all actions on pathway state for service_role" on public.patient_pathway_state;
create policy "Allow all actions on pathway state for service_role"
on public.patient_pathway_state for all to service_role using (true);

-- Checkins Policies
drop policy if exists "Users can view and manage their own checkins" on public.checkins;
create policy "Users can view and manage their own checkins"
on public.checkins for all to authenticated using (
    auth.uid() = user_id
) with check (
    auth.uid() = user_id
);

drop policy if exists "Allow all actions on checkins for service_role" on public.checkins;
create policy "Allow all actions on checkins for service_role"
on public.checkins for all to service_role using (true);

-- Trigger to automatically create a profile in public.users when an auth.user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, phone, name)
  values (
    new.id,
    coalesce(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'name', 'New Patient')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
