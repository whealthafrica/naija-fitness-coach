create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create type user_role as enum ('client', 'coach', 'admin');
create type subscription_tier as enum ('basic', 'standard', 'premium');
create type condition_type as enum (
  'type_2_diabetes', 'hypertension', 'pcos',
  'pre_diabetes', 'fatty_liver', 'pregnancy', 'obesity'
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text not null,
  phone text unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  primary_condition condition_type not null,
  subscription_tier subscription_tier not null,
  coach_id uuid references profiles(id),
  program_start_date date not null default current_date,
  program_cycle_days int not null default 84,
  subscription_status text not null default 'active',
  subscription_expires_at timestamptz not null,
  onboarding_phase int not null default 1,
  typical_sleep_hours numeric(3,1),
  typical_water_glasses int,
  medications text[],
  triggers text,
  goals text,
  created_at timestamptz not null default now()
);

create table coach_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  bio text,
  specialisations condition_type[],
  is_full_time boolean not null default true,
  max_clients int not null default 50,
  active_client_count int not null default 0,
  avg_response_minutes int,
  created_at timestamptz not null default now()
);

create table daily_missions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  mission_date date not null default current_date,
  tasks jsonb not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, mission_date)
);

create table check_ins (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  mission_id uuid references daily_missions(id),
  check_in_date date not null default current_date,
  sleep_hours numeric(3,1),
  water_glasses int,
  steps int,
  steps_source text default 'manual',
  meals_planned int,
  meals_eaten int,
  biggest_win text,
  help_text text,
  crisis_flag boolean not null default false,
  meal_photo_url text,
  blood_sugar_mgdl int,
  medication_taken boolean,
  hypoglycemia_symptoms boolean,
  blood_pressure_systolic int,
  blood_pressure_diastolic int,
  pulse int,
  stress_level int,
  cycle_day int,
  weight_kg numeric(5,1),
  waist_cm numeric(5,1),
  created_at timestamptz not null default now(),
  unique (client_id, check_in_date)
);

create index idx_checkins_client_date on check_ins(client_id, check_in_date desc);
create index idx_checkins_crisis on check_ins(crisis_flag) where crisis_flag = true;

create table consistency_scores (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  calculated_date date not null default current_date,
  score_28d numeric(5,2) not null,
  days_active_28d int not null,
  created_at timestamptz not null default now(),
  unique (client_id, calculated_date)
);

create table lessons (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  youtube_url text not null,
  duration_seconds int not null,
  condition_pathway condition_type,
  week_number int not null,
  mid_video_mcq jsonb,
  self_placement_question text default 'What does this change for you?',
  self_placement_options text[] default array[
    'I will try this tomorrow', 'I already do this',
    'I need to talk to my coach', 'I am not sure yet'
  ],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table lesson_progress (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id),
  watched_seconds_set int[] not null default '{}',
  pct_watched numeric(5,2) not null default 0,
  mcq_answer text,
  self_placement_answer text,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, lesson_id)
);

create type league_tier as enum ('bronze','silver','gold','platinum','diamond','obsidian');

create table league_status (
  client_id uuid primary key references client_profiles(id) on delete cascade,
  current_tier league_tier not null default 'bronze',
  consistency_points int not null default 0,
  tier_achieved_at timestamptz not null default now(),
  below_threshold_days int not null default 0
);

create table iron_wallets (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  cycle_start_date date not null,
  program_fee_naira int not null,
  locked_incentive_naira int not null,
  earned_naira int not null default 0,
  iron_points int not null default 0,
  payout_status text not null default 'in_progress',
  paystack_payment_ref text,
  paid_out_at timestamptz,
  created_at timestamptz not null default now()
);

create table iron_points_ledger (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references iron_wallets(id) on delete cascade,
  activity text not null,
  points int not null,
  naira_equivalent int not null,
  created_at timestamptz not null default now()
);

create table coach_messages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  coach_id uuid not null references coach_profiles(id),
  sender_role text not null,
  body text not null,
  ai_drafted boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table coach_notes (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  coach_id uuid not null references coach_profiles(id),
  note text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

create table crisis_alerts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  check_in_id uuid references check_ins(id),
  matched_keywords text[],
  status text not null default 'open',
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz,
  sms_fallback_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table coach_flags (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references coach_profiles(id),
  reported_by_client_id uuid references client_profiles(id),
  severity text not null,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table subscription_events (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  event_type text not null,
  tier subscription_tier not null,
  paystack_ref text,
  amount_naira int,
  created_at timestamptz not null default now()
);

create table tracker_entries (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  tracker_type text not null,
  entry_date date not null default current_date,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (client_id, tracker_type, entry_date)
);

create table community_posts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  body text,
  photo_url text,
  is_coach_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table community_reactions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references community_posts(id) on delete cascade,
  client_id uuid not null references client_profiles(id) on delete cascade,
  reaction text not null check (reaction in ('love','celebrate','inspired')),
  created_at timestamptz not null default now(),
  unique (post_id, client_id)
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();
