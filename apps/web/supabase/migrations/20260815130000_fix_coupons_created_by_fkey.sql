-- coupons.created_by was pointed at public.admins(id), but coupons are only
-- ever created by a platform team member (see super-admin.functions.ts ->
-- assertPlatformAdmin), whose id lives in public.super_admins - never in
-- admins. handle_new_admin() only inserts a super admin's signup into
-- super_admins, and the seed step in 20260802163404_... explicitly deletes
-- any super admin row that had landed in admins. So created_by's own id is
-- never a valid admins.id, and every insert failed the foreign key check -
-- "Unable to create coupon" on every attempt.

ALTER TABLE public.coupons
  DROP CONSTRAINT coupons_created_by_fkey,
  ADD CONSTRAINT coupons_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.super_admins(id);
