-- Create Task Completions Table
create table if not exists public.task_completions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade not null,
    task_id text not null,
    task_type text not null, -- 'timed', 'loggable', 'photo'
    started_at timestamptz not null default now(),
    completed_at timestamptz not null default now(),
    duration_seconds integer not null, -- actual duration the task interface was open
    
    -- Timed task recall check
    recall_question text,
    recall_selected text,
    recall_correct boolean,
    
    -- Loggable task inputs (Structured fields for coaching analysis)
    reflective_choice text,
    reflective_text text,
    
    -- Photo check-in credentials (for Gemini 2.0 Flash + R2)
    photo_url text,
    photo_classification_confidence numeric(3, 2), -- e.g. 0.95
    photo_classification_match boolean,
    
    -- Silent pattern-level trust logging (for future trust scoring, invisible to user)
    time_elapsed_ms bigint, -- elapsed time between task shown and marked complete
    response_duration_ms bigint, -- duration the user took to answer the reflective input
    identical_response_streak integer default 0,
    low_confidence_flag boolean default false,
    
    created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.task_completions enable row level security;

-- Policies for security
drop policy if exists "Users can manage their own task completions" on public.task_completions;
create policy "Users can manage their own task completions"
on public.task_completions for all to authenticated using (
    auth.uid() = user_id
) with check (
    auth.uid() = user_id
);

drop policy if exists "Allow all actions on task completions for service_role" on public.task_completions;
create policy "Allow all actions on task completions for service_role"
on public.task_completions for all to service_role using (true);
