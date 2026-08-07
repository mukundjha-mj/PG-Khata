-- Signup trigger: accept an OAuth display name, and stop granting platform
-- access from a hardcoded address.
--
-- Two changes, both in the body of public.handle_new_admin(). The trigger
-- itself (on_auth_admin_created, AFTER INSERT ON auth.users) is unchanged, so
-- only the function is replaced.
--
-- 1. Read a display name from either metadata key.
--
--    The function read only `name`, which is what the app's own sign-up form
--    sends. Google's OIDC payload carries the display name under `full_name`,
--    so a Google signup produced an owner whose name was the empty string —
--    `admins.name` is NOT NULL DEFAULT '', so it stored blank rather than
--    failing, and the app then showed an unnamed owner. Read both keys, app
--    form first.
--
-- 2. Drop the hardcoded super-admin grant.
--
--    The previous body granted platform (super admin) access to one literal
--    email address, in SQL, in a public repository. Anyone able to register
--    that address at any point would have received the most privileged account
--    in the system.
--
--    Removing it locks nobody out: public.super_admins was empty when this was
--    written, so the branch had never fired on this project. Platform access is
--    now an explicit, deliberate insert, run by hand and not recorded in git:
--
--      INSERT INTO public.super_admins (id, email, name)
--      SELECT id, email, 'Platform admin' FROM auth.users WHERE email = '...';
--
--    A consequence worth stating: without the early RETURN that branch
--    performed, an account later promoted to platform admin also keeps the
--    owner rows created here. That is harmless — the _authenticated route guard
--    checks super_admins and redirects such accounts to /console — but the rows
--    do exist.

CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admins (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      ''
    ),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.settings (admin_id) VALUES (NEW.id) ON CONFLICT (admin_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- The trigger runs as the definer; nothing else may call this directly.
REVOKE ALL ON FUNCTION public.handle_new_admin() FROM PUBLIC, anon, authenticated;
