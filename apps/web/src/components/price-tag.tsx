import { computeDiscount } from "@/lib/price-display";
import { rupees } from "@/lib/plan-proration";
import { Badge } from "@/components/ui/badge";

/**
 * Struck-through MRP next to the highlighted sale price, plus a savings
 * badge. Renders nothing extra when there's no MRP to compare against - the
 * caller decides whether to render this at all vs. a plain price.
 */
export function PriceTag({ mrp, salePrice }: { mrp: number; salePrice: number }) {
  const { discountPercent } = computeDiscount(mrp, salePrice);
  return (
    <span className="flex flex-wrap items-baseline gap-2">
      <span className="stat-value">{rupees(salePrice)}</span>
      <span className="text-sm text-muted-foreground line-through">{rupees(mrp)}</span>
      {discountPercent > 0 ? (
        <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
          {discountPercent}% off
        </Badge>
      ) : null}
    </span>
  );
}
