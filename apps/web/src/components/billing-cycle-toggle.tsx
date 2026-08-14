import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingCycle } from "@/lib/plan-proration";

/** Segmented Monthly/Annually switch, shared by the pricing page and the landing page. */
export function BillingCycleToggle({
  value,
  onChange,
  className,
}: {
  value: BillingCycle;
  onChange: (v: BillingCycle) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Billing cycle"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1",
        className,
      )}
    >
      <Button
        type="button"
        size="sm"
        variant={value === "monthly" ? "default" : "ghost"}
        aria-pressed={value === "monthly"}
        className="h-9 rounded-full px-4"
        onClick={() => onChange("monthly")}
      >
        Monthly
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "annual" ? "default" : "ghost"}
        aria-pressed={value === "annual"}
        className="h-9 rounded-full px-4"
        onClick={() => onChange("annual")}
      >
        Annually
      </Button>
    </div>
  );
}
