-- Nightly subscription lifecycle sweep.
--
-- Renewals are not auto-charged: a Razorpay order is one-off, so every owner
-- pays each cycle by hand. Nothing moved plan_status off 'active' when that
-- stopped happening, so console MRR kept counting owners who had long since
-- stopped paying, and no report could tell a paying account from a dead one.
--
-- This job marks an account 'past_due' once its payment buffer (the grace days
-- after current_period_end) is fully spent. It never changes tier, touches
-- tenant data, or withholds access: an owner locked out mid-month cannot bill
-- their tenants, which costs them more than it collects for us.
--
-- Runs at 02:15 daily, clear of the 03:30 reminder run and the 06:00 monthly
-- billing run. Uses the same secret and base URL settings as those jobs:
--   ALTER DATABASE postgres SET app.cron_hook_base_url = 'https://<your-domain>';
--   ALTER DATABASE postgres SET app.cron_hook_secret   = '<CRON_HOOK_SECRET>';

SELECT cron.unschedule('plan-lifecycle')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'plan-lifecycle');

SELECT cron.schedule(
  'plan-lifecycle',
  '15 2 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.cron_hook_base_url') || '/api/public/hooks/plan-lifecycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_hook_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Reporting index: the sweep and the console both filter on billing state.
CREATE INDEX IF NOT EXISTS settings_plan_status_period_idx
  ON public.settings(plan_status, current_period_end);
