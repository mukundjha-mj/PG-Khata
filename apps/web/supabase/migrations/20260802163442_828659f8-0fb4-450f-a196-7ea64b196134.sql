DROP POLICY "audit_log_read_super_admin" ON public.super_admin_audit_log;
DROP POLICY "login_attempts_read_super_admin" ON public.super_admin_login_attempts;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM authenticated;

CREATE POLICY "audit_log_read_super_admin" ON public.super_admin_audit_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins s WHERE s.id = auth.uid() AND s.disabled = false));

CREATE POLICY "login_attempts_read_super_admin" ON public.super_admin_login_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins s WHERE s.id = auth.uid() AND s.disabled = false));