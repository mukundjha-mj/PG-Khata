import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ArrowRight, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  pricingPlans,
  includedOnEveryPlan,
  planComparison,
  planTiers,
  tierByKey,
  enterprisePlan,
} from "@/lib/pricing-plans";
import { computeProration, rupees, type Proration, type BillingCycle } from "@/lib/plan-proration";
import { usePlanSettings } from "@/lib/use-plan";
import { PriceTag } from "@/components/price-tag";
import { BillingCycleToggle } from "@/components/billing-cycle-toggle";
import {
  startPlanChange,
  startPlanRenewal,
  confirmPlanPayment,
  cancelPendingPlanChange,
} from "@/lib/plan.functions";
import { describePlanPeriod, formatDate, GRACE_DAYS } from "@/lib/plan-period";
import { BRAND } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: `Your plan and billing - ${BRAND}` },
      {
        name: "description",
        content:
          "See your current tier, renewal date and payment status, and upgrade or downgrade with clear prorated pricing.",
      },
      { property: "og:title", content: `Your plan and billing - ${BRAND}` },
      {
        property: "og:description",
        content: `Manage your ${BRAND} subscription with prorated upgrades and UPI checkout.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Razorpay ships no types: it is a script tag, so declare only what we pass and read. */
type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  method: Record<string, boolean>;
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = RAZORPAY_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const statusTone: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  trial: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  past_due: "bg-destructive/10 text-destructive",
};

const statusLabel: Record<string, string> = {
  active: "Paid and active",
  trial: "Free trial",
  past_due: "Payment due",
};

function PlanPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = usePlanSettings();
  const [target, setTarget] = useState<string | null>(null);
  // Browsing toggle for the tier-card prices and what Renew buys next. A
  // same-cycle tier change (Upgrade/Downgrade) always stays on the account's
  // actual current cadence, never this toggle - cadence itself only changes
  // at renewal, so there is no partial-year-against-partial-month proration
  // to reconcile.
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const start = useServerFn(startPlanChange);
  const renewPlan = useServerFn(startPlanRenewal);
  const confirm = useServerFn(confirmPlanPayment);
  const cancelPending = useServerFn(cancelPendingPlanChange);

  useEffect(() => {
    void loadRazorpay();
  }, []);

  // Once the account's real cadence loads, default the toggle to match it -
  // an annual subscriber should land on the Annually tab, not Monthly.
  useEffect(() => {
    if (data?.billing_cycle) setBillingCycle(data.billing_cycle);
  }, [data?.billing_cycle]);

  const current = data?.plan ?? "starter";
  const currentTier = tierByKey(current);
  const accountCycle: BillingCycle = data?.billing_cycle ?? "monthly";

  const preview: Proration | null = useMemo(() => {
    if (!target || !data) return null;
    return computeProration({
      from: current,
      to: target,
      periodStart: data.current_period_start,
      periodEnd: data.current_period_end,
      billingCycle: accountCycle,
    });
  }, [target, data, current, accountCycle]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    queryClient.invalidateQueries({ queryKey: ["plan-history"] });
  };

  /**
   * Opens Razorpay for an order and resolves once the payment is verified
   * server side. Shared by upgrades and renewals: only the label differs.
   */
  const openCheckout = async (order: {
    keyId: string;
    amount: number;
    currency: string;
    orderId: string;
    planName: string;
    description: string;
  }) => {
    const ok = await loadRazorpay();
    const Razorpay = window.Razorpay;
    if (!ok || !Razorpay)
      throw new Error("Could not load the payment window. Check your connection and retry.");

    await new Promise<void>((resolve, reject) => {
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: BRAND,
        description: order.description,
        method: { upi: true, card: true, netbanking: true, wallet: true },
        handler: async (r) => {
          try {
            await confirm({
              data: {
                orderId: r.razorpay_order_id,
                paymentId: r.razorpay_payment_id,
                signature: r.razorpay_signature,
              },
            });
            resolve();
          } catch (e) {
            reject(e as Error);
          }
        },
        modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        theme: { color: "#2563eb" },
      });
      rzp.open();
    });
  };

  const change = useMutation({
    mutationFn: async (toPlan: string) => {
      const res = await start({ data: { toPlan } });
      if (res.kind !== "checkout") return res;
      await openCheckout({ ...res, description: `Upgrade to ${res.planName} (prorated)` });
      return res;
    },
    onSuccess: (res) => {
      setTarget(null);
      refresh();
      if (res.kind === "scheduled") {
        toast.success("Downgrade scheduled for your next renewal");
      } else {
        toast.success("Plan updated");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renew = useMutation({
    mutationFn: async (cycle: BillingCycle) => {
      const res = await renewPlan({ data: { billingCycle: cycle } });
      await openCheckout({
        ...res,
        description: `${res.planName} plan, ${cycle === "annual" ? "one year" : "one month"}`,
      });
      return res;
    },
    onSuccess: () => {
      refresh();
      toast.success("Payment received. Your plan is renewed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelPending({}),
    onSuccess: () => {
      refresh();
      toast.success("Scheduled change cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renewal = data ? formatDate(data.current_period_end) : "";
  const status = data?.plan_status ?? "trial";

  const period = data
    ? describePlanPeriod({
        periodEnd: data.current_period_end,
        planStatus: data.plan_status,
      })
    : null;

  // The plan the renewal actually bills, honouring a scheduled downgrade.
  const renewingTier =
    data?.pending_plan && tierByKey(data.pending_plan).rank < currentTier.rank
      ? tierByKey(data.pending_plan)
      : currentTier;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Your plan and billing</h1>
          <p className="page-subtitle">
            Priced for what you actually run. Upgrades are prorated to the day, downgrades take
            effect at renewal.
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 md:h-9">
          <Link to="/plan-history">
            <History className="mr-2 h-4 w-4" />
            Change history
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Could not load your billing details</p>
              <p className="text-sm text-muted-foreground">
                The connection to your account failed. Nothing is wrong with your plan or your
                payments, and nothing has been charged.
              </p>
            </div>
            <Button
              variant="outline"
              className="h-11 shrink-0 md:h-9"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !data ? (
        // A missing settings row used to leave this page on a skeleton forever
        // with every button dead and no reason given. The owner cannot create
        // the row themselves, so say so plainly instead of looking broken.
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Your account setup is incomplete</p>
              <p className="text-sm text-muted-foreground">
                Your billing profile is missing, so your plan cannot be shown or changed. Your
                properties, tenants and bills are unaffected. Reload first, and if this stays put
                contact support with the email you signed in with.
              </p>
            </div>
            <Button
              variant="outline"
              className="h-11 shrink-0 md:h-9"
              onClick={() => void refetch()}
            >
              Reload
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              Current plan
              <Badge>{currentTier.name}</Badge>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[status] ?? statusTone["trial"]}`}
              >
                {statusLabel[status] ?? status}
              </span>
            </CardTitle>
            <CardDescription>
              {pricingPlans.find((p) => p.name === currentTier.name)?.sub}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {accountCycle === "annual" ? "Annual price" : "Monthly price"}
              </p>
              <p className="subsection-title">
                {rupees(
                  accountCycle === "annual"
                    ? (currentTier.annualAmount ?? currentTier.amount)
                    : currentTier.amount,
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Next renewal</p>
              <p className="subsection-title">{renewal}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last payment</p>
              <p className="subsection-title">
                {data.last_payment_at
                  ? `${rupees(Number(data.last_payment_amount))} on ${new Date(data.last_payment_at).toLocaleDateString("en-IN")}`
                  : "No payment yet"}
              </p>
            </div>
            {period?.needsPayment ? (
              <div
                className={`sm:col-span-3 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                  period.isOverdue
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-amber-500/40 bg-amber-500/5"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{period.title}</p>
                  <p className="text-sm text-muted-foreground">{period.detail}</p>
                </div>
                <Button
                  className="h-11 shrink-0 md:h-9"
                  disabled={renew.isPending}
                  onClick={() => renew.mutate(accountCycle)}
                >
                  {renew.isPending
                    ? "Opening checkout..."
                    : `Pay ${rupees(
                        accountCycle === "annual"
                          ? (renewingTier.annualAmount ?? renewingTier.amount)
                          : renewingTier.amount,
                      )} for ${accountCycle === "annual" ? "a year" : "a month"}`}
                </Button>
              </div>
            ) : null}
            {data.pending_plan ? (
              <div className="sm:col-span-3 flex flex-col gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  Scheduled change: moving to <strong>{tierByKey(data.pending_plan).name}</strong>{" "}
                  on {renewal}.
                </p>
                <Button
                  variant="outline"
                  className="h-11 md:h-9"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  Cancel change
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col items-center gap-2">
        <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
        {billingCycle === "annual" ? (
          <p className="text-xs text-muted-foreground">Pay yearly and get roughly 2 months free.</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {planTiers.map((tier) => {
          const p = pricingPlans.find((x) => x.name === tier.name)!;
          const isCurrent = tier.key === current;
          const isUpgrade = tier.rank > tierByKey(current).rank;
          const showingAnnual = billingCycle === "annual";
          const annualPrice = tier.annualAmount ?? tier.amount * 12;
          return (
            <Card key={tier.key} className={isCurrent ? "border-primary shadow-sm" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {tier.name}
                  {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                </CardTitle>
                <CardDescription>{p.sub}</CardDescription>
                <div className="space-y-1 pt-2">
                  {showingAnnual ? (
                    <>
                      <PriceTag mrp={tier.amount * 12} salePrice={annualPrice} />
                      <p className="text-xs text-muted-foreground">
                        {rupees(annualPrice)}/year - about {rupees(annualPrice / 12)}/month
                      </p>
                    </>
                  ) : tier.mrpAmount ? (
                    <PriceTag mrp={tier.mrpAmount} salePrice={tier.amount} />
                  ) : (
                    <p className="stat-value">
                      {rupees(tier.amount)}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {it}
                    </li>
                  ))}
                </ul>
                <Button
                  className="h-11 w-full"
                  variant={isCurrent ? "outline" : isUpgrade ? "default" : "secondary"}
                  disabled={isCurrent || !data}
                  onClick={() => setTarget(tier.key)}
                >
                  {isCurrent
                    ? "Your current plan"
                    : `${isUpgrade ? "Upgrade" : "Downgrade"} to ${tier.name}`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {isCurrent
                    ? `Renews ${renewal}`
                    : isUpgrade
                      ? `Pay only for the days left in this ${accountCycle === "annual" ? "year" : "cycle"}.`
                      : "No charge today, starts at your next renewal."}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{enterprisePlan.name}</CardTitle>
          <CardDescription>{enterprisePlan.sub}</CardDescription>
          <p className="stat-value pt-2">{enterprisePlan.price}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {enterprisePlan.items.map((it) => (
              <li key={it} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {it}
              </li>
            ))}
          </ul>
          <Button asChild className="h-11 w-full" variant="secondary">
            <Link to="/contact-us">Contact us</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            We'll price it with you based on how many rooms and properties you run.
          </p>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => (o ? null : setTarget(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {preview?.direction === "upgrade" ? "Confirm upgrade" : "Confirm downgrade"}
            </DialogTitle>
            <DialogDescription>{preview?.summary}</DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {tierByKey(preview.from).name}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                {tierByKey(preview.to).name}
              </div>
              {preview.lines.map((l) => (
                <div key={l.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{l.label}</span>
                  <span className="font-medium">{l.value}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Calculated on {preview.daysRemaining} of {preview.periodDays} days remaining in the
                current cycle.
              </p>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11 md:h-9" onClick={() => setTarget(null)}>
              Not now
            </Button>
            <Button
              className="h-11 md:h-9"
              disabled={change.isPending}
              onClick={() => target && change.mutate(target)}
            >
              {preview?.direction === "upgrade"
                ? `Pay ${rupees(preview.amountDue)} with UPI or card`
                : "Schedule downgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>How plan changes are charged</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Upgrades</strong> take effect immediately. You pay
            the price difference only for the days left in your current cycle, so a mid month
            upgrade never charges a full extra month. Your renewal date does not move.
          </p>
          <p>
            <strong className="text-foreground">Downgrades</strong> are scheduled, not instant. You
            keep your current features until the renewal date you already paid for, then the lower
            price applies. Nothing is charged today and no refund is issued.
          </p>
          <p>
            <strong className="text-foreground">Renewals</strong> are charged{" "}
            {accountCycle === "annual" ? "a year" : "a month"} at a time at list price, with no
            proration. You get {GRACE_DAYS} buffer days after your renewal date to pay, and the app
            keeps working normally through them. Paying inside the buffer keeps your existing
            billing date, so it never drifts earlier over time.
          </p>
          <p>
            <strong className="text-foreground">A missed payment never locks you out.</strong> Your
            tenants, bills and history stay exactly where they are and the app stays fully usable
            even after the buffer ends. We will keep reminding you, not shut you off mid month.
          </p>
          <p>
            <strong className="text-foreground">Payments</strong> run through Razorpay and support
            UPI, cards, netbanking and wallets. Every change is written to your plan change history.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Included on every plan</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {includedOnEveryPlan.map((it) => (
              <li key={it} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {it}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compare plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {planComparison.map((row) => (
            <div key={row.feature} className="border-b pb-3 last:border-0 last:pb-0">
              <p className="text-sm font-medium">{row.feature}</p>
              <div className="mt-1 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Starter: {row.starter}</span>
                <span>Growing: {row.growing}</span>
                <span>Scale: {row.scale}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
