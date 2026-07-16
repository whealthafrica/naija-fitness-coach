-- Exclude custom tasks from Program Progress calculations

-- Trigger on task completions to populate and sync the weekly completions cache
create or replace function public.sync_task_completion_to_weekly_cache()
returns trigger as $$
declare
    target_week integer;
    completed_count integer;
begin
    -- Determine which week this task completion falls into
    target_week := public.get_user_current_week(NEW.user_id);
    
    -- Custom coach-assigned tasks are excluded from Program Progress by design: coach discretion in adding tasks would otherwise create unequal payout paths between patients under different coaches. Custom tasks award CP only.
    if NEW.task_type != 'vitals' 
       and NEW.task_type != 'lesson_checkpoint_mid' 
       and NEW.task_type != 'lesson_checkpoint_end'
       and NEW.task_id not like 'custom_%' then
       
       -- Recalculate unique completed tasks for this user in this specific week (excluding custom tasks)
       select count(distinct task_id)
       into completed_count
       from public.task_completions
       where user_id = NEW.user_id
         and task_type != 'vitals'
         and task_type != 'lesson_checkpoint_mid'
         and task_type != 'lesson_checkpoint_end'
         and task_id not like 'custom_%'
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

-- Recalculate and update the final blended program_progress
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

-- Cleanup already-inflated snapshots for future weeks (not yet completed)
with filtered_snapshots as (
  select 
    user_id,
    week_number,
    (
      select jsonb_agg(task) 
      from jsonb_array_elements(tasks_snapshot) as task 
      where (task->>'id') not like 'custom_%'
    ) as new_snapshot
  from public.weekly_task_snapshots
)
update public.weekly_task_snapshots s
set 
  tasks_snapshot = coalesce(f.new_snapshot, '[]'::jsonb),
  tasks_assigned = coalesce(jsonb_array_length(f.new_snapshot), 0)
from filtered_snapshots f
where s.user_id = f.user_id 
  and s.week_number = f.week_number
  and s.week_number > public.get_user_current_week(s.user_id);
