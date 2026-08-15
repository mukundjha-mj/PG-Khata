import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { BRAND } from "@/lib/site";

export type ThemeMode = "light" | "dark" | "system";

export const DEFAULT_BRAND_NAME = BRAND;

const THEME_STORAGE_KEY = "pg-theme";

export type Branding = {
  brandName: string;
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
  refresh: () => void;
};

const BrandingContext = createContext<Branding | null>(null);

function applyThemeClass(mode: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [systemDark, setSystemDark] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      // Imported here, not at module scope: this provider wraps every route,
      // including the marketing pages, and a static import drags the whole
      // Supabase client into the entry chunk for visitors who never sign in.
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      const { data, error } = await supabase
        .from("settings")
        .select("brand_name, theme_preference")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  // Hydrate the stored preference and follow the OS setting.
  useEffect(() => {
    setThemeState(readStoredTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // A saved workspace preference wins over the local default on first load.
  useEffect(() => {
    const saved = data?.theme_preference as ThemeMode | undefined;
    if (!saved) return;
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
    setThemeState(saved);
  }, [data?.theme_preference]);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    setThemeState(mode);
  }, []);

  const value = useMemo<Branding>(
    () => ({
      brandName: data?.brand_name || DEFAULT_BRAND_NAME,
      theme,
      resolvedTheme,
      setTheme,
      refresh: () => void refetch(),
    }),
    [data?.brand_name, theme, resolvedTheme, setTheme, refetch],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  const ctx = useContext(BrandingContext);
  if (ctx) return ctx;
  return {
    brandName: DEFAULT_BRAND_NAME,
    theme: "light",
    resolvedTheme: "light",
    setTheme: () => {},
    refresh: () => {},
  };
}
