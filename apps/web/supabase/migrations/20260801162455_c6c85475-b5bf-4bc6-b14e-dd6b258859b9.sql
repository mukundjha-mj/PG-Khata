-- Enums
CREATE TYPE public.room_type AS ENUM ('single','double','triple','dormitory');
CREATE TYPE public.tenant_status AS ENUM ('active','vacated','notice-period');
CREATE TYPE public.bill_status AS ENUM ('pending','paid','partially-paid','overdue');
CREATE TYPE public.payment_method AS ENUM ('UPI','cash','bank-transfer','other');
CREATE TYPE public.notification_channel AS ENUM ('whatsapp','sms');
CREATE TYPE public.notification_status AS ENUM ('sent','delivered','failed','read');
CREATE TYPE public.message_type AS ENUM ('bill-generated','payment-reminder','payment-confirmation','welcome-message','custom');
CREATE TYPE public.address_proof_type AS ENUM ('Aadhaar','Passport','Driving License','Voter ID');

-- Shared updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- admins
CREATE TABLE public.admins (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_own" ON public.admins FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- properties
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.admins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  electricity_mode TEXT NOT NULL DEFAULT 'flat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "properties_own" ON public.properties FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE TRIGGER properties_updated BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ownership helper
CREATE OR REPLACE FUNCTION public.owns_property(_property_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = _property_id AND p.admin_id = auth.uid());
$$;

-- rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_size TEXT,
  room_type public.room_type NOT NULL DEFAULT 'single',
  monthly_rent NUMERIC(10,2) NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, room_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_own" ON public.rooms FOR ALL TO authenticated
  USING (public.owns_property(property_id)) WITH CHECK (public.owns_property(property_id));
CREATE TRIGGER rooms_updated BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.owns_room(_room_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r JOIN public.properties p ON p.id = r.property_id
    WHERE r.id = _room_id AND p.admin_id = auth.uid());
$$;

-- tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  alternate_phone TEXT,
  email TEXT,
  address_proof_type public.address_proof_type,
  address_proof_file_url TEXT,
  photo_url TEXT,
  permanent_address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  security_deposit NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_rent_override NUMERIC(10,2),
  status public.tenant_status NOT NULL DEFAULT 'active',
  vacated_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_own" ON public.tenants FOR ALL TO authenticated
  USING (public.owns_room(room_id)) WITH CHECK (public.owns_room(room_id));
CREATE TRIGGER tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tenants_room_idx ON public.tenants(room_id);

CREATE OR REPLACE FUNCTION public.owns_tenant(_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.rooms r ON r.id = t.room_id
    JOIN public.properties p ON p.id = r.property_id
    WHERE t.id = _tenant_id AND p.admin_id = auth.uid());
$$;

-- bills
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  bill_month TEXT NOT NULL,
  billing_cycle_start DATE,
  billing_cycle_end DATE,
  rent_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  electricity_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  electricity_units_consumed NUMERIC(10,2),
  other_charges JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status public.bill_status NOT NULL DEFAULT 'pending',
  payment_link_url TEXT,
  upi_qr_code_url TEXT,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bill_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills_own" ON public.bills FOR ALL TO authenticated
  USING (public.owns_property(property_id)) WITH CHECK (public.owns_property(property_id));
CREATE TRIGGER bills_updated BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'UPI',
  transaction_ref TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.owns_bill(_bill_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bills b JOIN public.properties p ON p.id = b.property_id
    WHERE b.id = _bill_id AND p.admin_id = auth.uid());
$$;
CREATE POLICY "payments_own" ON public.payments FOR ALL TO authenticated
  USING (public.owns_bill(bill_id)) WITH CHECK (public.owns_bill(bill_id));

-- notification_logs
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  channel public.notification_channel NOT NULL DEFAULT 'whatsapp',
  message_type public.message_type NOT NULL DEFAULT 'custom',
  status public.notification_status NOT NULL DEFAULT 'sent',
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_logs_own" ON public.notification_logs FOR ALL TO authenticated
  USING (public.owns_tenant(tenant_id)) WITH CHECK (public.owns_tenant(tenant_id));

-- electricity_readings
CREATE TABLE public.electricity_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meter_reading NUMERIC(12,2) NOT NULL,
  units_consumed_since_previous NUMERIC(12,2),
  rate_per_unit NUMERIC(10,2),
  calculated_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electricity_readings TO authenticated;
GRANT ALL ON public.electricity_readings TO service_role;
ALTER TABLE public.electricity_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "electricity_readings_own" ON public.electricity_readings FOR ALL TO authenticated
  USING (public.owns_room(room_id)) WITH CHECK (public.owns_room(room_id));

-- notification_templates
CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.admins(id) ON DELETE CASCADE,
  message_type public.message_type NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'whatsapp',
  template_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_id, message_type, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_templates_own" ON public.notification_templates FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE TRIGGER notification_templates_updated BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- settings
CREATE TABLE public.settings (
  admin_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES public.admins(id) ON DELETE CASCADE,
  electricity_rate_per_unit NUMERIC(10,2) NOT NULL DEFAULT 8,
  due_date_offset_days INTEGER NOT NULL DEFAULT 10,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  remind_on_due_date BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'INR',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_own" ON public.settings FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create admin profile + settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admins (id, name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''), COALESCE(NEW.email,''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.settings (admin_id) VALUES (NEW.id) ON CONFLICT (admin_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_admin_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin();