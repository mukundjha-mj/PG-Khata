-- Closes a self-service plan escalation hole: "settings_own" RLS only checks
-- row ownership, not which columns change, so any signed-in owner could run
-- `supabase.from('settings').update({ plan: 'scale' })` from devtools and grant
-- themselves a paid tier for free. Every legitimate write to these columns
-- already goes through the service-role client (plan.functions.ts,
-- plan-apply.server.ts, super-admin.server.ts), so the `authenticated` role
-- never needs to write them directly.
REVOKE UPDATE (
  plan,
  plan_status,
  pending_plan,
  current_period_start,
  current_period_end,
  billing_cycle,
  last_payment_amount,
  last_payment_at,
  plan_updated_at
) ON public.settings FROM authenticated;
