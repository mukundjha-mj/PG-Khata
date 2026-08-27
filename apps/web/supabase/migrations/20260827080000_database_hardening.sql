-- Database hardening after the free-plan and WhatsApp quota migrations.
-- Keeps existing RLS policies unchanged: all public tables already have RLS enabled.

-- These indexes duplicate existing unique constraints and add write overhead.
DROP INDEX IF EXISTS public.bills_tenant_month_unique;
DROP INDEX IF EXISTS public.coupons_code_idx;

-- Keep every stored coupon code canonical so indexed lookups are reliable.
UPDATE public.coupons
SET code = upper(btrim(code))
WHERE code IS DISTINCT FROM upper(btrim(code));

CREATE OR REPLACE FUNCTION public.normalize_coupon_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coupons_normalize_code ON public.coupons;
CREATE TRIGGER coupons_normalize_code
BEFORE INSERT OR UPDATE OF code ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.normalize_coupon_code();

-- Coupon redemption is server-enforced: only unpaid owners may redeem, and
-- a row lock prevents concurrent redemptions from exceeding the coupon limit.
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_plan_status text;
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF _code IS NULL OR btrim(_code) = '' THEN
    RAISE EXCEPTION 'Enter a coupon code';
  END IF;

  -- Serialize a caller's redemption attempts and protect the unpaid-only rule.
  SELECT plan_status
  INTO v_plan_status
  FROM public.settings
  WHERE admin_id = v_admin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account settings were not found';
  END IF;

  IF v_plan_status IS DISTINCT FROM 'unpaid' THEN
    RAISE EXCEPTION 'Coupons can only be redeemed by unpaid accounts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coupon_redemptions
    WHERE admin_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'This account has already redeemed a coupon';
  END IF;

  -- Serializes competing owners against the same coupon capacity.
  SELECT *
  INTO v_coupon
  FROM public.coupons
  WHERE code = upper(btrim(_code))
  FOR UPDATE;

  IF v_coupon IS NULL THEN
    RAISE EXCEPTION 'That coupon code was not found';
  END IF;
  IF NOT v_coupon.active THEN
    RAISE EXCEPTION 'That coupon is no longer active';
  END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'That coupon has expired';
  END IF;
  IF v_coupon.max_redemptions IS NOT NULL
    AND v_coupon.redeemed_count >= v_coupon.max_redemptions THEN
    RAISE EXCEPTION 'That coupon has already been fully redeemed';
  END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, admin_id)
  VALUES (v_coupon.id, v_admin_id);

  UPDATE public.coupons
  SET redeemed_count = redeemed_count + 1
  WHERE id = v_coupon.id;

  UPDATE public.settings
  SET
    plan = v_coupon.plan_scope,
    plan_status = 'trial',
    pending_plan = NULL,
    current_period_start = CURRENT_DATE,
    current_period_end = (CURRENT_DATE + (v_coupon.trial_days || ' days')::interval)::date,
    plan_updated_at = now()
  WHERE admin_id = v_admin_id;

  RETURN jsonb_build_object(
    'ok', true,
    'plan', v_coupon.plan_scope,
    'trial_days', v_coupon.trial_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated;
