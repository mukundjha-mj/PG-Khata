import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Density } from "@/lib/use-density";

type Props = {
  /** Column labels in order. Used as the inline label for each cell on phones. */
  labels: string[];
  children: React.ReactNode;
  className?: string;
  /** Mobile card density. Compact hides secondary cells and tightens spacing. */
  density?: Density;
  /**
   * Number of leading cells kept visible in compact mode (2 or 3).
   * The last cell (usually actions) is always kept.
   */
  compactColumns?: 2 | 3;
  /**
   * Skips paint/layout work for offscreen rows so long lists stay smooth
   * on phones. Enable for lists that can grow past a screenful.
   */
  virtualize?: boolean;
};

/**
 * Wraps a <Table> so it renders as a normal table on desktop and as stacked
 * label/value cards on phones - no horizontal scrolling, no squeezed columns.
 * Labels are injected through CSS custom properties (see .rtable in styles.css).
 */
export function ResponsiveTable({
  labels,
  children,
  className,
  density = "expanded",
  compactColumns = 2,
  virtualize = false,
}: Props) {
  const style = React.useMemo(() => {
    const vars: Record<string, string> = {};
    labels.forEach((label, i) => {
      vars[`--c${i + 1}`] = JSON.stringify(label ?? "");
    });
    return vars as React.CSSProperties;
  }, [labels]);

  return (
    <div
      className={cn("rtable w-full", virtualize && "rtable-virtual", className)}
      style={style}
      data-density={density}
      data-compact-cols={compactColumns}
    >
      {children}
    </div>
  );
}

/** Placeholder rows that keep the layout stable while a table's data loads. */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  density = "expanded",
  className,
}: {
  rows?: number;
  columns?: number;
  density?: Density;
  className?: string;
}) {
  const mobileCells = density === "compact" ? Math.min(columns, 2) : columns;

  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      <div className="hidden gap-3 border-b border-border pb-2 md:flex">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="space-y-2 rounded-lg border border-border p-3 md:flex md:items-center md:gap-3 md:space-y-0 md:border-0 md:p-0 md:py-2"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className={cn(
                "flex items-center justify-between gap-3 md:flex-1",
                c >= mobileCells && "hidden md:flex",
              )}
            >
              <Skeleton className="h-3 w-20 md:hidden" />
              <Skeleton className="h-4 w-24 md:w-full" />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">Loading data</span>
    </div>
  );
}
