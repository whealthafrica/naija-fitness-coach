-- Create Payout Logs Table for automatic audit trails
create table if not exists public.payout_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade not null,
    wallet_id uuid references public.iron_wallet(id) on delete cascade not null,
    program_progress numeric(5, 2) not null,
    deposit_amount numeric(12, 2) not null,
    calculated_payout numeric(12, 2) not null,
    final_payout numeric(12, 2) not null,
    paystack_transfer_id text,
    payout_status text not null default 'Success',
    recorded_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.payout_logs enable row level security;

-- Policies for security
drop policy if exists "Users can view their own payout logs" on public.payout_logs;
create policy "Users can view their own payout logs"
on public.payout_logs for select to authenticated using (
    auth.uid() = user_id
);

drop policy if exists "Allow all actions on payout logs for service_role" on public.payout_logs;
create policy "Allow all actions on payout logs for service_role"
on public.payout_logs for all to service_role using (true);
