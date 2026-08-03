import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Download, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { tierByKey } from "@/lib/pricing-plans";
import { rupees } from "@/lib/plan-proration";
import { useBranding } from "@/lib/branding";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  downloadPlanReceipt,
  receiptDate,
  receiptLines,
  receiptNumber,
  receiptTitle,
  type PlanChangeRow,
} from "@/lib/plan-receipt";

export const Route = createFileRoute("/_authenticated/plan-history")({
  head: () => ({
    meta: [
      { title: "Plan change history - PG Manager" },
      {
        name: "description",
        content: "Every upgrade and downgrade on your account with dates, amounts, receipts and the plans you moved between.",
      },
      { property: "og:title", content: "Plan change history - PG Manager" },
      { property: "og:description", content: "Audit trail and receipts for your PG Manager subscription changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanHistoryPage,
});

type Row = PlanChangeRow;

function PlanHistoryPage() {
  const branding = useBranding();
  const { user } = useCurrentUser();
  const [active, setActive] = useState<Row | null>(null);

  const party = {
    brandName: branding.brandName,
    accountName: (user?.user_metadata?.["name"] as string | undefined) ?? null,
    accountEmail: user?.email ?? null,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["plan-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Plan change history</h1>
          <p className="page-subtitle">
            Every upgrade and downgrade, what you moved from and to, what it cost, and a receipt for each change.
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 md:h-9">
          <Link to="/plan">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to plan
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No plan changes yet"
          description="When you upgrade or downgrade, the change is recorded here with the date, amount and a downloadable receipt."
        />
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {tierByKey(row.from_plan).name}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {tierByKey(row.to_plan).name}
                  <Badge variant={row.direction === "upgrade" ? "default" : "secondary"}>
                    {row.direction === "upgrade" ? "Upgrade" : "Downgrade"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                    <p className="font-medium">{receiptDate(row.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Charged</p>
                    <p className="font-medium">{rupees(Number(row.amount))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Credit applied</p>
                    <p className="font-medium">{rupees(Number(row.credit_applied))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt no.</p>
                    <p className="font-medium">{receiptNumber(row)}</p>
                  </div>
                </div>
                {row.note ? <p className="text-muted-foreground">{row.note}</p> : null}
                {row.payment_id ? (
                  <p className="text-xs text-muted-foreground">Payment reference: {row.payment_id}</p>
                ) : null}
                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <Button
                    variant="outline"
                    className="h-11 md:h-9"
                    onClick={() => setActive(row)}
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    View receipt
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11 md:h-9"
                    onClick={() => downloadPlanReceipt(row, party)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>{receiptTitle(active)}</DialogTitle>
                <DialogDescription>
                  {receiptNumber(active)} - {receiptDate(active.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
                  <p className="font-medium">{party.accountName || "Account owner"}</p>
                  <p className="text-muted-foreground">{party.accountEmail || "-"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Issued by {party.brandName}</p>
                </div>

                <div className="divide-y rounded-lg border">
                  {receiptLines(active).map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-3 p-3">
                      <span className="text-muted-foreground">{line.label}</span>
                      <span className="font-medium">{line.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 bg-muted/40 p-3">
                    <span className="font-semibold">Amount charged</span>
                    <span className="font-semibold">{rupees(Number(active.amount))}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {active.payment_id
                    ? `Paid online. Payment reference ${active.payment_id}.`
                    : "No payment was collected for this change."}{" "}
                  This receipt is computer generated and valid without a signature.
                </p>
              </div>

              <DialogFooter>
                <Button className="h-11 md:h-9" onClick={() => downloadPlanReceipt(active, party)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
