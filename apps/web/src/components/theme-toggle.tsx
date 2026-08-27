import { AnimatedIcon } from "@/components/animated-icon";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

/** Toggles between the resolved light and dark color themes. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useBranding();
  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border bg-muted p-0.5 shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={() => setTheme(nextTheme)}
    >
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-transform duration-200 motion-reduce:transition-none",
          isDark && "translate-x-5 border-primary bg-primary text-primary-foreground",
        )}
      >
        <AnimatedIcon
          key={resolvedTheme}
          name="line-md:moon-to-sunny-outline-loop-transition"
          replayOnHover
          className="size-3.5"
        />
      </span>
    </button>
  );
}
