import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Ticket, Ban } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { createCoupon, deactivateCoupon, listCoupons } from "@/lib/super-admin.functions";

const day = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "-";

/** Super-admin-only: generate and manage Starter-scoped trial coupon codes. */
export function CouponManager() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCoupons);
  const createFn = useServerFn(createCoupon);
  const deactivateFn = useServerFn(deactivateCoupon);

  const [open, setOpen] = useState(false);
  const [trialDays, setTrialDays] = useState("14");
  const [maxRedemptions, setMaxRedemptions] = useState("");

  const coupons = useQuery({
    queryKey: ["platform-coupons"],
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          trialDays: Number(trialDays) || 14,
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
        },
      }),
    onSuccess: (coupon) => {
      toast.success(`Coupon ${coupon.code} created`);
      queryClient.invalidateQueries({ queryKey: ["platform-coupons"] });
      queryClient.invalidateQueries({ queryKey: ["platform-audit-log"] });
      setOpen(false);
      setTrialDays("14");
      setMaxRedemptions("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (couponId: string) => deactivateFn({ data: { couponId } }),
    onSuccess: () => {
      toast.success("Coupon deactivated");
      queryClient.invalidateQueries({ queryKey: ["platform-coupons"] });
      queryClient.invalidateQueries({ queryKey: ["platform-audit-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = coupons.data ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-console-muted">
          Trial coupons
        </h2>
        <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New coupon
        </Button>
      </div>

      {coupons.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No coupons yet"
          description="Create a Starter-scoped trial coupon to hand out manually. There is no public way to redeem one without a code."
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => (
            <Card key={c.id} className="border-console-border bg-console-panel">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-mono text-sm font-medium">
                    <Ticket className="h-4 w-4 text-console-accent" />
                    {c.code}
                  </p>
                  <p className="mt-1 text-xs text-console-muted">
                    {c.trial_days} day trial - Starter plan - {c.redeemed_count}
                    {c.max_redemptions ? ` of ${c.max_redemptions}` : ""} redeemed
                    {c.expires_at ? ` - expires ${day(c.expires_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
                  {c.active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={deactivate.isPending}
                      onClick={() => deactivate.mutate(c.id)}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New trial coupon</DialogTitle>
            <DialogDescription>
              Scoped to the Starter plan. Hand the code to the owner directly - it is not shown
              anywhere in the app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="trial-days">Trial length (days)</Label>
              <Input
                id="trial-days"
                type="number"
                min={1}
                max={90}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-redemptions">Max redemptions</Label>
              <Input
                id="max-redemptions"
                type="number"
                min={1}
                placeholder="Unlimited"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating..." : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
