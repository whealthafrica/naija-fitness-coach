-- Create trigger function to update program_progress on task completion (excluding vitals)
create or replace function public.update_patient_program_progress()
returns trigger as $$
declare
    total_target_tasks numeric := 24.0; -- Target tasks for 12-week program duration
    completed_non_vitals_count integer;
begin
    -- Count distinct non-vitals completed tasks
    select count(distinct task_id)
    into completed_non_vitals_count
    from public.task_completions
    where user_id = NEW.user_id
      and task_type != 'vitals'
      and task_type != 'lesson_checkpoint_mid' -- Checkpoints award CP only, not program progress
      and task_type != 'lesson_checkpoint_end';

    -- Update patient pathway state
    insert into public.patient_pathway_state (user_id, program_progress)
    values (NEW.user_id, least(100.00, (completed_non_vitals_count / total_target_tasks) * 100.00))
    on conflict (user_id) do update
    set program_progress = least(100.00, (completed_non_vitals_count / total_target_tasks) * 100.00),
        last_evaluated_at = now();

    return NEW;
end;
$$ language plpgsql security definer;

-- Bind trigger to task_completions table
drop trigger if exists on_task_completion_update_progress on public.task_completions;
create trigger on_task_completion_update_progress
    after insert on public.task_completions
    for each row
    execute function public.update_patient_program_progress();
