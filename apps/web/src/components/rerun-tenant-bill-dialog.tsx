import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, UserCog } from "lucide-react";
import { toast } from "sonner";

import { previewTenantBillFn, rerunTenantBillFn } from "@/lib/tenant-billing.functions";
import { formatDate, formatMoney } from "@/lib/pg";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TenantOption = { id: string; name: string; roomLabel: string };

type Props = {
  tenants: TenantOption[];
  months: string[];
  defaultMonth: string;
  monthLabel: (month: string) => string;
};

/** Recompute one tenant's bill for one month, without touching anyone else's. */
export function RerunTenantBillDialog({ tenants, months, defaultMonth, monthLabel }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [notify, setNotify] = useState(true);

  const previewFn = useServerFn(previewTenantBillFn);
  const rerunFn = useServerFn(rerunTenantBillFn);

  useEffect(() => {
    if (open) setMonth(defaultMonth);
  }, [open, defaultMonth]);

  const preview = useMutation({
    mutationFn: () => previewFn({ data: { tenantId, month } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rerun = useMutation({
    mutationFn: (force: boolean) => rerunFn({ data: { tenantId, month, force, notify } }),
    onSuccess: (r) => {
      toast.success(
        r.action === "updated"
          ? `Bill recalculated - new total ${formatMoney(r.totalAmount)}.`
          : `Bill created for ${monthLabel(month)} - ${formatMoney(r.totalAmount)}.`,
      );
      if (r.notified) {
        if (r.notified.email.sent) toast.success("Corrected bill sent by email.");
        else toast.warning(`Email: ${r.notified.email.reason}`);
      }
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger"] });
      setOpen(false);
      preview.reset();
      setTenantId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = preview.data;
  const stale = data && (data.tenantId !== tenantId || data.month !== month);
  const result = stale ? null : data;
  const hasPayments = (result?.existing?.paidAmount ?? 0) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) preview.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" variant="outline" size="sm">
          <UserCog className="mr-2 h-4 w-4" />
          Re-run for one tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-run billing for one tenant</DialogTitle>
          <DialogDescription>
            Recalculates rent and electricity for a single tenant and month using the current room
            rent, rent override, meter readings and settings. No other tenant&rsquo;s bill is
            touched.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.roomLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Bill month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={!tenantId || preview.isPending}
          onClick={() => preview.mutate()}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${preview.isPending ? "animate-spin" : ""}`} />
          {preview.isPending ? "Calculating…" : "Preview recalculated bill"}
        </Button>

        {result && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">
                {result.tenantName} · Room {result.roomNumber}
              </span>
              <Badge variant="outline">
                {result.existing ? "Existing bill will be updated" : "New bill will be created"}
              </Badge>
            </div>
            <dl className="space-y-1 text-muted-foreground">
              <Row label="Rent" value={formatMoney(result.rentAmount)} />
              <Row
                label={`Electricity (${result.electricityUnits} units @ ${formatMoney(result.electricityRate)})`}
                value={formatMoney(result.electricityAmount)}
              />
              {result.otherTotal !== 0 && (
                <Row label="Other charges (kept)" value={formatMoney(result.otherTotal)} />
              )}
              <Row label="Due date" value={formatDate(result.dueDate)} />
              <Row
                label="New total"
                value={formatMoney(result.totalAmount)}
                className="font-medium text-foreground"
              />
              {result.existing && (
                <Row
                  label="Current total"
                  value={`${formatMoney(result.existing.totalAmount)} · paid ${formatMoney(result.existing.paidAmount)}`}
                />
              )}
            </dl>
            {hasPayments && (
              <p className="mt-2 text-xs text-warning-foreground">
                This bill already has {formatMoney(result.existing!.paidAmount)} recorded. The paid
                amount is kept and the status is recalculated against the new total.
              </p>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <Label htmlFor="notify-tenant" className="text-sm">
              Notify the tenant
            </Label>
            <p className="text-xs text-muted-foreground">
              Emails the corrected bill to the tenant right after the re-run.
            </p>
          </div>
          <Switch id="notify-tenant" checked={notify} onCheckedChange={setNotify} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!result || rerun.isPending} onClick={() => rerun.mutate(hasPayments)}>
            {rerun.isPending
              ? "Saving…"
              : hasPayments
                ? "Confirm re-run (keeps payment)"
                : "Apply re-run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-4 ${className ?? ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
