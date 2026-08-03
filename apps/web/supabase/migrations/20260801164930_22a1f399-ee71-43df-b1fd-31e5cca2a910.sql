ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_api_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_session text NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS whatsapp_country_code text NOT NULL DEFAULT '91';