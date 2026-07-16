-- SQL Migration: Community Posts and Reactions Persistence
-- Path: supabase/migrations/20260720000000_community_persistence.sql

-- 1. Create Community Posts Table
create table if not exists public.community_posts (
    id uuid primary key default gen_random_uuid(),
    author_type text not null check (author_type in ('coach', 'system', 'patient')),
    author_id uuid,
    content text not null,
    created_at timestamptz default now() not null
);

-- 2. Create Community Reactions Table
create table if not exists public.community_reactions (
    id uuid primary key default gen_random_uuid(),
    community_post_id uuid references public.community_posts(id) on delete cascade,
    telemetry_event_id uuid references public.telemetry_events(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade not null,
    reaction_type text not null check (reaction_type in ('love', 'celebrate', 'inspired')),
    created_at timestamptz default now() not null,
    cp_awarded boolean not null default false,
    active boolean not null default true,

    -- Constraint: exactly one of community_post_id or telemetry_event_id must be populated
    constraint chk_exactly_one_id check (
        (community_post_id is not null and telemetry_event_id is null) or 
        (community_post_id is null and telemetry_event_id is not null)
    ),

    unique (community_post_id, telemetry_event_id, user_id, reaction_type)
);

-- 3. Create Uniqueness constraints (using partial indexes because of nullable target fields)
create unique index if not exists idx_unique_post_reaction 
on public.community_reactions (community_post_id, user_id, reaction_type) 
where community_post_id is not null;

create unique index if not exists idx_unique_telemetry_reaction 
on public.community_reactions (telemetry_event_id, user_id, reaction_type) 
where telemetry_event_id is not null;

-- 4. Enable Row Level Security (RLS)
alter table public.community_posts enable row level security;
alter table public.community_reactions enable row level security;

-- 5. Set up RLS Policies
-- Community Posts
drop policy if exists "Users can view all community posts" on public.community_posts;
create policy "Users can view all community posts" 
on public.community_posts for select to authenticated using (true);

drop policy if exists "Allow all actions on community posts for service_role" on public.community_posts;
create policy "Allow all actions on community posts for service_role" 
on public.community_posts for all to service_role using (true);

-- Community Reactions
drop policy if exists "Users can view all community reactions" on public.community_reactions;
create policy "Users can view all community reactions" 
on public.community_reactions for select to authenticated using (true);

drop policy if exists "Users can manage their own reactions" on public.community_reactions;
create policy "Users can manage their own reactions" 
on public.community_reactions for all to authenticated using (
    auth.uid() = user_id
) with check (
    auth.uid() = user_id
);

drop policy if exists "Allow all actions on community reactions for service_role" on public.community_reactions;
create policy "Allow all actions on community reactions for service_role" 
on public.community_reactions for all to service_role using (true);

-- 6. Seed initial coach posts (Tunde and Adaeze) matching current coaches in database
insert into public.community_posts (id, author_type, author_id, content, created_at)
select 
  'a29f8c6e-9824-4f81-9b16-52c67c514781'::uuid, 
  'coach', 
  id, 
  'Just posted a new mobility tip on the Today screen. Remember, focusing on today''s steps for even 5 minutes builds long-term metabolic health. Consistency always beats intensity!', 
  now() - interval '3 hours'
from public.coaches 
where lower(name) = 'tunde'
limit 1;

insert into public.community_posts (id, author_type, author_id, content, created_at)
select 
  'e643bf7e-071a-4c28-9844-4866ef11ff92'::uuid, 
  'coach', 
  id, 
  'A quick tip for today''s hydration: try replacing a sugary drink with a glass of unsweetened water or native zobo tea. Small choices make health adaptation feel effortless.', 
  now() - interval '1 day'
from public.coaches 
where lower(name) = 'adaeze'
limit 1;
