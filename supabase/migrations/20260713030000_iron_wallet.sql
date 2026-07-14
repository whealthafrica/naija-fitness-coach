-- Rename rolling_completion_rate to program_progress in patient_pathway_state
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_name='patient_pathway_state' and column_name='rolling_completion_rate'
  ) then
    alter table public.patient_pathway_state rename column rolling_completion_rate to program_progress;
  end if;
end $$;

-- Create Iron Wallet table to support commitment contract payments
create table if not exists public.iron_wallet (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade unique not null,
    tier_type text not null default 'Standard', -- 'Standard' or 'Premium'
    deposit_amount numeric(12, 2) not null default 10000.00, -- e.g. 10000.00 ₦
    tier_cap numeric(12, 2) not null default 10000.00, -- ₦10,000 for Standard, ₦20,000 for Premium
    calculated_payout numeric(12, 2) not null default 0.00,
    final_payout numeric(12, 2) not null default 0.00,
    is_withdrawn boolean not null default false,
    manual_review_required boolean not null default false,
    is_approved boolean not null default false, -- set by admin manual review
    withdrawn_at timestamptz,
    created_at timestamptz default now() not null,

    -- Hard constraint: payout never exceeds tier cap
    constraint chk_payout_under_cap check (final_payout <= tier_cap)
);

-- Enable Row Level Security (RLS)
alter table public.iron_wallet enable row level security;

-- Setup RLS Policies
drop policy if exists "Users can view their own wallet" on public.iron_wallet;
create policy "Users can view their own wallet" 
on public.iron_wallet for select to authenticated using (
    auth.uid() = user_id
);

drop policy if exists "Allow all actions on iron_wallet for authenticated users" on public.iron_wallet;
create policy "Allow all actions on iron_wallet for authenticated users" 
on public.iron_wallet for all to authenticated using (true) with check (true);
