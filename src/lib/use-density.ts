import * as React from "react";

export type Density = "compact" | "expanded";

/**
 * Mobile card density preference (compact list vs expanded cards).
 * Persisted per view key so each table remembers the choice.
 */
export function useDensity(key: string, initial: Density = "compact") {
  const storageKey = `pg-density:${key}`;
  const [density, setDensity] = React.useState<Density>(initial);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "compact" || saved === "expanded") setDensity(saved);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  const update = React.useCallback(
    (next: Density) => {
      setDensity(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  );

  const toggle = React.useCallback(
    () => update(density === "compact" ? "expanded" : "compact"),
    [density, update],
  );

  return { density, setDensity: update, toggle };
}
