import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, IndianRupee, Download, Trash2, Phone, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { effectiveRent, formatDate, formatMoney } from "@/lib/pg";
import { useDirectory } from "@/lib/use-directory";
import {
  balanceOf,
  deletePayment,
  displayStatus,
  monthLabel,
  STATUS_LABEL,
  STATUS_STYLE,
} from "@/lib/billing";
import { downloadBillPdf } from "@/lib/bill-pdf";
import { RecordPaymentDialog, type PaymentTarget } from "@/components/record-payment-dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BRAND } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/tenant/$tenantId")({
  head: () => ({
    meta: [
      { title: `Tenant ledger - ${BRAND}` },
      {
        name: "description",
        content:
          "Full billing history for a tenant: every bill, payment, balance and downloadable invoice.",
      },
      { property: "og:title", content: `Tenant ledger - ${BRAND}` },
      {
        property: "og:description",
        content: "Bills, payments and outstanding balance per tenant.",
      },
    ],
  }),
  component: TenantLedger,
  errorComponent: ({ error }) => (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Tenant not found.</p>,
});

function TenantLedger() {
  const { tenantId } = Route.useParams();
  const queryClient = useQueryClient();
  const directory = useDirectory();
  const [target, setTarget] = useState<PaymentTarget | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-ledger", tenantId],
    queryFn: async () => {
      const { data: bills, error } = await supabase
        .from("bills")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("bill_month", { ascending: false });
      if (error) throw error;
      const ids = bills.map((b) => b.id);
      const payments = ids.length
        ? await supabase
            .from("payments")
            .select("*")
            .in("bill_id", ids)
            .order("paid_at", { ascending: false })
        : { data: [], error: null };
      if (payments.error) throw payments.error;
      return { bills, payments: payments.data ?? [] };
    },
  });

  const removePayment = useMutation({
    mutationFn: ({ id, billId }: { id: string; billId: string }) => deletePayment(id, billId),
    onSuccess: () => {
      toast.success("Payment removed.");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || directory.isLoading) return <Skeleton className="h-64" />;

  const tenant = directory.tenantById.get(tenantId);
  if (!tenant) return <p className="text-sm text-muted-foreground">Tenant not found.</p>;
  const room = directory.roomById.get(tenant.room_id) ?? null;
  const property = room ? (directory.propertyById.get(room.property_id) ?? null) : null;

  const bills = data?.bills ?? [];
  const payments = data?.payments ?? [];
  const billed = bills.reduce((s, b) => s + Number(b.total_amount), 0);
  const paid = bills.reduce((s, b) => s + Number(b.paid_amount), 0);
  const outstanding = bills.reduce((s, b) => s + balanceOf(b), 0);

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/tenants">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Tenants
            </Link>
          </Button>
          <h1 className="page-title">{tenant.full_name}</h1>
          <p className="flex flex-wrap items-center gap-3 page-subtitle">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {tenant.phone}
            </span>
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5" />
              Room {room?.room_number ?? "-"}
              {property ? ` · ${property.name}` : ""}
            </span>
            <span>Rent {formatMoney(effectiveRent(tenant, room))}/month</span>
          </p>
        </div>
        <Badge
          variant="outline"
          className={tenant.status === "active" ? "" : "text-muted-foreground"}
        >
          {tenant.status}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total billed", value: formatMoney(billed), tone: "" },
          { label: "Total paid", value: formatMoney(paid), tone: "text-success" },
          { label: "Outstanding", value: formatMoney(outstanding), tone: "text-destructive" },
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
        <CardHeader>
          <CardTitle>Bills</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {bills.length === 0 ? (
            <EmptyState
              title="No bills yet"
              description="Bills generated for this tenant will be listed here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Electricity</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b) => {
                  const st = displayStatus(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{monthLabel(b.bill_month)}</TableCell>
                      <TableCell>{formatMoney(b.rent_amount)}</TableCell>
                      <TableCell>{formatMoney(b.electricity_amount)}</TableCell>
                      <TableCell>{formatMoney(b.total_amount)}</TableCell>
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
                              onClick={() => setTarget({ bill: b, tenantName: tenant.full_name })}
                            >
                              <IndianRupee className="mr-1 h-4 w-4" />
                              Record
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Download invoice"
                            onClick={() =>
                              downloadBillPdf(b, {
                                tenant,
                                room,
                                property,
                                monthLabel: monthLabel(b.bill_month),
                              })
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {payments.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Payments recorded against this tenant's bills will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid on</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paid_at)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.payment_method}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.transaction_ref || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete payment"
                        onClick={() => removePayment.mutate({ id: p.id, billId: p.bill_id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog target={target} onOpenChange={(o) => !o && setTarget(null)} />
    </div>
  );
}
