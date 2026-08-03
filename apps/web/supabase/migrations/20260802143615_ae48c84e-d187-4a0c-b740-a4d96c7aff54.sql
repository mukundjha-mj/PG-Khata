ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS current_period_start date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS current_period_end date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date,
  ADD COLUMN IF NOT EXISTS pending_plan text,
  ADD COLUMN IF NOT EXISTS last_payment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.plan_change_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.admins(id) ON DELETE CASCADE,
  from_plan text NOT NULL,
  to_plan text NOT NULL,
  direction text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  credit_applied numeric NOT NULL DEFAULT 0,
  days_remaining integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  payment_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.plan_change_history TO authenticated;
GRANT ALL ON public.plan_change_history TO service_role;
ALTER TABLE public.plan_change_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_change_history_own" ON public.plan_change_history
  FOR ALL TO authenticated USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.plan_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  target_plan text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  provider text NOT NULL DEFAULT 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'created',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_payments TO authenticated;
GRANT ALL ON public.plan_payments TO service_role;
ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_payments_select_own" ON public.plan_payments
  FOR SELECT TO authenticated USING (admin_id = auth.uid());

CREATE INDEX IF NOT EXISTS plan_payments_admin_idx ON public.plan_payments(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS plan_change_history_admin_idx ON public.plan_change_history(admin_id, created_at DESC);

CREATE TRIGGER update_plan_payments_updated_at BEFORE UPDATE ON public.plan_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();