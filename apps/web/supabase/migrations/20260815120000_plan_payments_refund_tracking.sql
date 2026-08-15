-- Refund tracking for the super admin console's refund action. Nothing in
-- the app has ever called Razorpay's refund API before this - plan_payments
-- had no way to record that a payment was partially or fully refunded.

ALTER TABLE public.plan_payments
  ADD COLUMN refunded_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN refunded_at timestamptz,
  ADD COLUMN refund_reference text;
