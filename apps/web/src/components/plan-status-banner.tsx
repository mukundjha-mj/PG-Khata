import { Link, useLocation } from "@tanstack/react-router";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanSettings } from "@/lib/use-plan";
import { describePlanPeriod, type PlanPhase } from "@/lib/plan-period";
import { cn } from "@/lib/utils";

/**
 * Payment reminder shown across the owner app once a renewal is near or past
 * due. Deliberately a banner and nothing more: an owner who cannot open the app
 * cannot bill their tenants, so access is never withheld over our own invoice.
 *
 * Hidden on the billing pages themselves, which already show the same state in
 * more detail.
 */

const tone: Record<Exclude<PlanPhase, "active">, string> = {
  due_soon: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  grace: "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-100",
  lapsed: "border-destructive/40 bg-destructive/10 text-destructive",
  unpaid: "border-destructive/40 bg-destructive/10 text-destructive",
};

const icon: Record<Exclude<PlanPhase, "active">, typeof Clock> = {
  due_soon: Clock,
  grace: Clock,
  lapsed: AlertTriangle,
  unpaid: AlertTriangle,
};

export function PlanStatusBanner() {
  const { pathname } = useLocation();
  const { data } = usePlanSettings();

  if (!data) return null;
  if (pathname.startsWith("/plan")) return null;

  const period = describePlanPeriod({
    periodEnd: data.current_period_end,
    planStatus: data.plan_status,
  });
  if (period.phase === "active") return null;

  const Icon = icon[period.phase];

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3",
        tone[period.phase],
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">{period.title}.</span>{" "}
        <span className="opacity-90">{period.detail}</span>
      </p>
      <Button asChild size="sm" className="h-9 shrink-0 self-start sm:self-auto">
        <Link to="/plan">
          <CreditCard className="mr-2 h-4 w-4" />
          {period.isTrial ? "Choose a plan" : "Pay now"}
        </Link>
      </Button>
    </div>
  );
}
