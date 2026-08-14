-- Adds a billing cadence concept alongside the existing monthly-only cycle.
-- Default 'monthly' on every table means every existing row is unaffected -
-- current subscribers keep behaving exactly as they do today.
ALTER TABLE public.settings
  ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly'
    CONSTRAINT settings_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'annual'));

ALTER TABLE public.plan_payments
  ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly'
    CONSTRAINT plan_payments_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'annual'));

ALTER TABLE public.plan_change_history
  ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly'
    CONSTRAINT plan_change_history_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'annual'));
