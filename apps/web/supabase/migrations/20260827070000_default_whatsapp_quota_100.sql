-- Raise the default WhatsApp allowance for future owners to 100 messages.
-- Existing per-owner values are retained because they may be custom allowances.

ALTER TABLE public.settings
  ALTER COLUMN whatsapp_monthly_limit SET DEFAULT 100;

INSERT INTO public.platform_config (key, value)
VALUES ('default_whatsapp_quota', '100')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_quota INTEGER := 100;
BEGIN
  -- Platform team accounts are not PG owners.
  IF lower(COALESCE(NEW.email,'')) = 'platform-admin@example.com' THEN
    INSERT INTO public.super_admins (id, email, name)
    VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'name','Platform admin'))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Read the platform default, falling back to 100 if it is unavailable.
  SELECT value::integer INTO v_default_quota
  FROM public.platform_config
  WHERE key = 'default_whatsapp_quota';
  IF v_default_quota IS NULL THEN
    v_default_quota := 100;
  END IF;

  INSERT INTO public.admins (id, name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''), COALESCE(NEW.email,''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.settings (admin_id, whatsapp_monthly_limit)
  VALUES (NEW.id, v_default_quota)
  ON CONFLICT (admin_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;
