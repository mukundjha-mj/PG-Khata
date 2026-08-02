import * as React from "react";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type FilterChip = {
  label: string;
  onClear: () => void;
};

export type QuickChip = {
  label: string;
  active: boolean;
  onSelect: () => void;
};

type Props = {
  children: React.ReactNode;
  /** Sticky offset on mobile - matches the app header height by default. */
  sticky?: boolean;
  label?: string;
  className?: string;
  /** Active filters shown as dismissible chips below the controls. */
  chips?: FilterChip[];
  /** One-tap status chips shown inline above the filter trigger on mobile. */
  quickChips?: QuickChip[];
  /** Shows a "Reset filters" button when provided and chips are active. */
  onReset?: () => void;
};

/**
 * Filter/search controls that stay reachable on phones: the controls open in a
 * bottom sheet (no layout shift, no overflow), with quick status chips and an
 * inline reset always visible. From `sm` up the controls render inline.
 */
function useIsSmall() {
  const [small, setSmall] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setSmall(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return small;
}

export function FilterBar({
  children,
  sticky = true,
  label = "Filters",
  className,
  chips = [],
  quickChips = [],
  onReset,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const isSmall = useIsSmall();
  const active = chips.length;

  const resetButton = onReset && active > 0 && (
    <Button
      type="button"
      variant="ghost"
      onClick={onReset}
      className="w-full justify-center sm:w-auto"
    >
      <RotateCcw className="mr-2 h-4 w-4" />
      Reset filters
    </Button>
  );

  return (
    <div
      className={cn(
        "w-full",
        sticky &&
          "sticky top-14 z-20 -mx-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none",
        className,
      )}
    >
      {/* Mobile: quick chips + bottom-sheet trigger */}
      {isSmall ? (
      <div className="sm:hidden">
        {quickChips.length > 0 && (
          <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                aria-pressed={chip.active}
                onClick={chip.onSelect}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                  chip.active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-muted/50 text-foreground hover:bg-muted",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" className="flex-1 justify-between">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  {label}
                </span>
                {active > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                    {active}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle>{label}</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-1 gap-3 py-4">{children}</div>
              <div className="flex flex-col gap-2 pb-2">
                {resetButton}
                <Button type="button" className="w-full" onClick={() => setOpen(false)}>
                  Show results
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          {onReset && active > 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Reset filters"
              onClick={onReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      ) : (
      /* Desktop: inline controls */
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {resetButton}
      </div>
      )}

      {active > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onClear}
              aria-label={`Clear filter ${chip.label}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span className="max-w-[12rem] truncate">{chip.label}</span>
              <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
