-- Owner-created, per-tenant reminders that are either sent instantly or
-- scheduled for a future calendar date the owner picks (not tied to the
-- bill's due date). Distinct from the automated due-date reminder engine in
-- reminders.server.ts, which stays untouched.

CREATE TABLE public.scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.admins(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  remind_on DATE NOT NULL,
  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_whatsapp BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX scheduled_reminders_due_idx ON public.scheduled_reminders (remind_on)
  WHERE status = 'pending';

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_reminders_own" ON public.scheduled_reminders FOR ALL TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());
