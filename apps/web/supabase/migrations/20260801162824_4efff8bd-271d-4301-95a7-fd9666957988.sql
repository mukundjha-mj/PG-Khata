CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins);
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;