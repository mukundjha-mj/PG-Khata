import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlan } from "@/lib/use-plan";
import { tierByKey, type PlanKey } from "@/lib/pricing-plans";

/** Wraps premium screens and blocks them below the required tier. */
export function PlanGate({
  min,
  feature,
  children,
}: {
  min: PlanKey;
  feature: string;
  children: ReactNode;
}) {
  const { hasAtLeast, isLoading, tier } = usePlan();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (hasAtLeast(min)) return <>{children}</>;

  const required = tierByKey(min);

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <CardTitle className="pt-2">
            {feature} is on the {required.name} plan
          </CardTitle>
          <CardDescription>
            You are on {tier.name}. Upgrade to {required.name} to unlock {feature.toLowerCase()}.
            Upgrades are prorated, so you only pay for the days left in this cycle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="h-11 w-full sm:w-auto">
            <Link to="/plan">See plans and upgrade</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Inline lock for premium actions inside an otherwise available page. */
export function PremiumAction({
  min,
  children,
  label,
}: {
  min: PlanKey;
  children: ReactNode;
  label: string;
}) {
  const { hasAtLeast, isLoading } = usePlan();
  if (isLoading) return null;
  if (hasAtLeast(min)) return <>{children}</>;
  return (
    <Button asChild variant="outline" className="h-11 md:h-9">
      <Link to="/plan">
        <Lock className="mr-2 h-4 w-4" />
        {label} ({tierByKey(min).name})
      </Link>
    </Button>
  );
}
