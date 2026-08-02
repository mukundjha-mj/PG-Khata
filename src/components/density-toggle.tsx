import { Rows3, StretchVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Density } from "@/lib/use-density";

/**
 * Mobile-only switch between a compact card list and expanded cards.
 * Hidden from the `md` breakpoint up where the real table is shown.
 */
export function DensityToggle({
  density,
  onChange,
  className,
}: {
  density: Density;
  onChange: (d: Density) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Card density"
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 md:hidden",
        className,
      )}
    >
      <Button
        type="button"
        size="sm"
        variant={density === "compact" ? "default" : "ghost"}
        aria-pressed={density === "compact"}
        className="h-9 flex-1"
        onClick={() => onChange("compact")}
      >
        <Rows3 className="mr-1.5 h-4 w-4" />
        Compact
      </Button>
      <Button
        type="button"
        size="sm"
        variant={density === "expanded" ? "default" : "ghost"}
        aria-pressed={density === "expanded"}
        className="h-9 flex-1"
        onClick={() => onChange("expanded")}
      >
        <StretchVertical className="mr-1.5 h-4 w-4" />
        Expanded
      </Button>
    </div>
  );
}
