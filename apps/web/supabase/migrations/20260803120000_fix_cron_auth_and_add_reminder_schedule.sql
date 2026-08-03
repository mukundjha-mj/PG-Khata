-- Fix the scheduled monthly billing job.
--
-- The previous schedule sent an "apikey" header, which the hook route does not
-- accept (it requires x-cron-secret or Bearer CRON_HOOK_SECRET), so every run
-- since deployment returned 401 and no bills were ever generated.
--
-- Both the target URL and the shared secret now come from database settings
-- instead of being hardcoded, so no credential lives in committed SQL.
--
-- Before applying, set these once as a superuser (values are NOT stored here):
--   ALTER DATABASE postgres SET app.cron_hook_base_url = 'https://<your-domain>';
--   ALTER DATABASE postgres SET app.cron_hook_secret   = '<CRON_HOOK_SECRET>';
-- Then reconnect so the new settings are visible to the cron session.

SELECT cron.unschedule('generate-monthly-bills')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-bills');

SELECT cron.schedule(
  'generate-monthly-bills',
  '0 6 1 * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.cron_hook_base_url') || '/api/public/hooks/generate-bills',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_hook_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Daily payment reminders. No schedule for this hook existed before, so the
-- reminder engine was unreachable despite being advertised as scheduled.
SELECT cron.unschedule('send-payment-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-payment-reminders');

SELECT cron.schedule(
  'send-payment-reminders',
  '30 3 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.cron_hook_base_url') || '/api/public/hooks/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_hook_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
