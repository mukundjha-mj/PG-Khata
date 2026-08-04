import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap, ReceiptText, Trash2, CheckCircle2, Download, FileDown, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { effectiveRent, formatDate, formatMoney } from "@/lib/pg";
import { downloadBillPdf, downloadMonthPdf, type Bill, type BillContext } from "@/lib/bill-pdf";
import { balanceOf, recordPayment } from "@/lib/billing";
import { generateMonthlyBills } from "@/lib/billing-run.functions";
import { RerunTenantBillDialog } from "@/components/rerun-tenant-bill-dialog";
import { DataPagination, usePagination } from "@/components/data-pagination";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/filter-bar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable, TableSkeleton } from "@/components/responsive-table";
import { DensityToggle } from "@/components/density-toggle";
import { EmptyState } from "@/components/empty-state";
import { useDensity } from "@/lib/use-density";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({
    meta: [
      { title: "Billing - PG Manager" },
      {
        name: "description",
        content:
          "Generate monthly rent and electricity bills, review drafts before saving, and track payment status.",
      },
      { property: "og:title", content: "Billing - PG Manager" },
      {
        property: "og:description",
        content: "Draft, review and issue monthly PG bills in one place.",
      },
    ],
  }),
  component: BillsPage,
});

type DraftBill = {
  tenant_id: string;
  tenant_name: string;
  room_number: string;
  property_id: string;
  rent_amount: number;
  electricity_units: number;
  electricity_amount: number;
  other_charges: number;
  include: boolean;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions() {
  const out: string[] = [];
  const now = new Date();
  for (let i = -1; i < 11; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function cycleFor(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_STYLE: Record<string, string> = {
  paid: "border-transparent bg-success/15 text-success",
  "partially-paid": "border-transparent bg-warning/20 text-warning-foreground",
  overdue: "border-transparent bg-destructive/15 text-destructive",
  pending: "text-muted-foreground",
};

function BillsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [drafts, setDrafts] = useState<DraftBill[] | null>(null);
  const [billSearch, setBillSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const runBilling = useServerFn(generateMonthlyBills);

  const { data, isLoading } = useQuery({
    queryKey: ["billing-base"],
    queryFn: async () => {
      const [tenants, rooms, properties, settings] = await Promise.all([
        supabase.from("tenants").select("*").order("full_name"),
        supabase.from("rooms").select("*"),
        supabase.from("properties").select("*").order("name"),
        supabase.from("settings").select("*").maybeSingle(),
      ]);
      if (tenants.error) throw tenants.error;
      if (rooms.error) throw rooms.error;
      if (properties.error) throw properties.error;
      if (settings.error) throw settings.error;
      return {
        tenants: tenants.data,
        rooms: rooms.data,
        properties: properties.data,
        settings: settings.data,
      };
    },
  });

  const { data: bills, isLoading: billsLoading } = useQuery({
    queryKey: ["bills", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("bill_month", month)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const cycle = cycleFor(month);
  const { data: readings } = useQuery({
    queryKey: ["readings-cycle", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("electricity_readings")
        .select("*")
        .gte("reading_date", cycle.start)
        .lte("reading_date", cycle.end)
        .order("reading_date");
      if (error) throw error;
      return data;
    },
  });

  /** Units logged per room inside the billing cycle. */
  const unitsByRoom = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of readings ?? []) {
      const units = Number(r.units_consumed_since_previous ?? 0);
      if (units > 0) map.set(r.room_id, (map.get(r.room_id) ?? 0) + units);
    }
    return map;
  }, [readings]);

  const activeTenants = useMemo(
    () => (data?.tenants ?? []).filter((t) => t.status === "active"),
    [data],
  );
  const tenantById = useMemo(() => new Map((data?.tenants ?? []).map((t) => [t.id, t])), [data]);
  const tenantName = useMemo(
    () => new Map((data?.tenants ?? []).map((t) => [t.id, t.full_name])),
    [data],
  );
  const roomById = useMemo(() => new Map((data?.rooms ?? []).map((r) => [r.id, r])), [data]);
  const propertyById = useMemo(
    () => new Map((data?.properties ?? []).map((p) => [p.id, p])),
    [data],
  );
  const propertyName = useMemo(
    () => new Map((data?.properties ?? []).map((p) => [p.id, p.name])),
    [data],
  );

  const billedTenantIds = useMemo(() => new Set((bills ?? []).map((b) => b.tenant_id)), [bills]);

  const rate = Number(data?.settings?.electricity_rate_per_unit ?? 0);
  const dueOffset = Number(data?.settings?.due_date_offset_days ?? 10);

  function pdfContext(bill: Bill): BillContext {
    const tenant = tenantById.get(bill.tenant_id) ?? null;
    return {
      tenant,
      room: tenant ? (roomById.get(tenant.room_id) ?? null) : null,
      property: propertyById.get(bill.property_id) ?? null,
      monthLabel: monthLabel(bill.bill_month),
    };
  }

  function buildDrafts() {
    if (!data) return;
    const pending = activeTenants.filter((t) => !billedTenantIds.has(t.id));
    if (pending.length === 0) {
      toast.info(`Every active tenant already has a bill for ${monthLabel(month)}.`);
      return;
    }
    // Split each room's logged units evenly across the tenants being billed for it.
    const tenantsPerRoom = new Map<string, number>();
    for (const t of pending) {
      tenantsPerRoom.set(t.room_id, (tenantsPerRoom.get(t.room_id) ?? 0) + 1);
    }
    setDrafts(
      pending.map((t) => {
        const room = roomById.get(t.room_id);
        const roomUnits = unitsByRoom.get(t.room_id) ?? 0;
        const share = tenantsPerRoom.get(t.room_id) || 1;
        const units = Math.round((roomUnits / share) * 100) / 100;
        return {
          tenant_id: t.id,
          tenant_name: t.full_name,
          room_number: room?.room_number ?? "-",
          property_id: room?.property_id ?? "",
          rent_amount: effectiveRent(t, room),
          electricity_units: units,
          electricity_amount: Math.round(units * rate * 100) / 100,
          other_charges: 0,
          include: true,
        };
      }),
    );
  }

  function patchDraft(id: string, patch: Partial<DraftBill>) {
    setDrafts((prev) =>
      prev
        ? prev.map((d) => {
            if (d.tenant_id !== id) return d;
            const next = { ...d, ...patch };
            if (patch.electricity_units !== undefined) {
              next.electricity_amount = Math.round(patch.electricity_units * rate * 100) / 100;
            }
            return next;
          })
        : prev,
    );
  }

  const selected = (drafts ?? []).filter((d) => d.include);
  const draftTotal = selected.reduce(
    (s, d) => s + d.rent_amount + d.electricity_amount + d.other_charges,
    0,
  );

  const saveBills = useMutation({
    mutationFn: async () => {
      const { start, end } = cycleFor(month);
      const rows = selected
        .filter((d) => d.property_id)
        .map((d) => ({
          tenant_id: d.tenant_id,
          property_id: d.property_id,
          bill_month: month,
          billing_cycle_start: start,
          billing_cycle_end: end,
          rent_amount: d.rent_amount,
          electricity_amount: d.electricity_amount,
          electricity_units_consumed: d.electricity_units || null,
          other_charges:
            d.other_charges > 0 ? [{ label: "Other charges", amount: d.other_charges }] : [],
          total_amount: d.rent_amount + d.electricity_amount + d.other_charges,
          due_date: addDays(end, dueOffset),
          status: "pending" as const,
        }));
      if (rows.length === 0) throw new Error("Nothing selected to bill.");
      const { error } = await supabase.from("bills").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} bill${count === 1 ? "" : "s"} issued for ${monthLabel(month)}.`);
      setDrafts(null);
      queryClient.invalidateQueries({ queryKey: ["bills", month] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    // Writing paid_amount straight onto the bill leaves no payments row, so the
    // ledger and the bill disagree — and the next recorded payment re-syncs
    // paid_amount from payments alone, silently erasing this amount. Settle the
    // outstanding balance through the ledger instead.
    mutationFn: async (bill: { id: string; total_amount: number; paid_amount: number }) => {
      const balance = balanceOf(bill);
      if (balance <= 0) throw new Error("Nothing left to pay on this bill.");
      await recordPayment({
        billId: bill.id,
        amount: balance,
        // The shortcut never asks how the tenant paid; guessing would put a
        // wrong method in the owner's ledger.
        method: "other",
        paidAt: new Date().toISOString().slice(0, 10),
        notes: "Marked paid from the bills list",
      });
    },
    onSuccess: () => {
      toast.success("Bill marked as paid.");
      queryClient.invalidateQueries({ queryKey: ["bills", month] });
      queryClient.invalidateQueries({ queryKey: ["payments-recent"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill deleted.");
      queryClient.invalidateQueries({ queryKey: ["bills", month] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingApproval = useMemo(() => (bills ?? []).filter((b) => b.approved === false), [bills]);

  const approveBills = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("bills")
        .update({ approved: true, approved_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} bill${count === 1 ? "" : "s"} approved.`);
      queryClient.invalidateQueries({ queryKey: ["bills", month] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issuedTotal = (bills ?? []).reduce((s, b) => s + Number(b.total_amount), 0);

  const autoRun = useMutation({
    mutationFn: (m: string) => runBilling({ data: { month: m } }),
    onSuccess: (r) => {
      if (r.created > 0)
        toast.success(`${r.created} bill(s) issued, ${r.skipped} already existed.`);
      else toast.info(`Nothing new - ${r.skipped} tenant(s) already billed for this month.`);
      queryClient.invalidateQueries({ queryKey: ["bills", month] });
      setDrafts(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const debouncedBillSearch = useDebouncedValue(billSearch, 250);

  const visibleBills = useMemo(() => {
    const q = debouncedBillSearch.trim().toLowerCase();
    return (bills ?? []).filter((b) => {
      const name = (tenantName.get(b.tenant_id) ?? "").toLowerCase();
      const matchesText = q === "" || name.includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "unapproved" ? b.approved === false : b.status === statusFilter);
      return matchesText && matchesStatus;
    });
  }, [bills, debouncedBillSearch, statusFilter, tenantName]);

  const issuedPage = usePagination(visibleBills, 10);
  const { density, setDensity } = useDensity("bills");
  const draftsPage = usePagination(drafts ?? [], 10);

  const billChips = [
    ...(statusFilter !== "all"
      ? [{ label: `Status: ${statusFilter}`, onClear: () => setStatusFilter("all") }]
      : []),
    ...(billSearch.trim()
      ? [{ label: `Search: ${billSearch.trim()}`, onClear: () => setBillSearch("") }]
      : []),
  ];

  function resetBillFilters() {
    setStatusFilter("all");
    setBillSearch("");
  }

  if (isLoading) return <TableSkeleton rows={6} columns={6} density={density} className="p-1" />;

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">
            Bills run automatically on the 1st of each month. You can also draft and review a run
            here, or issue the whole month in one click.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Billing month</Label>
            <Select
              value={month}
              onValueChange={(v) => {
                setMonth(v);
                setDrafts(null);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions().map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={buildDrafts}
            disabled={!data || data.tenants.length === 0}
          >
            <Zap className="mr-2 h-4 w-4" />
            Draft &amp; review
          </Button>
          <RerunTenantBillDialog
            tenants={(data?.tenants ?? []).map((t) => ({
              id: t.id,
              name: t.full_name,
              roomLabel: `Room ${roomById.get(t.room_id)?.room_number ?? "-"}`,
            }))}
            months={monthOptions()}
            defaultMonth={month}
            monthLabel={monthLabel}
          />
          <Button
            className="w-full sm:w-auto"
            onClick={() => autoRun.mutate(month)}
            disabled={autoRun.isPending}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            {autoRun.isPending ? "Running…" : "Run monthly billing"}
          </Button>
        </div>
      </div>

      {pendingApproval.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div>
              <CardTitle>
                {pendingApproval.length} bill{pendingApproval.length === 1 ? "" : "s"} awaiting your
                approval
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Created by the automatic monthly run. Reminders and invoices stay on hold until you
                approve them - review the amounts below, then approve or delete.
              </p>
            </div>
            <Button
              size="sm"
              disabled={approveBills.isPending}
              onClick={() => approveBills.mutate(pendingApproval.map((b) => b.id))}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve all
            </Button>
          </CardHeader>
        </Card>
      )}

      {drafts && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <CardTitle>
              Draft run - {monthLabel(month)}{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {selected.length} of {drafts.length} selected · {formatMoney(draftTotal)}
              </span>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDrafts(null)}>
                Discard
              </Button>
              <Button
                size="sm"
                onClick={() => saveBills.mutate()}
                disabled={selected.length === 0 || saveBills.isPending}
              >
                <ReceiptText className="mr-2 h-4 w-4" />
                Issue {selected.length} bill{selected.length === 1 ? "" : "s"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              labels={["Bill", "Tenant", "Room", "Rent", "Units", "Electricity", "Other", "Total"]}
              virtualize
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Bill</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead className="w-32">Rent</TableHead>
                    <TableHead className="w-28">Units</TableHead>
                    <TableHead className="w-32">Electricity</TableHead>
                    <TableHead className="w-32">Other</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftsPage.pageRows.map((d) => (
                    <TableRow key={d.tenant_id} className={d.include ? "" : "opacity-50"}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Include ${d.tenant_name}`}
                          className="h-4 w-4 accent-primary"
                          checked={d.include}
                          onChange={(e) => patchDraft(d.tenant_id, { include: e.target.checked })}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{d.tenant_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.room_number}
                        {d.property_id && (
                          <span className="ml-1 text-xs">· {propertyName.get(d.property_id)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={d.rent_amount}
                          onChange={(e) =>
                            patchDraft(d.tenant_id, { rent_amount: Number(e.target.value) || 0 })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={d.electricity_units}
                          onChange={(e) =>
                            patchDraft(d.tenant_id, {
                              electricity_units: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={d.electricity_amount}
                          onChange={(e) =>
                            patchDraft(d.tenant_id, {
                              electricity_amount: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={d.other_charges}
                          onChange={(e) =>
                            patchDraft(d.tenant_id, { other_charges: Number(e.target.value) || 0 })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(d.rent_amount + d.electricity_amount + d.other_charges)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
            <DataPagination
              page={draftsPage.page}
              pageCount={draftsPage.pageCount}
              from={draftsPage.from}
              to={draftsPage.to}
              total={draftsPage.total}
              onPageChange={draftsPage.setPage}
              label="draft bills"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Electricity is priced at {formatMoney(rate)}/unit and due dates are set {dueOffset}{" "}
              days after the cycle ends - both come from Settings.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>
            Issued bills - {monthLabel(month)}{" "}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {(bills ?? []).length} bills · {formatMoney(issuedTotal)}
            </span>
          </CardTitle>
          <FilterBar
            sticky={false}
            label="Search & filter bills"
            className="sm:w-auto"
            chips={billChips}
            onReset={resetBillFilters}
            quickChips={[
              {
                label: "All",
                active: statusFilter === "all",
                onSelect: () => setStatusFilter("all"),
              },
              {
                label: "Pending",
                active: statusFilter === "pending",
                onSelect: () => setStatusFilter("pending"),
              },
              {
                label: "Paid",
                active: statusFilter === "paid",
                onSelect: () => setStatusFilter("paid"),
              },
              {
                label: "Partial",
                active: statusFilter === "partial",
                onSelect: () => setStatusFilter("partial"),
              },
              {
                label: "Awaiting approval",
                active: statusFilter === "unapproved",
                onSelect: () => setStatusFilter("unapproved"),
              },
            ]}
          >
            <div className="relative sm:w-44">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search issued bills by tenant"
                className="w-full pl-8"
                placeholder="Search tenant"
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter bills by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unapproved">Awaiting approval</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={(bills ?? []).length === 0}
              onClick={() => {
                downloadMonthPdf(bills ?? [], pdfContext, month);
                toast.success(`Exported ${(bills ?? []).length} bills as PDF.`);
              }}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export all as PDF
            </Button>
          </FilterBar>
        </CardHeader>
        <CardContent>
          {billsLoading ? (
            <TableSkeleton rows={5} columns={6} density={density} />
          ) : (bills ?? []).length === 0 ? (
            <EmptyState
              title="No bills issued for this month"
              description="Use “Generate bills now” to create a draft run, review the charges, then issue them."
            />
          ) : visibleBills.length === 0 ? (
            <EmptyState
              title="No bills match your filters"
              description="Clear the search or pick a different status to see the rest of this month's bills."
              actionLabel="Reset filters"
              onAction={resetBillFilters}
            />
          ) : (
            <>
              <div className="mb-2 md:hidden">
                <DensityToggle density={density} onChange={setDensity} />
              </div>
              <ResponsiveTable
                labels={["Tenant", "Rent", "Electricity", "Total", "Due", "Status", ""]}
                density={density}
                compactColumns={3}
                virtualize
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Rent</TableHead>
                      <TableHead>Electricity</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issuedPage.pageRows.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">
                          {tenantName.get(b.tenant_id) ?? "Tenant"}
                          {b.approved === false && (
                            <button
                              type="button"
                              className="ml-2 rounded border border-warning/50 bg-warning/15 px-1.5 py-0.5 text-[11px] font-normal text-warning-foreground"
                              disabled={approveBills.isPending}
                              onClick={() => approveBills.mutate([b.id])}
                              title="Click to approve this bill"
                            >
                              Awaiting approval
                            </button>
                          )}
                        </TableCell>
                        <TableCell>{formatMoney(b.rent_amount)}</TableCell>
                        <TableCell>{formatMoney(b.electricity_amount)}</TableCell>
                        <TableCell className="font-medium">{formatMoney(b.total_amount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(b.due_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLE[b.status] ?? ""}>
                            {b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {b.status !== "paid" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  markPaid.mutate({
                                    id: b.id,
                                    total_amount: Number(b.total_amount),
                                    paid_amount: Number(b.paid_amount),
                                  })
                                }
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Mark paid
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Download PDF"
                              onClick={() => downloadBillPdf(b, pdfContext(b))}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete bill"
                              onClick={() => deleteBill.mutate(b.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </>
          )}
          <DataPagination
            page={issuedPage.page}
            pageCount={issuedPage.pageCount}
            from={issuedPage.from}
            to={issuedPage.to}
            total={issuedPage.total}
            onPageChange={issuedPage.setPage}
            label="bills"
          />
        </CardContent>
      </Card>
    </div>
  );
}
