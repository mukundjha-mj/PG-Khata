import { AnimatedIcon } from "@/components/animated-icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/lib/branding";

/** Flips the whole app between the light and dark theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useBranding();
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("group/icon", className)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      <AnimatedIcon
        key={resolvedTheme}
        name="line-md:moon-to-sunny-outline-loop-transition"
        replayOnHover
        className="h-[18px] w-[18px]"
      />
    </Button>
  );
}
