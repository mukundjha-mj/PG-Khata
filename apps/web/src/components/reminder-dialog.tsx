import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { createReminder } from "@/lib/reminders.functions";
import type { ScheduleReminderResult } from "@/lib/reminders.server";

export type ReminderCandidate = {
  tenantId: string;
  tenantName: string;
  hasEmail: boolean;
  hasPhone: boolean;
};

export type ReminderDialogState = {
  candidates: ReminderCandidate[];
  preselectedIds: string[];
  /** Bill context for the wording/UPI link - only meaningful for a single preselected tenant. */
  billId: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function ReminderDialog({
  state,
  whatsappAvailable,
  onOpenChange,
}: {
  state: ReminderDialogState | null;
  /** Whether WhatsApp sending is configured at all (settings toggle + API credentials). */
  whatsappAvailable: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createReminderFn = useServerFn(createReminder);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [remindOn, setRemindOn] = useState(tomorrowIso());
  const [emailOn, setEmailOn] = useState(true);
  const [whatsappOn, setWhatsappOn] = useState(false);

  useEffect(() => {
    if (!state) return;
    setSelected(new Set(state.preselectedIds));
    setSearch("");
    setRemindOn(tomorrowIso());
    setEmailOn(true);
    setWhatsappOn(false);
  }, [state]);

  const debouncedSearch = useDebouncedValue(search, 200);
  const candidates = useMemo(() => state?.candidates ?? [], [state]);
  const visibleCandidates = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.tenantName.toLowerCase().includes(q));
  }, [candidates, debouncedSearch]);

  function reset(open: boolean) {
    onOpenChange(open);
  }

  function toggle(tenantId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tenantId);
      else next.delete(tenantId);
      return next;
    });
  }

  const selectedCandidates = candidates.filter((c) => selected.has(c.tenantId));
  const anyCanEmail = selectedCandidates.some((c) => c.hasEmail);
  const anyCanWhatsapp = whatsappAvailable && selectedCandidates.some((c) => c.hasPhone);

  function summarize(results: ScheduleReminderResult[]) {
    const failed = results.filter((r) => !r.email && !r.whatsapp);
    if (failed.length === 0) {
      const emailCount = results.filter((r) => r.email).length;
      const waCount = results.filter((r) => r.whatsapp).length;
      toast.success(
        `Reminder sent to ${results.length} tenant${results.length === 1 ? "" : "s"} - ${emailCount} email(s), ${waCount} WhatsApp.`,
      );
    } else {
      toast.warning(
        `${results.length - failed.length} of ${results.length} sent. ${failed.length} failed: ${failed
          .map((f) => f.reason ?? "failed")
          .join(", ")}`,
      );
    }
  }

  const send = useMutation({
    mutationFn: (mode: "now" | "schedule") => {
      if (selected.size === 0) throw new Error("Pick at least one tenant.");
      if (!emailOn && !whatsappOn) throw new Error("Pick email, WhatsApp, or both.");
      return createReminderFn({
        data: {
          tenantIds: Array.from(selected),
          billId: state?.billId ?? null,
          mode,
          remindOn,
          channels: { email: emailOn, whatsapp: whatsappOn },
        },
      });
    },
    onSuccess: (results, mode) => {
      if (mode === "now") {
        summarize(results);
      } else {
        toast.success(
          `Scheduled for ${results.length} tenant${results.length === 1 ? "" : "s"} on ${remindOn}.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["scheduled-reminders"] });
      reset(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(state)} onOpenChange={reset}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remind tenants</DialogTitle>
          <DialogDescription>
            Pick who to notify, then send now or schedule for a later date.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {candidates.length > 1 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search tenants"
                className="pl-8"
                placeholder="Search tenants"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            {visibleCandidates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No tenants match.</p>
            ) : (
              visibleCandidates.map((c) => (
                <label
                  key={c.tenantId}
                  className="flex cursor-pointer items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selected.has(c.tenantId)}
                      onChange={(e) => toggle(c.tenantId, e.target.checked)}
                    />
                    {c.tenantName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {!c.hasEmail && !c.hasPhone
                      ? "No email or phone on file"
                      : !c.hasEmail
                        ? "No email on file"
                        : !c.hasPhone
                          ? "No phone on file"
                          : ""}
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">{selected.size} tenant(s) selected</p>

          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <p className="text-sm font-medium">Email</p>
              <Switch
                aria-label="Notify by email"
                checked={emailOn}
                disabled={!anyCanEmail}
                onCheckedChange={setEmailOn}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                {!whatsappAvailable && (
                  <p className="text-xs text-muted-foreground">Not enabled in Settings.</p>
                )}
              </div>
              <Switch
                aria-label="Notify by WhatsApp"
                checked={whatsappOn}
                disabled={!anyCanWhatsapp}
                onCheckedChange={setWhatsappOn}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="reminder-date">Schedule for a later date (optional)</Label>
            <Input
              id="reminder-date"
              type="date"
              min={tomorrowIso()}
              value={remindOn}
              onChange={(e) => setRemindOn(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Only used by the "Schedule" button below - "Send now" always sends immediately.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => send.mutate("schedule")}
            disabled={send.isPending || selected.size === 0 || (!emailOn && !whatsappOn)}
          >
            {send.isPending ? "Saving…" : `Schedule for ${remindOn}`}
          </Button>
          <Button
            onClick={() => send.mutate("now")}
            disabled={send.isPending || selected.size === 0 || (!emailOn && !whatsappOn)}
          >
            {send.isPending ? "Sending…" : "Send now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
