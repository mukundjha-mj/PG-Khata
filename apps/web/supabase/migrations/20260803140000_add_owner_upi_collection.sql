-- Direct UPI collection.
--
-- Rent is collected tenant -> owner with no intermediary: the app only builds
-- the UPI intent string that the tenant's own app opens. Money never touches
-- the platform, which is what keeps this outside RBI payment-aggregator
-- territory, and standard UPI P2M carries no MDR, so this costs both sides
-- nothing.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS upi_vpa text,
  ADD COLUMN IF NOT EXISTS upi_payee_name text;

-- A VPA is `handle@psp`. Deliberately permissive on the handle (NPCI leaves it
-- to each PSP) but strict about the shape, because a malformed VPA silently
-- produces a QR that opens to an "invalid UPI ID" error on the tenant's phone.
ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_upi_vpa_format;
ALTER TABLE public.settings
  ADD CONSTRAINT settings_upi_vpa_format
  CHECK (upi_vpa IS NULL OR upi_vpa ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$');

COMMENT ON COLUMN public.settings.upi_vpa IS
  'Owner UPI address for direct rent collection. Payments settle to the owner, never to the platform.';
COMMENT ON COLUMN public.settings.upi_payee_name IS
  'Name shown in the tenant UPI app. Falls back to brand_name when null.';
