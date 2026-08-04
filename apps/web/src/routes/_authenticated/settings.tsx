import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isValidVpa } from "@/lib/upi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandingSettingsCard } from "@/components/branding-settings-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: `Settings - ${BRAND}` },
      {
        name: "description",
        content: "Billing defaults: electricity rate, due-date offset and reminder preferences.",
      },
      { property: "og:title", content: `Settings - ${BRAND}` },
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
  upi_vpa: string;
  upi_payee_name: string;
  whatsapp_enabled: boolean;
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
        upi_vpa: data.upi_vpa ?? "",
        upi_payee_name: data.upi_payee_name ?? "",
        whatsapp_enabled: data.whatsapp_enabled,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const { data: userData } = await supabase.auth.getUser();
      const adminId = userData.user?.id;
      if (!adminId) throw new Error("Not signed in");

      const vpa = draft.upi_vpa.trim();
      // Caught here so the owner sees which field is wrong, rather than a
      // constraint violation from settings_upi_vpa_format.
      if (vpa && !isValidVpa(vpa)) {
        throw new Error("That UPI ID does not look right. It should look like name@bank.");
      }
      const payeeName = draft.upi_payee_name.trim();

      const { error } = await supabase.from("settings").upsert(
        {
          admin_id: adminId,
          ...draft,
          // Empty strings would fail the VPA format check; absent means absent.
          upi_vpa: vpa || null,
          upi_payee_name: payeeName || null,
        },
        { onConflict: "admin_id" },
      );
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

      {isLoading || !draft ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Collect rent by UPI</CardTitle>
            <CardDescription>
              Tenants get a Pay button in every reminder that opens their UPI app with the amount
              filled in. Money goes straight from the tenant to your bank account — PGKhata never
              holds it, and there are no transaction charges.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-vpa">Your UPI ID</Label>
                <Input
                  id="s-vpa"
                  placeholder="yourname@okhdfcbank"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.upi_vpa}
                  onChange={(e) => setDraft({ ...draft, upi_vpa: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Copy this from your GPay, PhonePe or Paytm app.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-payee">Name shown to tenants</Label>
                <Input
                  id="s-payee"
                  placeholder="Sunrise PG"
                  value={draft.upi_payee_name}
                  onChange={(e) => setDraft({ ...draft, upi_payee_name: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave blank to use your brand name.</p>
              </div>
            </div>

            {draft.upi_vpa.trim() ? (
              isValidVpa(draft.upi_vpa) ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                  <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Reminders will show a Pay button for{" "}
                    <span className="font-medium text-foreground">{draft.upi_vpa.trim()}</span>.
                    Send yourself a test bill to check it opens correctly.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-destructive">
                  That does not look like a UPI ID. It should look like name@bank.
                </p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                Without a UPI ID, reminders still go out — just without a Pay button.
              </p>
            )}

            <Button
              className="w-full sm:w-auto"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Save UPI details
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading || !draft ? null : (
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp reminders</CardTitle>
            <CardDescription>
              Sends the same reminder over WhatsApp as well as email, using the official WhatsApp
              Business API. Tenants need a phone number on file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Also send on WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Email still goes out either way. A tenant is never chased twice on the same day.
                </p>
              </div>
              <Switch
                aria-label="Also send reminders on WhatsApp"
                checked={draft.whatsapp_enabled}
                onCheckedChange={(v) => setDraft({ ...draft, whatsapp_enabled: v })}
              />
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Save WhatsApp settings
            </Button>
          </CardContent>
        </Card>
      )}

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
