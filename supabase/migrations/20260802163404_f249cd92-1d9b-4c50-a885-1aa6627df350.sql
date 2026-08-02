-- 1. Platform team accounts, separate from PG owner `admins`
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE id = _user_id AND disabled = false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

CREATE POLICY "super_admins_read_self" ON public.super_admins
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE TRIGGER update_super_admins_updated_at
  BEFORE UPDATE ON public.super_admins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Append-only audit log
CREATE TABLE public.super_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  target_admin_id uuid,
  target_label text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX super_admin_audit_log_created_idx ON public.super_admin_audit_log (created_at DESC);
CREATE INDEX super_admin_audit_log_target_idx ON public.super_admin_audit_log (target_admin_id);
-- read-only for the team; writes happen through trusted server code only
GRANT SELECT ON public.super_admin_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.super_admin_audit_log TO service_role;
ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_read_super_admin" ON public.super_admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'super_admin_audit_log is append-only';
END; $$;
REVOKE EXECUTE ON FUNCTION public.block_audit_log_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER super_admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.super_admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

-- 3. Failed platform login tracking
CREATE TABLE public.super_admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL DEFAULT '',
  succeeded boolean NOT NULL DEFAULT false,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX super_admin_login_attempts_email_idx
  ON public.super_admin_login_attempts (lower(email), created_at DESC);
GRANT SELECT ON public.super_admin_login_attempts TO authenticated;
GRANT ALL ON public.super_admin_login_attempts TO service_role;
ALTER TABLE public.super_admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_attempts_read_super_admin" ON public.super_admin_login_attempts
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 4. Seed the platform account and strip its PG owner workspace
INSERT INTO public.super_admins (id, email, name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'name', 'Platform admin')
FROM auth.users u
WHERE lower(u.email) = 'mukundjha204+admin@gmail.com'
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.settings s
WHERE s.admin_id IN (SELECT id FROM public.super_admins);
DELETE FROM public.user_roles r
WHERE r.user_id IN (SELECT id FROM public.super_admins);
DELETE FROM public.admins a
WHERE a.id IN (SELECT id FROM public.super_admins);

-- 5. Signup trigger: platform emails become platform accounts, never PG owners
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.email,'')) = 'mukundjha204+admin@gmail.com' THEN
    INSERT INTO public.super_admins (id, email, name)
    VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'name','Platform admin'))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.admins (id, name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''), COALESCE(NEW.email,''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.settings (admin_id) VALUES (NEW.id) ON CONFLICT (admin_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;