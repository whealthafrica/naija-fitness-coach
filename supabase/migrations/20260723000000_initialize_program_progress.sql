-- Redefine public.handle_new_user() to use the renamed program_progress column

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, phone, name)
  values (
    new.id,
    coalesce(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'name', 'New Patient')
  );
  
  -- PROGRAM PROGRESS DESIGN LOCK:
  -- Program Progress must NEVER default to a non-zero placeholder value,
  -- since it directly feeds the real Iron Wallet payout calculation.
  insert into public.patient_pathway_state (user_id, program_progress)
  values (new.id, 0.00)
  on conflict (user_id) do nothing;
  
  return new;
end;
$$ language plpgsql security definer;
