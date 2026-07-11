create extension if not exists pg_cron;

select cron.schedule(
  'nightly-consistency', '0 2 * * *',
  $$ select net.http_post(
    url := '<project-url>/functions/v1/calculate-consistency',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  ); $$
);

select cron.schedule(
  'daily-notifications', '0 7 * * *',
  $$ select net.http_post(
    url := '<project-url>/functions/v1/generate-daily-notifications',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  ); $$
);
