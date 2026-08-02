CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.owns_property(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = _property_id AND p.admin_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.owns_room(_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r JOIN public.properties p ON p.id = r.property_id
    WHERE r.id = _room_id AND p.admin_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.owns_tenant(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.rooms r ON r.id = t.room_id
    JOIN public.properties p ON p.id = r.property_id
    WHERE t.id = _tenant_id AND p.admin_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.owns_bill(_bill_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bills b JOIN public.properties p ON p.id = b.property_id
    WHERE b.id = _bill_id AND p.admin_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION private.owns_property(uuid), private.owns_room(uuid), private.owns_tenant(uuid), private.owns_bill(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.owns_property(uuid), private.owns_room(uuid), private.owns_tenant(uuid), private.owns_bill(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS bills_own ON public.bills;
CREATE POLICY bills_own ON public.bills FOR ALL TO authenticated
  USING (private.owns_property(property_id)) WITH CHECK (private.owns_property(property_id));

DROP POLICY IF EXISTS rooms_own ON public.rooms;
CREATE POLICY rooms_own ON public.rooms FOR ALL TO authenticated
  USING (private.owns_property(property_id)) WITH CHECK (private.owns_property(property_id));

DROP POLICY IF EXISTS tenants_own ON public.tenants;
CREATE POLICY tenants_own ON public.tenants FOR ALL TO authenticated
  USING (private.owns_room(room_id)) WITH CHECK (private.owns_room(room_id));

DROP POLICY IF EXISTS electricity_readings_own ON public.electricity_readings;
CREATE POLICY electricity_readings_own ON public.electricity_readings FOR ALL TO authenticated
  USING (private.owns_room(room_id)) WITH CHECK (private.owns_room(room_id));

DROP POLICY IF EXISTS notification_logs_own ON public.notification_logs;
CREATE POLICY notification_logs_own ON public.notification_logs FOR ALL TO authenticated
  USING (private.owns_tenant(tenant_id)) WITH CHECK (private.owns_tenant(tenant_id));

DROP POLICY IF EXISTS payments_own ON public.payments;
CREATE POLICY payments_own ON public.payments FOR ALL TO authenticated
  USING (private.owns_bill(bill_id)) WITH CHECK (private.owns_bill(bill_id));

DROP FUNCTION IF EXISTS public.owns_property(uuid);
DROP FUNCTION IF EXISTS public.owns_room(uuid);
DROP FUNCTION IF EXISTS public.owns_tenant(uuid);
DROP FUNCTION IF EXISTS public.owns_bill(uuid);
DROP FUNCTION IF EXISTS public.admin_exists();

REVOKE ALL ON FUNCTION public.handle_new_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
