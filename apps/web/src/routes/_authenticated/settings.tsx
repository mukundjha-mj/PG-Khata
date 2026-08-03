import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandingSettingsCard } from "@/components/branding-settings-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings - PG Manager" },
      {
        name: "description",
        content: "Billing defaults: electricity rate, due-date offset and reminder preferences.",
      },
      { property: "og:title", content: "Settings - PG Manager" },
      { property: "og:description", content: "Billing defaults and reminder preferences." },
    ],
  }),
  component: SettingsPage,
});

type Draft = {
  electricity_rate_per_unit: number;
  due_date_offset_days: number;
  reminder_days_before: number;
  remind_on_due_date: boolean;
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setDraft({
        electricity_rate_per_unit: Number(data.electricity_rate_per_unit),
        due_date_offset_days: data.due_date_offset_days,
        reminder_days_before: data.reminder_days_before,
        remind_on_due_date: data.remind_on_due_date,
      });
    }
  }, [data]);

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
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Defaults used when generating monthly bills.</p>
      </div>

      {isLoading || !draft ? (
        <Skeleton className="h-64" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Billing defaults</CardTitle>
            <CardDescription>These apply to every property unless overridden.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-rate">Electricity rate (₹ per unit)</Label>
                <Input
                  id="s-rate"
                  type="number"
                  min={0}
                  step="0.5"
                  value={draft.electricity_rate_per_unit}
                  onChange={(e) =>
                    setDraft({ ...draft, electricity_rate_per_unit: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-due">Due date (days after bill)</Label>
                <Input
                  id="s-due"
                  type="number"
                  min={0}
                  value={draft.due_date_offset_days}
                  onChange={(e) =>
                    setDraft({ ...draft, due_date_offset_days: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-remind">Remind this many days before due</Label>
                <Input
                  id="s-remind"
                  type="number"
                  min={0}
                  value={draft.reminder_days_before}
                  onChange={(e) =>
                    setDraft({ ...draft, reminder_days_before: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Remind again on the due date</p>
                <p className="text-xs text-muted-foreground">
                  Sends a second reminder the day rent is due.
                </p>
              </div>
              <Switch
                aria-label="Remind again on the due date"
                checked={draft.remind_on_due_date}
                onCheckedChange={(v) => setDraft({ ...draft, remind_on_due_date: v })}
              />
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Save settings
            </Button>
          </CardContent>
        </Card>
      )}

      <BrandingSettingsCard />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Sign out of this admin console.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
