-- SQL Migration: Product Announcements Table and Policies
-- Path: supabase/migrations/20260721000000_product_announcements.sql

-- 1. Create Product Announcements Table
create table if not exists public.product_announcements (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text,
    published_at timestamptz default now() not null,
    created_by uuid references public.users(id) on delete set null
);

-- 2. Enable Row Level Security (RLS)
alter table public.product_announcements enable row level security;

-- 3. Set up RLS Policies
drop policy if exists "Users can view all product announcements" on public.product_announcements;
create policy "Users can view all product announcements" 
on public.product_announcements for select to authenticated using (true);

drop policy if exists "Superadmins can manage product announcements" on public.product_announcements;
create policy "Superadmins can manage product announcements" 
on public.product_announcements for all to authenticated using (
    public.get_auth_user_role() = 'superadmin'
) with check (
    public.get_auth_user_role() = 'superadmin'
);

drop policy if exists "Allow all actions on announcements for service_role" on public.product_announcements;
create policy "Allow all actions on announcements for service_role" 
on public.product_announcements for all to service_role using (true);

-- 4. Seed initial announcement
insert into public.product_announcements (id, title, body, published_at)
values (
    '5a29f8c6-9824-4f81-9b16-52c67c514782'::uuid,
    'New Pathway: Advanced Mobility Released',
    'A brand new interactive pathway level has been added to address metabolic mobility adaptation.',
    now() - interval '2 days'
) on conflict (id) do nothing;
