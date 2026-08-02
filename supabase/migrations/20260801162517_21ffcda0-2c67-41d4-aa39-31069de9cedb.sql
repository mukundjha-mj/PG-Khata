REVOKE EXECUTE ON FUNCTION public.owns_property(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_room(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_tenant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_bill(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;