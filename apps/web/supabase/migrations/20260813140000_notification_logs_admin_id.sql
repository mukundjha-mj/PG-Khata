-- Denormalize admin_id onto notification_logs so a per-owner monthly
-- WhatsApp-send count is a plain indexed query instead of a
-- tenant -> room -> property -> admin join on every quota check.
ALTER TABLE public.notification_logs
  ADD COLUMN admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;

UPDATE public.notification_logs nl
SET admin_id = p.admin_id
FROM public.tenants t
JOIN public.rooms r ON r.id = t.room_id
JOIN public.properties p ON p.id = r.property_id
WHERE nl.tenant_id = t.id
  AND nl.admin_id IS NULL;

CREATE INDEX notification_logs_admin_channel_sent_idx
  ON public.notification_logs (admin_id, channel, sent_at);
