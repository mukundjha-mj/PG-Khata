import { useEffect, useRef, useState } from "react";
import { Icon, addCollection } from "@iconify/react";
import { cn } from "@/lib/utils";
import { animatedIconCollections } from "@/lib/animated-icon-data";

let registered = false;
if (!registered) {
  for (const collection of animatedIconCollections) addCollection(collection);
  registered = true;
}

export type AnimatedIconName =
  | "line-md:home-md-twotone"
  | "line-md:grid-3-twotone"
  | "line-md:list-3-twotone"
  | "line-md:account"
  | "line-md:document-twotone"
  | "line-md:clipboard-check"
  | "line-md:gauge-twotone-loop"
  | "line-md:document-report-twotone"
  | "line-md:cog-loop"
  | "line-md:logout"
  | "line-md:loading-twotone-loop"
  | "line-md:bell-twotone-loop"
  | "line-md:email-twotone"
  | "line-md:download-loop"
  | "line-md:moon-to-sunny-outline-loop-transition"
  | "line-md:alert-circle-twotone"
  | "line-md:confirm-circle"
  | "line-md:plus"
  | "line-md:edit-twotone"
  | "line-md:search"
  | "svg-spinners:ring-resize"
  | "svg-spinners:bars-fade"
  | "svg-spinners:3-dots-fade";

/**
 * Animated SVG icon (line-md / svg-spinners packs, bundled offline).
 * With `replayOnHover`, the draw-in animation restarts whenever the nearest
 * interactive ancestor (link, button, or [data-icon-hover]) is hovered.
 */
export function AnimatedIcon({
  name,
  className,
  replayOnHover = false,
}: {
  name: AnimatedIconName;
  className?: string | undefined;
  replayOnHover?: boolean | undefined;
}) {
  const holder = useRef<HTMLSpanElement | null>(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    if (!replayOnHover) return;
    const host = holder.current?.closest<HTMLElement>("a, button, [data-icon-hover]");
    if (!host) return;
    const onEnter = () => setReplay((n) => n + 1);
    host.addEventListener("mouseenter", onEnter);
    host.addEventListener("focus", onEnter);
    return () => {
      host.removeEventListener("mouseenter", onEnter);
      host.removeEventListener("focus", onEnter);
    };
  }, [replayOnHover]);

  return (
    <span
      ref={holder}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-transform duration-200",
        replayOnHover && "group-hover/icon:scale-110",
      )}
    >
      <Icon key={replay} icon={name} aria-hidden className={cn("h-4 w-4 shrink-0", className)} />
    </span>
  );
}

/** Inline loading spinner used across data views. */
export function Spinner({ className }: { className?: string }) {
  return <AnimatedIcon name="svg-spinners:ring-resize" className={className} />;
}
