-- SQL Migration: Fix phone uniqueness constraint to allow phone-less OAuth signups
-- Path: supabase/migrations/20260727000000_fix_phone_uniqueness.sql

-- 1. Drop the NOT NULL constraint on phone
alter table public.users alter column phone drop not null;

-- 2. Drop the standard UNIQUE constraint on phone (key)
alter table public.users drop constraint if exists users_phone_key;

-- 3. Create a partial unique index on phone that ignores null and empty values
drop index if exists public.users_phone_unique_non_empty;
create unique index users_phone_unique_non_empty on public.users (phone) where (phone is not null and phone != '');

-- 4. Redefine handle_new_user() to insert new.phone (allowing NULL) instead of coalescing to ''
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, phone, name, email)
  values (
    new.id,
    new.phone, -- Allow null phone value, avoiding unique constraint conflict on empty strings
    coalesce(new.raw_user_meta_data->>'name', 'New Patient'),
    coalesce(new.email, new.raw_user_meta_data->>'email', '')
  )
  on conflict (id) do nothing;
  
  -- PROGRAM PROGRESS DESIGN LOCK:
  -- Program Progress must NEVER default to a non-zero placeholder value,
  -- since it directly feeds the real Iron Wallet payout calculation.
  insert into public.patient_pathway_state (user_id, program_progress)
  values (new.id, 0.00)
  on conflict (user_id) do nothing;
  
  return new;
end;
$$ language plpgsql security definer;
