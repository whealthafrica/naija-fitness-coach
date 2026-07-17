-- SQL Migration: Add email column to public.users and sync from auth.users
-- Path: supabase/migrations/20260725000000_add_user_email.sql

-- 1. Add email column to public.users table
alter table public.users add column if not exists email text not null default '';

-- 2. Update trigger function handle_new_user() to populate email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, phone, name, email)
  values (
    new.id,
    coalesce(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'name', 'New Patient'),
    coalesce(new.email, new.raw_user_meta_data->>'email', '')
  );
  
  -- PROGRAM PROGRESS DESIGN LOCK:
  -- Program Progress must NEVER default to a non-zero placeholder value,
  -- since it directly feeds the real Iron Wallet payout calculation.
  insert into public.patient_pathway_state (user_id, rolling_completion_rate)
  values (new.id, 0.00);
  
  return new;
end;
$$ language plpgsql security definer;

-- 3. Backfill existing patient/user accounts with their real emails from auth.users
update public.users u
set email = coalesce(a.email, a.raw_user_meta_data->>'email', '')
from auth.users a
where u.id = a.id;
