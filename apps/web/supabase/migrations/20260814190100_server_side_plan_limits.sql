-- Server-side enforcement of the same property/room/tenant caps `plan-limits.ts`
-- already checks in the browser. The UI check only guards the "add" dialog,
-- so a direct `supabase.from(...).insert(...)` call (e.g. from devtools) could
-- add properties/rooms/tenants past a plan's limit with no server check at
-- all. These triggers close that gap. Limits mirror
-- apps/web/src/lib/pricing-plans.ts `planTiers` - keep both in sync if the
-- numbers change.

CREATE OR REPLACE FUNCTION public.check_property_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan text;
  v_max integer;
  v_count integer;
BEGIN
  SELECT plan INTO v_plan FROM public.settings WHERE admin_id = NEW.admin_id;
  v_max := CASE COALESCE(v_plan, 'starter')
    WHEN 'starter' THEN 1
    WHEN 'growing' THEN 5
    WHEN 'scale' THEN 15
    ELSE NULL
  END;
  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.properties WHERE admin_id = NEW.admin_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Your plan includes up to % properties. Upgrade to add more.', v_max;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER properties_limit_check BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.check_property_limit();

CREATE OR REPLACE FUNCTION public.check_room_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_id uuid;
  v_plan text;
  v_max integer;
  v_count integer;
BEGIN
  SELECT admin_id INTO v_admin_id FROM public.properties WHERE id = NEW.property_id;
  SELECT plan INTO v_plan FROM public.settings WHERE admin_id = v_admin_id;
  v_max := CASE COALESCE(v_plan, 'starter')
    WHEN 'starter' THEN 15
    WHEN 'growing' THEN 40
    WHEN 'scale' THEN 200
    ELSE NULL
  END;
  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_count
      FROM public.rooms r JOIN public.properties p ON p.id = r.property_id
      WHERE p.admin_id = v_admin_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Your plan includes up to % rooms across all your properties. Upgrade to add more.', v_max;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rooms_limit_check BEFORE INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.check_room_limit();

-- Starter has no flat tenant cap: a room can be single/double/triple/4-bed,
-- so the cap is the sum of `capacity` across every room this admin owns.
-- Growing and Scale stay unlimited.
CREATE OR REPLACE FUNCTION public.check_tenant_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_id uuid;
  v_plan text;
  v_capacity integer;
  v_count integer;
BEGIN
  SELECT p.admin_id INTO v_admin_id
    FROM public.rooms r JOIN public.properties p ON p.id = r.property_id
    WHERE r.id = NEW.room_id;
  SELECT plan INTO v_plan FROM public.settings WHERE admin_id = v_admin_id;
  IF COALESCE(v_plan, 'starter') = 'starter' THEN
    SELECT COALESCE(sum(r.capacity), 0) INTO v_capacity
      FROM public.rooms r JOIN public.properties p ON p.id = r.property_id
      WHERE p.admin_id = v_admin_id;
    SELECT count(*) INTO v_count
      FROM public.tenants t
      JOIN public.rooms r ON r.id = t.room_id
      JOIN public.properties p ON p.id = r.property_id
      WHERE p.admin_id = v_admin_id AND t.status = 'active';
    IF v_count >= v_capacity THEN
      RAISE EXCEPTION 'Starter plan is limited to your total room capacity (%). Add rooms or upgrade to add more tenants.', v_capacity;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_limit_check BEFORE INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.check_tenant_limit();
