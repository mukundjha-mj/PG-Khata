import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pg-property-scope";

export type PropertyScope = {
  /** null = "All" */
  selectedPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;
};

const PropertyScopeContext = createContext<PropertyScope | null>(null);

/**
 * Which property the app is scoped to. Session-only by design (sessionStorage,
 * not localStorage): resets to "All" on every fresh login/tab, but survives
 * in-session navigation and reloads.
 */
export function PropertyScopeProvider({ children }: { children: ReactNode }) {
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedPropertyIdState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setSelectedPropertyId = useCallback((id: string | null) => {
    setSelectedPropertyIdState(id);
    try {
      if (id) window.sessionStorage.setItem(STORAGE_KEY, id);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(
    () => ({ selectedPropertyId, setSelectedPropertyId }),
    [selectedPropertyId, setSelectedPropertyId],
  );

  return <PropertyScopeContext.Provider value={value}>{children}</PropertyScopeContext.Provider>;
}

export function usePropertyScope(): PropertyScope {
  const ctx = useContext(PropertyScopeContext);
  if (!ctx) throw new Error("usePropertyScope must be used within PropertyScopeProvider");
  return ctx;
}
