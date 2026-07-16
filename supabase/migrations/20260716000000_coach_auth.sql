-- SQL Migration: Coach Auth and Row Level Security
-- Path: supabase/migrations/20260716000000_coach_auth.sql

-- 1. Alter users table to support coach logins
alter table public.users alter column phone drop not null;
alter table public.users add column if not exists role text not null default 'patient' check (role in ('patient', 'coach', 'superadmin'));

-- 2. Alter coaches table to include assigned condition
alter table public.coaches add column if not exists condition text;

-- Update existing seeded coaches with their clinical conditions
update public.coaches set condition = 'Type 2 Diabetes' where name = 'Tunde';
update public.coaches set condition = 'Hypertension' where name = 'Adaeze';
update public.coaches set condition = 'PCOS' where name = 'Ngozi';
update public.coaches set condition = 'Pre-Diabetes' where name = 'Emeka';
update public.coaches set condition = 'General Fitness' where name = 'Amara';

-- 3. Define non-recursive security helper functions
create or replace function public.get_auth_user_role()
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.get_auth_user_coach_id()
returns uuid as $$
  select coach_id from public.users where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.get_auth_user_condition()
returns text as $$
  select condition from public.coaches where id = public.get_auth_user_coach_id();
$$ language sql security definer stable;

create or replace function public.is_client_of_coach(p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 
    from public.users 
    where id = p_user_id 
      and coach_id = public.get_auth_user_coach_id()::uuid
  );
$$ language sql security definer stable;

-- 4. Update auth trigger to read metadata
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, phone, name, role, coach_id)
  values (
    new.id,
    new.phone, -- can be null
    coalesce(new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    (new.raw_user_meta_data->>'coach_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

-- 5. Drop existing policies and implement strict RLS policies on all tables

-- COACHES Policies
drop policy if exists "Allow read access to coaches for authenticated users" on public.coaches;
drop policy if exists "Allow all actions for coaches (service role/admin)" on public.coaches;

create policy "Coaches Select Policy" on public.coaches
for select using (true);

create policy "Coaches Write Policy" on public.coaches
for all using (
  public.get_auth_user_role() = 'superadmin'
);

-- USERS Policies
drop policy if exists "Users can view and update their own profile" on public.users;
drop policy if exists "Allow all actions on users for service_role" on public.users;

create policy "Users Select Policy" on public.users
for select using (
  auth.uid() = id
  or (public.get_auth_user_role() = 'coach' and coach_id = public.get_auth_user_coach_id()::uuid)
  or public.get_auth_user_role() = 'superadmin'
);

create policy "Users Write Policy" on public.users
for all using (
  auth.uid() = id
  or (public.get_auth_user_role() = 'coach' and coach_id = public.get_auth_user_coach_id()::uuid)
  or public.get_auth_user_role() = 'superadmin'
);

-- COACH FLAGS Policies
drop policy if exists "Allow read/write access to coach_flags for authenticated users" on public.coach_flags;

create policy "Coach Flags Select Policy" on public.coach_flags
for select using (
  (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or public.get_auth_user_role() = 'superadmin'
  or (public.get_auth_user_role() = 'patient' and user_id = auth.uid())
);

create policy "Coach Flags Write Policy" on public.coach_flags
for all using (
  (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or public.get_auth_user_role() = 'superadmin'
  or (public.get_auth_user_role() = 'patient' and user_id = auth.uid())
);

-- LESSONS Policies
drop policy if exists "Allow read access to lessons for all" on public.lessons;
drop policy if exists "Allow all actions on lessons for authenticated users" on public.lessons;

create policy "Lessons Select Policy" on public.lessons
for select using (
  public.get_auth_user_role() = 'superadmin'
  or (
    public.get_auth_user_role() = 'coach' 
    and condition = public.get_auth_user_condition()
  )
  or (
    public.get_auth_user_role() = 'patient'
    and (condition = (select condition from public.users where id = auth.uid()) or condition is null)
  )
);

create policy "Lessons Write Policy" on public.lessons
for all using (
  public.get_auth_user_role() = 'superadmin'
  or (
    public.get_auth_user_role() = 'coach' 
    and condition = public.get_auth_user_condition()
  )
);

-- TASKS Policies
drop policy if exists "Allow read access to tasks for authenticated users" on public.tasks;
drop policy if exists "Allow all actions on tasks for service_role" on public.tasks;

create policy "Tasks Select Policy" on public.tasks
for select using (
  public.get_auth_user_role() = 'superadmin'
  or (
    public.get_auth_user_role() = 'coach' 
    and condition = public.get_auth_user_condition()
  )
  or (
    public.get_auth_user_role() = 'patient'
    and condition = (select condition from public.users where id = auth.uid())
  )
);

create policy "Tasks Write Policy" on public.tasks
for all using (
  public.get_auth_user_role() = 'superadmin'
  or (
    public.get_auth_user_role() = 'coach' 
    and condition = public.get_auth_user_condition()
  )
);

-- VITALS LOG Policies
drop policy if exists "Users can manage their own vitals log" on public.vitals_log;
drop policy if exists "Allow all actions on vitals log for service_role" on public.vitals_log;

create policy "Vitals Log RLS Policy" on public.vitals_log
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);

-- TASK COMPLETIONS Policies
drop policy if exists "Users can manage their own task completions" on public.task_completions;
drop policy if exists "Allow all actions on task completions for service_role" on public.task_completions;

create policy "Task Completions RLS Policy" on public.task_completions
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);

-- PATIENT PATHWAY STATE Policies
drop policy if exists "Users can view and update their own pathway state" on public.patient_pathway_state;
drop policy if exists "Allow all actions on pathway state for service_role" on public.patient_pathway_state;

create policy "Patient Pathway State RLS Policy" on public.patient_pathway_state
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);

-- IRON WALLET Policies
drop policy if exists "Users can view their own wallet" on public.iron_wallet;
drop policy if exists "Allow all actions on iron_wallet for authenticated users" on public.iron_wallet;

create policy "Iron Wallet RLS Policy" on public.iron_wallet
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);

-- WEEKLY TASK SNAPSHOTS Policies
drop policy if exists "Allow select for users on their snapshots" on public.weekly_task_snapshots;
drop policy if exists "Allow service role all actions on snapshots" on public.weekly_task_snapshots;

create policy "Weekly Task Snapshots RLS Policy" on public.weekly_task_snapshots
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);

-- WEEKLY COMPLETIONS CACHE Policies
drop policy if exists "Allow select for users on their completions cache" on public.weekly_completions_cache;
drop policy if exists "Allow service role all actions on completions cache" on public.weekly_completions_cache;

create policy "Weekly Completions Cache RLS Policy" on public.weekly_completions_cache
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);

-- PATHWAY SWITCH AUDIT LOG Policies
drop policy if exists "Allow service_role full access to pathway_switch_audit_log" on public.pathway_switch_audit_log;

create policy "Pathway Switch Audit Log RLS Policy" on public.pathway_switch_audit_log
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);

-- PAYOUT LOGS Policies
drop policy if exists "Allow all actions on payout logs for service_role" on public.payout_logs;

create policy "Payout Logs RLS Policy" on public.payout_logs
for all using (
  (auth.uid() = user_id)
  or (public.get_auth_user_role() = 'coach' and public.is_client_of_coach(user_id))
  or (public.get_auth_user_role() = 'superadmin')
);
