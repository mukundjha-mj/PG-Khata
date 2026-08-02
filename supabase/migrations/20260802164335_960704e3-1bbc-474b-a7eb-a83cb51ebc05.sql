CREATE TABLE public.owner_support_notes (
  admin_id uuid PRIMARY KEY REFERENCES public.admins(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_by_email text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.owner_support_notes TO service_role;

ALTER TABLE public.owner_support_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_notes_read_platform" ON public.owner_support_notes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins s WHERE s.id = auth.uid() AND s.disabled = false));

CREATE TRIGGER update_owner_support_notes_updated_at
  BEFORE UPDATE ON public.owner_support_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();