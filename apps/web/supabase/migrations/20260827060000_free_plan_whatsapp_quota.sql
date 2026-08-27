-- Migration: Free product with super-admin-managed WhatsApp quota
--
-- This migration:
-- 1. Adds per-owner WhatsApp quota columns to settings.
-- 2. Creates platform_config for global defaults (service-role only).
-- 3. Drops plan-limit triggers (everything is now unlimited).
-- 4. Updates handle_new_admin to seed the quota from platform_config.

-- ============================================================================
-- 1. Per-owner WhatsApp quota on settings
-- ============================================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS whatsapp_monthly_limit INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS whatsapp_unlimited BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 2. Platform configuration table (service-role only, no authenticated access)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the service role may read/write platform config.
GRANT ALL ON public.platform_config TO service_role;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
-- No policy for authenticated: RLS enabled with zero permissive policies = deny all.

-- Seed the global default WhatsApp quota.
INSERT INTO public.platform_config (key, value)
VALUES ('default_whatsapp_quota', '50')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 3. Drop plan-limit triggers and functions (everything is unlimited now)
-- ============================================================================

DROP TRIGGER IF EXISTS properties_limit_check ON public.properties;
DROP TRIGGER IF EXISTS rooms_limit_check ON public.rooms;
DROP TRIGGER IF EXISTS tenants_limit_check ON public.tenants;

DROP FUNCTION IF EXISTS public.check_property_limit();
DROP FUNCTION IF EXISTS public.check_room_limit();
DROP FUNCTION IF EXISTS public.check_tenant_limit();

-- ============================================================================
-- 4. Update signup trigger to read global default quota for new owners
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_quota INTEGER := 50;
BEGIN
  -- Platform team accounts are not PG owners.
  IF lower(COALESCE(NEW.email,'')) = 'platform-admin@example.com' THEN
    INSERT INTO public.super_admins (id, email, name)
    VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'name','Platform admin'))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Read the current global default quota. Fall back to 50 if missing.
  SELECT value::integer INTO v_default_quota
  FROM public.platform_config
  WHERE key = 'default_whatsapp_quota';
  IF v_default_quota IS NULL THEN
    v_default_quota := 50;
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
