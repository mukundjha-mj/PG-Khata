-- WhatsApp via the official Meta Cloud API.
--
-- The earlier columns (whatsapp_api_url, whatsapp_session) were shaped for a
-- self-hosted bridge driving a personal WhatsApp account. That violates
-- WhatsApp's terms and gets numbers banned, so it is not built; those columns
-- are dropped rather than left to imply a feature that does not exist.
--
-- Credentials are NOT stored here. The access token and phone number id are
-- process environment values, because a token in a database row is one SQL
-- injection or one careless SELECT away from letting somebody message every
-- tenant on the platform.

ALTER TABLE public.settings
  DROP COLUMN IF EXISTS whatsapp_api_url,
  DROP COLUMN IF EXISTS whatsapp_session;

-- whatsapp_enabled and whatsapp_country_code already exist and are reused.
COMMENT ON COLUMN public.settings.whatsapp_enabled IS
  'Send reminders over WhatsApp in addition to email. Requires the platform Meta Cloud API credentials.';
COMMENT ON COLUMN public.settings.whatsapp_country_code IS
  'Dial code prefixed to tenant phone numbers stored without one, e.g. 91.';
