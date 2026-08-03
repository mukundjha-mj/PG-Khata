CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('generate-monthly-bills')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-bills');

-- NOTE: this job is superseded by 20260803120000, which sends x-cron-secret
-- (the header the hook actually requires) and reads the URL and secret from
-- database settings. The credential that was inlined here has been redacted;
-- see that migration for the ALTER DATABASE settings it needs.
SELECT cron.schedule(
  'generate-monthly-bills',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://basera.app/api/public/hooks/generate-bills',
    headers := '{"Content-Type": "application/json", "apikey": "REDACTED_ROTATED_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
