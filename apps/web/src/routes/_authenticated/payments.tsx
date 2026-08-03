import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Search, ArrowRight, FileDown, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { sendPaymentReminders } from "@/lib/reminders.functions";
import { formatDate, formatMoney } from "@/lib/pg";
import { useDirectory } from "@/lib/use-directory";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  balanceOf,
  displayStatus,
  downloadCsv,
  STATUS_LABEL,
  STATUS_STYLE,
  monthLabel,
  type Bill,
} from "@/lib/billing";
import { DataPagination, usePagination } from "@/components/data-pagination";
import { ResponsiveTable, TableSkeleton } from "@/components/responsive-table";
import { DensityToggle } from "@/components/density-toggle";
import { EmptyState } from "@/components/empty-state";
import { useDensity } from "@/lib/use-density";
import { RecordPaymentDialog, type PaymentTarget } from "@/components/record-payment-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments & dues - PG Manager" },
      {
        name: "description",
        content:
          "Record tenant payments, track partial payments and see every outstanding or overdue bill at a glance.",
      },
      { property: "og:title", content: "Payments & dues - PG Manager" },
      { property: "og:description", content: "Outstanding dues and payment history for your PG." },
    ],
  }),
  component: PaymentsPage,
});

type Filter = "outstanding" | "overdue" | "all";

function PaymentsPage() {
  const directory = useDirectory();
  const [filter, setFilter] = useState<Filter>("outstanding");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<PaymentTarget | null>(null);
  const [reminding, setReminding] = useState(false);
  const sendReminders = useServerFn(sendPaymentReminders);

  async function runReminders() {
    setReminding(true);
    try {
      const res = await sendReminders({ data: {} });
      if (res.matched === 0) {
        toast.info("No reminders due today.", {
          description: `${res.candidates} open bill(s) checked.`,
        });
      } else {
        toast.success(`Reminders sent for ${res.matched} bill(s).`, {
          description: `Emails sent: ${res.emailSent}`,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reminder run failed");
    } finally {
      setReminding(false);
    }
  }

  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("paid_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  const nameOf = (bill: Bill) => directory.tenantById.get(bill.tenant_id)?.full_name ?? "Tenant";

  const debouncedSearch = useDebouncedValue(search, 250);

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (bills ?? []).filter((b) => {
      const st = displayStatus(b);
      if (filter === "outstanding" && st === "paid") return false;
      if (filter === "overdue" && st !== "overdue") return false;
      if (!q) return true;
      return nameOf(b).toLowerCase().includes(q) || b.bill_month.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, filter, debouncedSearch, directory.tenantById]);

  const outstanding = (bills ?? []).reduce((s, b) => s + balanceOf(b), 0);
  const overdueTotal = (bills ?? [])
    .filter((b) => displayStatus(b) === "overdue")
    .reduce((s, b) => s + balanceOf(b), 0);
  const collected = (bills ?? []).reduce((s, b) => s + Number(b.paid_amount), 0);

  const billById = new Map((bills ?? []).map((b) => [b.id, b]));

  const billsPage = usePagination(rows, 10);
  const { density, setDensity } = useDensity("payments");
  const paymentsPage = usePagination(payments ?? [], 10);

  const loading = isLoading || directory.isLoading;

  const chips = [
    ...(filter !== "outstanding"
      ? [
          {
            label: filter === "overdue" ? "Overdue only" : "All bills",
            onClear: () => setFilter("outstanding" as Filter),
          },
        ]
      : []),
    ...(search.trim() ? [{ label: `Search: ${search.trim()}`, onClear: () => setSearch("") }] : []),
  ];

  function resetFilters() {
    setFilter("outstanding");
    setSearch("");
  }

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Payments &amp; dues</h1>
          <p className="page-subtitle">
            Record what tenants pay - partial payments update the bill balance automatically.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          onClick={() => runReminders()}
          disabled={reminding}
        >
          <BellRing className="mr-2 h-4 w-4" />
          {reminding ? "Sending reminders…" : "Send reminders now"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="stat-label">Total outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">{formatMoney(outstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="stat-label">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value text-destructive">{formatMoney(overdueTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="stat-label">Collected all time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value text-success">{formatMoney(collected)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>
            Bills{" "}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {rows.length} shown
            </span>
          </CardTitle>
          <FilterBar
            sticky={false}
            label="Search & filter bills"
            className="sm:w-auto"
            chips={chips}
            onReset={resetFilters}
            quickChips={[
              {
                label: "Outstanding",
                active: filter === "outstanding",
                onSelect: () => setFilter("outstanding"),
              },
              {
                label: "Overdue only",
                active: filter === "overdue",
                onSelect: () => setFilter("overdue"),
              },
              { label: "All bills", active: filter === "all", onSelect: () => setFilter("all") },
            ]}
          >
            <div className="relative sm:w-48">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search bills by tenant or month"
                className="w-full pl-8"
                placeholder="Tenant or 2026-08"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter bills by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outstanding">Outstanding</SelectItem>
                <SelectItem value="overdue">Overdue only</SelectItem>
                <SelectItem value="all">All bills</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv("dues.csv", [
                  ["Tenant", "Month", "Total", "Paid", "Balance", "Due date", "Status"],
                  ...rows.map((b) => [
                    nameOf(b),
                    b.bill_month,
                    Number(b.total_amount),
                    Number(b.paid_amount),
                    balanceOf(b),
                    b.due_date ?? "",
                    STATUS_LABEL[displayStatus(b)],
                  ]),
                ])
              }
            >
              <FileDown className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </FilterBar>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} columns={6} density={density} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No bills to collect"
              description="Issue bills from the Billing screen, or reset the filters to see paid bills too."
              actionLabel="Reset filters"
              onAction={resetFilters}
            />
          ) : (
            <>
              <div className="mb-2 md:hidden">
                <DensityToggle density={density} onChange={setDensity} />
              </div>
              <ResponsiveTable
                labels={["Tenant", "Month", "Total", "Paid", "Balance", "Due", "Status", ""]}
                density={density}
                compactColumns={3}
                virtualize
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billsPage.pageRows.map((b) => {
                      const st = displayStatus(b);
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">
                            <Link
                              to="/tenant/$tenantId"
                              params={{ tenantId: b.tenant_id }}
                              className="inline-block py-1.5 hover:underline"
                            >
                              {nameOf(b)}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {monthLabel(b.bill_month)}
                          </TableCell>
                          <TableCell>{formatMoney(b.total_amount)}</TableCell>
                          <TableCell>{formatMoney(b.paid_amount)}</TableCell>
                          <TableCell className="font-medium">{formatMoney(balanceOf(b))}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(b.due_date)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_STYLE[st]}>
                              {STATUS_LABEL[st]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {balanceOf(b) > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setTarget({ bill: b, tenantName: nameOf(b) })}
                                >
                                  <IndianRupee className="mr-1 h-4 w-4" />
                                  Record
                                </Button>
                              )}
                              <Button asChild size="sm" variant="ghost">
                                <Link to="/tenant/$tenantId" params={{ tenantId: b.tenant_id }}>
                                  Ledger <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </>
          )}
          <DataPagination
            page={billsPage.page}
            pageCount={billsPage.pageCount}
            from={billsPage.from}
            to={billsPage.to}
            total={billsPage.total}
            onPageChange={billsPage.setPage}
            label="bills"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : (payments ?? []).length === 0 ? (
            <EmptyState
              title="No payments recorded yet"
              description="Record a payment against a bill and it will show up here."
            />
          ) : (
            <ResponsiveTable
              labels={["Tenant", "Amount", "Method", "Reference", "Paid on"]}
              virtualize
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Paid on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsPage.pageRows.map((p) => {
                    const bill = billById.get(p.bill_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {bill ? nameOf(bill) : "Tenant"}
                        </TableCell>
                        <TableCell>{formatMoney(p.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.payment_method}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.transaction_ref || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(p.paid_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
          <DataPagination
            page={paymentsPage.page}
            pageCount={paymentsPage.pageCount}
            from={paymentsPage.from}
            to={paymentsPage.to}
            total={paymentsPage.total}
            onPageChange={paymentsPage.setPage}
            label="payments"
          />
        </CardContent>
      </Card>

      <RecordPaymentDialog target={target} onOpenChange={(o) => !o && setTarget(null)} />
    </div>
  );
}
