-- Removes the automatic free trial: a fresh signup used to get plan_status
-- 'trial' with a 30-day period_end (handle_new_admin -> settings defaults),
-- while marketing copy separately promised 14 days - the two never agreed.
-- New accounts now land already due for payment ('unpaid', period_end today)
-- and are redirected to /plan by _authenticated/route.tsx until they pay or
-- redeem a coupon. 'trial' is no longer a signup default: it is set only by
-- redeem_coupon() (see the coupons migration) for accounts that redeem a
-- code, so it keeps its existing grace-buffer behaviour in plan-period.ts.
ALTER TABLE public.settings
  ALTER COLUMN plan_status SET DEFAULT 'unpaid',
  ALTER COLUMN current_period_end SET DEFAULT CURRENT_DATE;

-- Existing accounts already on 'trial' or mid-cycle are untouched: this only
-- changes the default applied to rows inserted from now on.
