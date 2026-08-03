ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

UPDATE public.bills SET approved = true, approved_at = COALESCE(approved_at, created_at) WHERE approved_at IS NULL;

CREATE INDEX IF NOT EXISTS bills_approved_idx ON public.bills (approved) WHERE approved = false;