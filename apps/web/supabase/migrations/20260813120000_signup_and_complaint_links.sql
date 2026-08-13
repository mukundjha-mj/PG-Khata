-- Shareable, no-login links per property: one for tenant self-signup, one for
-- tenant complaints. Public callers never read these tables directly (no
-- policy grants anon anything here) - the public routes resolve a token
-- through the service-role client, so an unauthenticated caller can only ever
-- learn what a valid, active token's own handler chooses to reveal.

CREATE TYPE public.complaint_status AS ENUM ('open', 'in-progress', 'resolved');

-- property_signup_links
CREATE TABLE public.property_signup_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.admins(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_signup_links TO authenticated;
GRANT ALL ON public.property_signup_links TO service_role;
ALTER TABLE public.property_signup_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signup_links_own" ON public.property_signup_links FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE TRIGGER signup_links_updated BEFORE UPDATE ON public.property_signup_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- property_complaint_links
CREATE TABLE public.property_complaint_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.admins(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_complaint_links TO authenticated;
GRANT ALL ON public.property_complaint_links TO service_role;
ALTER TABLE public.property_complaint_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaint_links_own" ON public.property_complaint_links FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
CREATE TRIGGER complaint_links_updated BEFORE UPDATE ON public.property_complaint_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- complaints
-- room_number is free text, not a FK into rooms: resolving it against the
-- real room list on the public complaint page would require exposing
-- occupancy/rent data to an anonymous visitor. The owner reconciles it by eye.
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  note TEXT NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints_own" ON public.complaints FOR ALL TO authenticated
  USING (private.owns_property(property_id)) WITH CHECK (private.owns_property(property_id));
CREATE TRIGGER complaints_updated BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX complaints_property_idx ON public.complaints(property_id);
