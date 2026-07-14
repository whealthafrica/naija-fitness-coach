-- Add CP & League Tier columns to public.users
alter table public.users add column if not exists cp integer default 0 not null;
alter table public.users add column if not exists tier text default 'Bronze' not null;
alter table public.users add column if not exists show_tier_badge boolean default false not null;

-- Trigger to guarantee CP never decreases (enforcing spec-level immutability)
create or replace function check_cp_increment()
returns trigger as $$
begin
    if NEW.cp < OLD.cp then
        NEW.cp := OLD.cp; -- Ignore the decrement, enforce immutability of decreases
    end if;
    return NEW;
end;
$$ language plpgsql;

drop trigger if exists enforce_cp_increment on public.users;
create trigger enforce_cp_increment
    before update on public.users
    for each row
    execute function check_cp_increment();

-- Create Telemetry Events table for consistency scoring diagnostics
create table if not exists public.telemetry_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    event_type text not null, -- 'tier_up', 'badge_toggle'
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- Enable RLS on Telemetry
alter table public.telemetry_events enable row level security;

drop policy if exists "Users can view their own telemetry events" on public.telemetry_events;
create policy "Users can view their own telemetry events"
on public.telemetry_events for all to authenticated using (
    auth.uid() = user_id
) with check (
    auth.uid() = user_id
);

drop policy if exists "Allow service_role to manage telemetry" on public.telemetry_events;
create policy "Allow service_role to manage telemetry"
on public.telemetry_events for all to service_role using (true);
