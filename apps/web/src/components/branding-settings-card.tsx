import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandMark } from "@/components/brand-mark";
import {
  BRAND_COLOR_PRESETS,
  DEFAULT_BRAND_COLOR,
  DEFAULT_BRAND_NAME,
  fileToLogoDataUrl,
  useBranding,
  type ThemeMode,
} from "@/lib/branding";
import { cn } from "@/lib/utils";

type BrandingDraft = {
  brand_name: string;
  brand_logo_url: string | null;
  brand_primary_color: string;
  theme_preference: ThemeMode;
};

/** Workspace branding: logo, primary colour and default theme. */
export function BrandingSettingsCard() {
  const queryClient = useQueryClient();
  const { setTheme, refresh } = useBranding();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BrandingDraft | null>(null);

  const { isLoading } = useQuery({
    queryKey: ["branding-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("brand_name, brand_logo_url, brand_primary_color, theme_preference")
        .maybeSingle();
      if (error) throw error;
      setDraft({
        brand_name: data?.brand_name || DEFAULT_BRAND_NAME,
        brand_logo_url: data?.brand_logo_url ?? null,
        brand_primary_color: data?.brand_primary_color || DEFAULT_BRAND_COLOR,
        theme_preference: (data?.theme_preference as ThemeMode) || "system",
      });
      return data ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const { data: userData } = await supabase.auth.getUser();
      const adminId = userData.user?.id;
      if (!adminId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("settings")
        .upsert({ admin_id: adminId, ...draft }, { onConflict: "admin_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      if (draft) setTheme(draft.theme_preference);
      queryClient.invalidateQueries({ queryKey: ["branding-settings"] });
      queryClient.invalidateQueries({ queryKey: ["branding"] });
      refresh();
      toast.success("Branding updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onPickLogo(file?: File) {
    if (!file || !draft) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please pick a logo under 2 MB");
      return;
    }
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setDraft({ ...draft, brand_logo_url: dataUrl });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading || !draft) return <Skeleton className="h-72" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Your logo, primary colour and default theme.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="b-name">Workspace name</Label>
          <Input
            id="b-name"
            value={draft.brand_name}
            onChange={(e) => setDraft({ ...draft, brand_name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
            <BrandMark
              size={44}
              src={draft.brand_logo_url}
              className="rounded-[9px]"
              alt="Logo preview"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => onPickLogo(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" /> Upload
            </Button>
            {draft.brand_logo_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraft({ ...draft, brand_logo_url: null })}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Reset
              </Button>
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG, up to 2 MB.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Primary colour</Label>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                onClick={() => setDraft({ ...draft, brand_primary_color: preset.value })}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full border-2 transition sm:h-9 sm:w-9",
                  draft.brand_primary_color.toLowerCase() === preset.value
                    ? "border-foreground"
                    : "border-transparent",
                )}
                style={{ backgroundColor: preset.value }}
              >
                {draft.brand_primary_color.toLowerCase() === preset.value && (
                  <Check className="h-4 w-4 text-white" />
                )}
              </button>
            ))}
            <input
              type="color"
              aria-label="Custom primary colour"
              value={draft.brand_primary_color}
              onChange={(e) => setDraft({ ...draft, brand_primary_color: e.target.value })}
              className="h-11 w-14 cursor-pointer sm:h-9 sm:w-12 rounded-md border border-border bg-background p-1"
            />
            <Input
              value={draft.brand_primary_color}
              onChange={(e) => setDraft({ ...draft, brand_primary_color: e.target.value })}
              className="h-11 w-28 font-mono text-xs sm:h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Default theme</Label>
          <Select
            value={draft.theme_preference}
            onValueChange={(v) => {
              setDraft({ ...draft, theme_preference: v as ThemeMode });
              setTheme(v as ThemeMode);
            }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">Match system</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Save branding
        </Button>
      </CardContent>
    </Card>
  );
}
