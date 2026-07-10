alter table profiles enable row level security;
alter table client_profiles enable row level security;
alter table coach_profiles enable row level security;
alter table daily_missions enable row level security;
alter table check_ins enable row level security;
alter table consistency_scores enable row level security;
alter table lesson_progress enable row level security;
alter table league_status enable row level security;
alter table iron_wallets enable row level security;
alter table iron_points_ledger enable row level security;
alter table coach_messages enable row level security;
alter table coach_notes enable row level security;
alter table crisis_alerts enable row level security;
alter table tracker_entries enable row level security;
alter table community_posts enable row level security;
alter table community_reactions enable row level security;

create or replace function is_assigned_coach(target_client_id uuid)
returns boolean as $$
  select exists (
    select 1 from client_profiles
    where id = target_client_id and coach_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

create policy "own profile" on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());
create policy "admin sees all profiles" on profiles for select using (is_admin());

create policy "client sees own" on client_profiles for select using (id = auth.uid());
create policy "client updates own" on client_profiles for update using (id = auth.uid());
create policy "coach sees assigned clients" on client_profiles for select using (is_assigned_coach(id));
create policy "admin full access clients" on client_profiles for all using (is_admin());

create policy "client crud own checkins" on check_ins for all using (client_id = auth.uid());
create policy "coach reads assigned checkins" on check_ins for select using (is_assigned_coach(client_id));
create policy "admin all checkins" on check_ins for all using (is_admin());

create policy "client crud own missions" on daily_missions for all using (client_id = auth.uid());
create policy "coach reads assigned missions" on daily_missions for select using (is_assigned_coach(client_id));
create policy "admin all missions" on daily_missions for all using (is_admin());

create policy "client reads own score" on consistency_scores for select using (client_id = auth.uid());
create policy "coach reads assigned score" on consistency_scores for select using (is_assigned_coach(client_id));

create policy "client crud own progress" on lesson_progress for all using (client_id = auth.uid());
create policy "coach reads assigned progress" on lesson_progress for select using (is_assigned_coach(client_id));

create policy "client reads own league" on league_status for select using (client_id = auth.uid());
create policy "coach reads assigned league" on league_status for select using (is_assigned_coach(client_id));

create policy "client reads own wallet" on iron_wallets for select using (client_id = auth.uid());
create policy "coach reads assigned wallet" on iron_wallets for select using (is_assigned_coach(client_id));
create policy "admin all wallets" on iron_wallets for all using (is_admin());

create policy "client own thread" on coach_messages for all using (client_id = auth.uid());
create policy "coach own thread" on coach_messages for all using (
  coach_id = auth.uid() and is_assigned_coach(client_id)
);

create policy "coach manages own notes" on coach_notes for all using (coach_id = auth.uid());
create policy "admin reads notes" on coach_notes for select using (is_admin());

create policy "coach reads assigned crisis alerts" on crisis_alerts for select using (is_assigned_coach(client_id));
create policy "admin all crisis alerts" on crisis_alerts for all using (is_admin());

create policy "client crud own trackers" on tracker_entries for all using (client_id = auth.uid());

create policy "authenticated read posts" on community_posts for select using (auth.role() = 'authenticated');
create policy "client writes own posts" on community_posts for insert with check (client_id = auth.uid());
create policy "client deletes own posts" on community_posts for delete using (client_id = auth.uid());
create policy "authenticated read reactions" on community_reactions for select using (auth.role() = 'authenticated');
create policy "client writes own reactions" on community_reactions for insert with check (client_id = auth.uid());
