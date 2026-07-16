-- Create switch audit log table
create table if not exists public.pathway_switch_audit_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade not null,
    flag_id uuid references public.coach_flags(id) not null,
    old_pathway_type text not null,
    new_pathway_type text not null,
    old_task_list jsonb,
    effective_week integer not null,
    switch_count_at_time integer not null,
    approved_at timestamptz not null default now()
);

-- Enable RLS on audit log
alter table public.pathway_switch_audit_log enable row level security;
drop policy if exists "Allow service_role full access to pathway_switch_audit_log" on public.pathway_switch_audit_log;
create policy "Allow service_role full access to pathway_switch_audit_log"
on public.pathway_switch_audit_log for all to service_role using (true);

-- Alter patient_pathway_state to add switch count and effective tracking
alter table public.patient_pathway_state add column if not exists pathway_switch_count integer not null default 0;
alter table public.patient_pathway_state add column if not exists pathway_effective_from_week integer;

-- Enforce maximum switch count at the DB level (e.g. 2 switches)
alter table public.patient_pathway_state drop constraint if exists chk_max_pathway_switches;
alter table public.patient_pathway_state add constraint chk_max_pathway_switches check (pathway_switch_count <= 2);

-- Create weekly task snapshots table
create table if not exists public.weekly_task_snapshots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade not null,
    week_number integer not null check (week_number >= 1 and week_number <= 12),
    tasks_assigned integer not null check (tasks_assigned >= 0),
    tasks_snapshot jsonb not null default '[]'::jsonb,
    pathway_type text not null default 'standard',
    locked_at timestamptz not null default now(),
    unique (user_id, week_number)
);

-- Create weekly completions cache table
create table if not exists public.weekly_completions_cache (
    user_id uuid references public.users(id) on delete cascade not null,
    week_number integer not null check (week_number >= 1 and week_number <= 12),
    completed integer not null default 0 check (completed >= 0),
    primary key (user_id, week_number)
);

-- Enable RLS on snapshots and completions cache
alter table public.weekly_task_snapshots enable row level security;
alter table public.weekly_completions_cache enable row level security;

-- Permissive policies for service role and basic selects
drop policy if exists "Allow select for users on their snapshots" on public.weekly_task_snapshots;
create policy "Allow select for users on their snapshots"
on public.weekly_task_snapshots for select using (auth.uid() = user_id);

drop policy if exists "Allow service role all actions on snapshots" on public.weekly_task_snapshots;
create policy "Allow service role all actions on snapshots"
on public.weekly_task_snapshots for all to service_role using (true);

drop policy if exists "Allow select for users on their completions cache" on public.weekly_completions_cache;
create policy "Allow select for users on their completions cache"
on public.weekly_completions_cache for select using (auth.uid() = user_id);

drop policy if exists "Allow service role all actions on completions cache" on public.weekly_completions_cache;
create policy "Allow service role all actions on completions cache"
on public.weekly_completions_cache for all to service_role using (true);

-- Function to get user current week number based on enrollment/creation date
create or replace function public.get_user_current_week(p_user_id uuid)
returns integer as $$
declare
    enrollment_date timestamptz;
    days_elapsed integer;
    curr_week integer;
begin
    select created_at into enrollment_date from public.users where id = p_user_id;
    if enrollment_date is null then
        return 1;
    end if;
    days_elapsed := extract(day from (now() - enrollment_date))::integer;
    curr_week := (days_elapsed / 7) + 1;
    if curr_week < 1 then curr_week := 1; end if;
    if curr_week > 12 then curr_week := 12; end if;
    return curr_week;
end;
$$ language plpgsql stable security definer;

-- Trigger to block updating closed-week snapshots
create or replace function public.trig_block_closed_week_snapshot_update()
returns trigger as $$
declare
    current_user_week integer;
begin
    current_user_week := public.get_user_current_week(OLD.user_id);
    if OLD.week_number < current_user_week then
        raise exception 'Cannot modify weekly task snapshots for past/closed weeks. Immutable audit rule violated.';
    end if;
    return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists block_closed_week_snapshot_update on public.weekly_task_snapshots;
create trigger block_closed_week_snapshot_update
    before update or delete on public.weekly_task_snapshots
    for each row
    execute function public.trig_block_closed_week_snapshot_update();

-- Trigger to block updating closed-week completions cache
create or replace function public.trig_block_closed_week_completions_update()
returns trigger as $$
declare
    current_user_week integer;
begin
    current_user_week := public.get_user_current_week(OLD.user_id);
    if OLD.week_number < current_user_week then
        raise exception 'Cannot modify weekly completions cache for past/closed weeks. Immutable audit rule violated.';
    end if;
    return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists block_closed_week_completions_update on public.weekly_completions_cache;
create trigger block_closed_week_completions_update
    before update or delete on public.weekly_completions_cache
    for each row
    execute function public.trig_block_closed_week_completions_update();

-- Trigger on task completions to populate and sync the weekly completions cache
create or replace function public.sync_task_completion_to_weekly_cache()
returns trigger as $$
declare
    target_week integer;
    completed_count integer;
begin
    -- Determine which week this task completion falls into
    target_week := public.get_user_current_week(NEW.user_id);
    
    -- We only count non-vitals, non-checkpoint tasks for progress calculation
    if NEW.task_type != 'vitals' 
       and NEW.task_type != 'lesson_checkpoint_mid' 
       and NEW.task_type != 'lesson_checkpoint_end' then
       
       -- Recalculate unique completed tasks for this user in this specific week
       select count(distinct task_id)
       into completed_count
       from public.task_completions
       where user_id = NEW.user_id
         and task_type != 'vitals'
         and task_type != 'lesson_checkpoint_mid'
         and task_type != 'lesson_checkpoint_end'
         and completed_at >= (select created_at from public.users where id = NEW.user_id) + ((target_week - 1) * 7 * interval '1 day')
         and completed_at < (select created_at from public.users where id = NEW.user_id) + (target_week * 7 * interval '1 day');

       insert into public.weekly_completions_cache (user_id, week_number, completed)
       values (NEW.user_id, target_week, completed_count)
       on conflict (user_id, week_number) do update
       set completed = EXCLUDED.completed;
    end if;
    
    return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_task_completion_sync_cache on public.task_completions;
create trigger on_task_completion_sync_cache
    after insert or update on public.task_completions
    for each row
    execute function public.sync_task_completion_to_weekly_cache();

-- Re-compute and update the final blended program_progress in patient_pathway_state
create or replace function public.update_patient_program_progress()
returns trigger as $$
declare
    total_assigned integer := 0;
    total_completed integer := 0;
    computed_pct numeric(5,2) := 0.00;
    r record;
begin
    -- Guarantee a snapshot exists for all weeks up to the current week
    for r in 
        select generate_series(1, public.get_user_current_week(NEW.user_id)) as week_num
    loop
        insert into public.weekly_task_snapshots (user_id, week_number, tasks_assigned, pathway_type)
        values (
            NEW.user_id, 
            r.week_num, 
            3,
            'standard'
        )
        on conflict (user_id, week_number) do nothing;
    end loop;

    -- Aggregate assigned tasks from snapshot
    select coalesce(sum(tasks_assigned), 0)
    into total_assigned
    from public.weekly_task_snapshots
    where user_id = NEW.user_id;

    -- Aggregate completed tasks from cache
    select coalesce(sum(completed), 0)
    into total_completed
    from public.weekly_completions_cache
    where user_id = NEW.user_id;

    if total_assigned > 0 then
        computed_pct := least(100.00, ((total_completed::numeric / total_assigned::numeric) * 100.00));
    else
        computed_pct := 0.00;
    end if;

    -- Update patient pathway state
    insert into public.patient_pathway_state (user_id, program_progress)
    values (NEW.user_id, computed_pct)
    on conflict (user_id) do update
    set program_progress = computed_pct,
        last_evaluated_at = now();

    return NEW;
end;
$$ language plpgsql security definer;

-- Ensure trigger binds to both completions AND snapshots updates
drop trigger if exists on_task_completion_update_progress on public.task_completions;
create trigger on_task_completion_update_progress
    after insert or update on public.task_completions
    for each row
    execute function public.update_patient_program_progress();

drop trigger if exists on_snapshot_update_progress on public.weekly_task_snapshots;
create trigger on_snapshot_update_progress
    after insert or update on public.weekly_task_snapshots
    for each row
    execute function public.update_patient_program_progress();
