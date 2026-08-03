import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/pg";
import { useDirectory } from "@/lib/use-directory";
import {
  balanceOf,
  currentMonth,
  displayStatus,
  downloadCsv,
  monthLabel,
  monthOptions,
  STATUS_LABEL,
} from "@/lib/billing";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DataPagination, usePagination } from "@/components/data-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable, TableSkeleton } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import { PlanGate } from "@/components/plan-gate";
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

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports - PG Manager" },
      {
        name: "description",
        content:
          "Monthly collection reports: billed vs collected, overdue amounts and property-wise breakdown with CSV export.",
      },
      { property: "og:title", content: "Reports - PG Manager" },
      { property: "og:description", content: "Collection performance across your PG properties." },
    ],
  }),
  component: GatedReportsPage,
});

function GatedReportsPage() {
  return (
    <PlanGate min="scale" feature="Reports and analytics">
      <ReportsPage />
    </PlanGate>
  );
}

function ReportsPage() {
  const directory = useDirectory();
  const [month, setMonth] = useState(currentMonth());

  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").order("bill_month");
      if (error) throw error;
      return data;
    },
  });

  const monthBills = useMemo(
    () => (bills ?? []).filter((b) => b.bill_month === month),
    [bills, month],
  );

  const billed = monthBills.reduce((s, b) => s + Number(b.total_amount), 0);
  const collected = monthBills.reduce((s, b) => s + Number(b.paid_amount), 0);
  const outstanding = monthBills.reduce((s, b) => s + balanceOf(b), 0);
  const overdue = monthBills
    .filter((b) => displayStatus(b) === "overdue")
    .reduce((s, b) => s + balanceOf(b), 0);
  const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const byProperty = useMemo(() => {
    const map = new Map<
      string,
      { name: string; billed: number; collected: number; count: number }
    >();
    for (const b of monthBills) {
      const name = directory.propertyById.get(b.property_id)?.name ?? "Unassigned";
      const row = map.get(b.property_id) ?? { name, billed: 0, collected: 0, count: 0 };
      row.billed += Number(b.total_amount);
      row.collected += Number(b.paid_amount);
      row.count += 1;
      map.set(b.property_id, row);
    }
    return [...map.values()].sort((a, b) => b.billed - a.billed);
  }, [monthBills, directory.propertyById]);

  const trend = useMemo(() => {
    const map = new Map<string, { billed: number; collected: number }>();
    for (const b of bills ?? []) {
      const row = map.get(b.bill_month) ?? { billed: 0, collected: 0 };
      row.billed += Number(b.total_amount);
      row.collected += Number(b.paid_amount);
      map.set(b.bill_month, row);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [bills]);

  const propertyPage = usePagination(byProperty, 8);

  const loading = isLoading || directory.isLoading;

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Collection performance for the selected month, by property and over time.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <Select value={month} onValueChange={setMonth}>
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
            variant="outline"
            disabled={monthBills.length === 0}
            onClick={() =>
              downloadCsv(`collection-${month}.csv`, [
                ["Tenant", "Property", "Total", "Paid", "Balance", "Due date", "Status"],
                ...monthBills.map((b) => [
                  directory.tenantById.get(b.tenant_id)?.full_name ?? "Tenant",
                  directory.propertyById.get(b.property_id)?.name ?? "",
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
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Billed", value: formatMoney(billed), tone: "" },
          { label: "Collected", value: formatMoney(collected), tone: "text-success" },
          { label: "Outstanding", value: formatMoney(outstanding), tone: "" },
          { label: "Overdue", value: formatMoney(overdue), tone: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="stat-label">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`stat-value ${s.tone}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Collection rate - {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={rate} />
          <p className="text-sm text-muted-foreground">
            {rate}% collected · {monthBills.length} bill{monthBills.length === 1 ? "" : "s"} issued
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By property</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={4} columns={5} />
            ) : byProperty.length === 0 ? (
              <EmptyState
                title="No bills for this month"
                description="Pick a different month, or generate and issue bills from the Billing screen."
              />
            ) : (
              <ResponsiveTable
                labels={["Property", "Bills", "Billed", "Collected", "Rate"]}
                virtualize
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Bills</TableHead>
                      <TableHead>Billed</TableHead>
                      <TableHead>Collected</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propertyPage.pageRows.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.count}</TableCell>
                        <TableCell>{formatMoney(r.billed)}</TableCell>
                        <TableCell>{formatMoney(r.collected)}</TableCell>
                        <TableCell className="text-right">
                          {r.billed > 0 ? Math.round((r.collected / r.billed) * 100) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )}
            <DataPagination
              page={propertyPage.page}
              pageCount={propertyPage.pageCount}
              from={propertyPage.from}
              to={propertyPage.to}
              total={propertyPage.total}
              onPageChange={propertyPage.setPage}
              label="properties"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <CardTitle>Last 6 months</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {trend.length === 0 ? (
              <EmptyState
                title="No billing history yet"
                description="Once you issue bills, monthly collection trends appear here."
              />
            ) : (
              trend.map(([m, v]) => {
                const pct = v.billed > 0 ? Math.round((v.collected / v.billed) * 100) : 0;
                return (
                  <div key={m} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{monthLabel(m)}</span>
                      <span className="text-muted-foreground">
                        {formatMoney(v.collected)} / {formatMoney(v.billed)}
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
