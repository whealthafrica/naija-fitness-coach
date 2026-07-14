-- Alter lessons table to support the new two-checkpoint MCQ system
alter table public.lessons add column if not exists mid_question_text text;
alter table public.lessons add column if not exists mid_question_options jsonb default '[]'::jsonb;
alter table public.lessons add column if not exists mid_question_correct text;
alter table public.lessons add column if not exists end_question_text text;
