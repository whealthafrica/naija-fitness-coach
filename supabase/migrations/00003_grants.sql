grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on
  profiles,
  client_profiles,
  coach_profiles,
  daily_missions,
  check_ins,
  consistency_scores,
  lesson_progress,
  league_status,
  iron_wallets,
  iron_points_ledger,
  coach_messages,
  coach_notes,
  crisis_alerts,
  tracker_entries,
  community_posts,
  community_reactions
to authenticated;

grant select on lessons to authenticated;
