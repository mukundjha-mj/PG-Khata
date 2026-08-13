-- settings_upi_vpa_format used {2,256} for the handle length, but Postgres's
-- regex engine caps repetition counts at RE_DUP_MAX (255 by default). Every
-- save with a non-null upi_vpa has been failing with "invalid regular
-- expression: invalid repetition count(s)" since this constraint landed.
-- No real VPA is anywhere near 255 chars, so this loses nothing.
ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_upi_vpa_format;
ALTER TABLE public.settings
  ADD CONSTRAINT settings_upi_vpa_format
  CHECK (upi_vpa IS NULL OR upi_vpa ~ '^[a-zA-Z0-9.\-_]{2,255}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$');
