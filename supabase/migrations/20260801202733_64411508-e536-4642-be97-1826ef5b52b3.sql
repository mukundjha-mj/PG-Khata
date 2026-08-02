DROP EXTENSION pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('generate-monthly-bills')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-bills');

SELECT cron.schedule(
  'generate-monthly-bills',
  '0 6 1 * *',
  $$
  SELECT extensions.http_post(
    url := 'https://basera.app/api/public/hooks/generate-bills',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_ZuBwZ0dGleq9eCE0WZtT3g_Wclo4yB-"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
