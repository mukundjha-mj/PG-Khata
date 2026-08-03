ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_plan_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_plan_check CHECK (plan IN ('starter','growing','scale'));