-- SQL Migration: Enforce Single Reaction Per User Per Post/Telemetry Event
-- Path: supabase/migrations/20260724000000_single_reaction.sql

-- 1. Drop old uniqueness constraints and indexes
drop index if exists public.idx_unique_post_reaction;
drop index if exists public.idx_unique_telemetry_reaction;
alter table public.community_reactions drop constraint if exists community_reactions_community_post_id_telemetry_event_id_use_key;

-- 2. Migrate existing data: Deactivate duplicates (keeping only the earliest one active)
with ranked_reactions as (
    select id,
           row_number() over(partition by coalesce(community_post_id, telemetry_event_id), user_id order by created_at asc) as rn
    from public.community_reactions
    where active = true
)
update public.community_reactions
set active = false
where id in (select id from ranked_reactions where rn > 1);

-- 3. Create new unique partial indexes that restrict to one ACTIVE reaction per user per post (preserving deactivated records)
drop index if exists public.idx_unique_post_user_reaction;
create unique index idx_unique_post_user_reaction
on public.community_reactions (community_post_id, user_id)
where community_post_id is not null and active = true;

drop index if exists public.idx_unique_telemetry_user_reaction;
create unique index idx_unique_telemetry_user_reaction
on public.community_reactions (telemetry_event_id, user_id)
where telemetry_event_id is not null and active = true;
