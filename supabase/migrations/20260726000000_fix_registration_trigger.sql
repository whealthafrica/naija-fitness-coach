-- SQL Migration: Correct column name in handle_new_user() trigger function
-- Path: supabase/migrations/20260726000000_fix_registration_trigger.sql

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, phone, name, email)
  values (
    new.id,
    coalesce(new.phone, ''),
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
