import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { planRank, tierByKey, type PlanKey } from "@/lib/pricing-plans";

export type PlanSettings = {
  plan: PlanKey;
  plan_status: string;
  pending_plan: PlanKey | null;
  current_period_start: string;
  current_period_end: string;
  last_payment_amount: number;
  last_payment_at: string | null;
  plan_updated_at: string | null;
};

export function usePlanSettings() {
  return useQuery({
    queryKey: ["plan-settings"],
    queryFn: async (): Promise<PlanSettings | null> => {
      const { data, error } = await supabase
        .from("settings")
        .select(
          "plan, plan_status, pending_plan, current_period_start, current_period_end, last_payment_amount, last_payment_at, plan_updated_at",
        )
        .maybeSingle();
      if (error) throw error;
      return (data as PlanSettings | null) ?? null;
    },
  });
}

/** Current tier plus a helper to check whether a minimum tier is met. */
export function usePlan() {
  const { data, isLoading } = usePlanSettings();
  const plan = (data?.plan ?? "starter") as PlanKey;
  return {
    plan,
    tier: tierByKey(plan),
    settings: data ?? null,
    isLoading,
    hasAtLeast: (min: PlanKey) => planRank(plan) >= planRank(min),
  };
}
