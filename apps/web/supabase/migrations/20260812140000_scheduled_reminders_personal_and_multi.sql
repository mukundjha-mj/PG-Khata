-- Allows a scheduled_reminders row to stand alone as a personal note-to-self
-- (no tenant, no channel), for the owner's own follow-up reminders that
-- never message anyone. Tenant-linked rows are unaffected.

ALTER TABLE public.scheduled_reminders ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.scheduled_reminders ADD COLUMN note TEXT;
ALTER TABLE public.scheduled_reminders ADD CONSTRAINT scheduled_reminders_tenant_or_note
  CHECK (tenant_id IS NOT NULL OR note IS NOT NULL);
