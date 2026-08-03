-- Drop duplicates, keeping the row with the most paid, then the oldest.
DELETE FROM public.bills b
USING public.bills keep
WHERE b.tenant_id = keep.tenant_id
  AND b.bill_month = keep.bill_month
  AND b.id <> keep.id
  AND (keep.paid_amount, -EXTRACT(EPOCH FROM keep.created_at)) > (b.paid_amount, -EXTRACT(EPOCH FROM b.created_at));

CREATE UNIQUE INDEX IF NOT EXISTS bills_tenant_month_unique
  ON public.bills (tenant_id, bill_month);