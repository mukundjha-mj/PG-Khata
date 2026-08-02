ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS brand_name text NOT NULL DEFAULT 'PG Manager',
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text NOT NULL DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system';