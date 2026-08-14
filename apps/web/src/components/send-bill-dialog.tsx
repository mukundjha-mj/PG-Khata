import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { notifyBillsFn, type NotifyBillResult } from "@/lib/bill-notify.functions";

export type SendBillCandidate = {
  billId: string;
  tenantName: string;
  hasEmail: boolean;
  hasPhone: boolean;
};

export type SendBillDialogState = {
  candidates: SendBillCandidate[];
} | null;

export function SendBillDialog({
  state,
  whatsappAvailable,
  onOpenChange,
  onSent,
}: {
  state: SendBillDialogState;
  /** Whether WhatsApp sending is configured at all (settings toggle + API credentials). */
  whatsappAvailable: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful send, e.g. to clear the caller's bill selection. */
  onSent?: () => void;
}) {
  const notifyBillsServerFn = useServerFn(notifyBillsFn);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [emailOn, setEmailOn] = useState(true);
  const [whatsappOn, setWhatsappOn] = useState(false);

  useEffect(() => {
    if (!state) return;
    setSelected(new Set(state.candidates.map((c) => c.billId)));
    setSearch("");
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

  function toggle(billId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(billId);
      else next.delete(billId);
      return next;
    });
  }

  const selectedCandidates = candidates.filter((c) => selected.has(c.billId));
  const anyCanEmail = selectedCandidates.some((c) => c.hasEmail);
  const anyCanWhatsapp = whatsappAvailable && selectedCandidates.some((c) => c.hasPhone);

  function summarize(results: NotifyBillResult[]) {
    const failed = results.filter((r) => !r.email.sent && !r.whatsapp.sent);
    if (failed.length === 0) {
      const emailCount = results.filter((r) => r.email.sent).length;
      const waCount = results.filter((r) => r.whatsapp.sent).length;
      toast.success(
        `Notified ${results.length} tenant${results.length === 1 ? "" : "s"} - ${emailCount} email(s), ${waCount} WhatsApp.`,
      );
    } else {
      const names = failed
        .slice(0, 3)
        .map((f) => `${f.tenantName} (${f.email.reason ?? f.whatsapp.reason})`)
        .join(", ");
      toast.warning(
        `${results.length - failed.length} of ${results.length} notified. ${failed.length} failed: ${names}${failed.length > 3 ? "…" : ""}`,
      );
    }
  }

  const send = useMutation({
    mutationFn: () => {
      if (selected.size === 0) throw new Error("Pick at least one tenant.");
      if (!emailOn && !whatsappOn) throw new Error("Pick email, WhatsApp, or both.");
      return notifyBillsServerFn({
        data: {
          billIds: Array.from(selected),
          channels: { email: emailOn, whatsapp: whatsappOn },
        },
      });
    },
    onSuccess: (res) => {
      summarize(res.results);
      onSent?.();
      reset(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(state)} onOpenChange={reset}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send bill</DialogTitle>
          <DialogDescription>Pick who to notify, then choose email, WhatsApp, or both.</DialogDescription>
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
                  key={c.billId}
                  className="flex cursor-pointer items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selected.has(c.billId)}
                      onChange={(e) => toggle(c.billId, e.target.checked)}
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => send.mutate()}
            disabled={send.isPending || selected.size === 0 || (!emailOn && !whatsappOn)}
          >
            {send.isPending ? "Sending…" : "Send now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
