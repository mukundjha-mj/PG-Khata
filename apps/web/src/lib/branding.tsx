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

export const DEFAULT_BRAND_COLOR = "#644a40";
export const DEFAULT_BRAND_NAME = BRAND;

export const BRAND_COLOR_PRESETS = [
  { label: "Clay", value: "#644a40" },
  { label: "Cobalt", value: "#2563eb" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#e11d48" },
  { label: "Slate", value: "#334155" },
];

const THEME_STORAGE_KEY = "pg-theme";

export type Branding = {
  brandName: string;
  brandLogoUrl: string | null;
  brandPrimaryColor: string;
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
  refresh: () => void;
};

const BrandingContext = createContext<Branding | null>(null);

function isHex(value: string) {
  return /^#([0-9a-f]{6})$/i.test(value.trim());
}

/** Relative luminance, used to pick readable text on top of the brand colour. */
function readableForeground(hex: string) {
  const v = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
  return l > 0.45 ? "#0b1020" : "#ffffff";
}

function applyBrandColor(hex: string) {
  const root = document.documentElement;
  if (!isHex(hex)) return;
  // The default brand colour is already the theme's own primary, so leave the
  // stylesheet in charge (it has correct light and dark values).
  if (hex.toLowerCase() === DEFAULT_BRAND_COLOR) {
    for (const key of [
      "--primary",
      "--primary-foreground",
      "--ring",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-ring",
      "--chart-1",
    ]) {
      root.style.removeProperty(key);
    }
    return;
  }
  const fg = readableForeground(hex);
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--primary-foreground", fg);
  root.style.setProperty("--ring", hex);
  root.style.setProperty("--sidebar-primary", hex);
  root.style.setProperty("--sidebar-primary-foreground", fg);
  root.style.setProperty("--sidebar-ring", hex);
  root.style.setProperty("--chart-1", hex);
}

function applyThemeClass(mode: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
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
        .select("brand_name, brand_logo_url, brand_primary_color, theme_preference")
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

  const brandPrimaryColor =
    data?.brand_primary_color && isHex(data.brand_primary_color)
      ? data.brand_primary_color
      : DEFAULT_BRAND_COLOR;

  useEffect(() => {
    applyBrandColor(brandPrimaryColor);
  }, [brandPrimaryColor, resolvedTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    setThemeState(mode);
  }, []);

  const value = useMemo<Branding>(
    () => ({
      brandName: data?.brand_name || DEFAULT_BRAND_NAME,
      brandLogoUrl: data?.brand_logo_url ?? null,
      brandPrimaryColor,
      theme,
      resolvedTheme,
      setTheme,
      refresh: () => void refetch(),
    }),
    [
      data?.brand_name,
      data?.brand_logo_url,
      brandPrimaryColor,
      theme,
      resolvedTheme,
      setTheme,
      refetch,
    ],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  const ctx = useContext(BrandingContext);
  if (ctx) return ctx;
  return {
    brandName: DEFAULT_BRAND_NAME,
    brandLogoUrl: null,
    brandPrimaryColor: DEFAULT_BRAND_COLOR,
    theme: "system",
    resolvedTheme: "light",
    setTheme: () => {},
    refresh: () => {},
  };
}

/** Downscales an uploaded logo to a small square data URL so it can live in settings. */
export async function fileToLogoDataUrl(file: File, size = 256): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/svg+xml") return dataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That file is not a readable image"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}
