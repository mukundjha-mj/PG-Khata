import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  LogIn,
  NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { planTiers, type PlanKey } from "@/lib/pricing-plans";
import { setAccountPlan } from "@/lib/super-admin.functions";
import {
  getOwnerDetail,
  getOwnerQuickFacts,
  saveOwnerNote,
} from "@/lib/owner-detail.functions";

const PAGE_SIZE = 10;

export const inr = (n: number) =>
  "Rs. " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never";

const day = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "-";

type Account = {
  id: string;
  name: string;
  email: string;
  brand_name: string;
  plan: string;
  plan_status: string;
  pending_plan: string | null;
  current_period_end: string | null;
  created_at: string;
  properties: number;
  rooms: number;
  tenants: number;
};

function statusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "past_due" || status === "cancelled") return "destructive" as const;
  return "secondary" as const;
}

/** Searchable, filterable, paginated directory of every PG owner account. */
export function OwnerDirectory({
  accounts,
  isLoading,
}: {
  accounts: Account[];
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const savePlan = useServerFn(setAccountPlan);

  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [quickId, setQuickId] = useState<string | null>(null);

  const term = useDebouncedValue(search, 300).toLowerCase();

  const change = useMutation({
    mutationFn: (input: { adminId: string; plan: PlanKey; reason: string }) =>
      savePlan({ data: input }),
    onSuccess: () => {
      toast.success("Plan updated and logged");
      queryClient.invalidateQueries({ queryKey: ["platform-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["platform-audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["owner-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = accounts.filter((a) => {
      const matches =
        !term ||
        a.name.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        a.brand_name.toLowerCase().includes(term);
      return (
        matches && (plan === "all" || a.plan === plan) && (status === "all" || a.plan_status === status)
      );
    });
    const sorted = [...rows];
    if (sort === "newest") sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (sort === "oldest") sorted.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    if (sort === "tenants") sorted.sort((a, b) => b.tenants - a.tenants);
    if (sort === "name") sorted.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    return sorted;
  }, [accounts, term, plan, status, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const reset = () => {
    setSearch("");
    setPlan("all");
    setStatus("all");
    setSort("newest");
    setPage(1);
  };
  const filtersOn = !!search || plan !== "all" || status !== "all" || sort !== "newest";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          PG owner directory
        </h2>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {accounts.length} accounts
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search name, email, brand"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-11 sm:h-9"
          aria-label="Search owners"
        />
        <Select
          value={plan}
          onValueChange={(v) => {
            setPlan(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 sm:h-9" aria-label="Filter by plan">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {planTiers.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 sm:h-9" aria-label="Filter by subscription status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-11 sm:h-9" aria-label="Sort owners">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="tenants">Most tenants</SelectItem>
            <SelectItem value="name">Name A to Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtersOn ? (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9">
          Reset filters
        </Button>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No matching owners"
          description="Try a different search term or clear the filters."
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.name || a.brand_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{a.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.properties} properties - {a.rooms} rooms - {a.tenants} active tenants - joined{" "}
                      {day(a.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(a.plan_status)}>{a.plan_status}</Badge>
                    {a.pending_plan ? (
                      <Badge variant="outline">pending {a.pending_plan}</Badge>
                    ) : null}
                    <Select
                      value={a.plan}
                      onValueChange={(next) => {
                        const reason = window.prompt(
                          `Reason for changing ${a.email} to ${next} (saved to the audit log)`,
                        );
                        if (!reason || reason.trim().length < 4) {
                          toast.error("A reason of at least 4 characters is required");
                          return;
                        }
                        change.mutate({ adminId: a.id, plan: next as PlanKey, reason });
                      }}
                    >
                      <SelectTrigger className="h-11 w-36 md:h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {planTiers.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 md:h-9"
                    onClick={() => setQuickId(a.id)}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Quick actions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 md:h-9"
                    onClick={() => setDetailId(a.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Open owner
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Page {current} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 md:h-9"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 md:h-9"
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <QuickActionsDialog adminId={quickId} onClose={() => setQuickId(null)} />
      <OwnerDetailDialog adminId={detailId} onClose={() => setDetailId(null)} />
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/** Billing run dates, last login and subscription status. Each open is audit logged. */
function QuickActionsDialog({ adminId, onClose }: { adminId: string | null; onClose: () => void }) {
  const load = useServerFn(getOwnerQuickFacts);
  const { data, isLoading } = useQuery({
    queryKey: ["owner-quick-facts", adminId],
    queryFn: () => load({ data: { adminId: adminId as string } }),
    enabled: !!adminId,
  });

  return (
    <Dialog open={!!adminId} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick actions</DialogTitle>
          <DialogDescription>
            Opening this panel is recorded in the audit log as a view event.
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <LogIn className="h-3.5 w-3.5" /> Access
              </p>
              <Row label="Last login" value={when(data.lastLoginAt)} />
              <Row label="Email confirmed" value={data.emailConfirmed ? "Yes" : "No"} />
            </div>
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" /> Subscription
              </p>
              <Row
                label="Status"
                value={<Badge variant={statusVariant(data.planStatus)}>{data.planStatus}</Badge>}
              />
              <Row label="Plan" value={data.plan} />
              {data.pendingPlan ? <Row label="Pending change" value={data.pendingPlan} /> : null}
              <Row label="Current period" value={`${day(data.periodStart)} to ${day(data.periodEnd)}`} />
              <Row
                label="Last payment"
                value={
                  data.lastPaymentAt
                    ? `${inr(data.lastPaymentAmount)} on ${day(data.lastPaymentAt)}`
                    : "None"
                }
              />
            </div>
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> Billing runs
              </p>
              {data.billingRuns.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No bills generated yet.</p>
              ) : (
                data.billingRuns.map((r) => (
                  <Row
                    key={r.billMonth}
                    label={`${r.billMonth} - ${r.bills} bills`}
                    value={when(r.lastCreatedAt)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Full owner record with editable support notes. Each open is audit logged. */
function OwnerDetailDialog({ adminId, onClose }: { adminId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getOwnerDetail);
  const save = useServerFn(saveOwnerNote);
  const [note, setNote] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["owner-detail", adminId],
    queryFn: () => load({ data: { adminId: adminId as string } }),
    enabled: !!adminId,
  });

  const saveNote = useMutation({
    mutationFn: (value: string) => save({ data: { adminId: adminId as string, note: value } }),
    onSuccess: () => {
      toast.success("Support note saved");
      queryClient.invalidateQueries({ queryKey: ["owner-detail", adminId] });
      queryClient.invalidateQueries({ queryKey: ["platform-audit-log"] });
      setNote(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => {
    setNote(null);
    onClose();
  };

  return (
    <Dialog open={!!adminId} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        {isLoading || !data ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{data.account.name || data.account.brandName}</DialogTitle>
              <DialogDescription>
                {data.account.email}
                {data.account.phone ? ` - ${data.account.phone}` : ""} - joined{" "}
                {day(data.account.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Properties", value: String(data.portfolio.properties.length) },
                  { label: "Rooms", value: String(data.portfolio.roomCount) },
                  { label: "Active tenants", value: String(data.portfolio.activeTenants) },
                  { label: "Occupancy", value: `${data.portfolio.occupancyRate}%` },
                ].map((c) => (
                  <Card key={c.label}>
                    <CardContent className="p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {c.label}
                      </p>
                      <p className="subsection-title mt-1">{c.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div>
                <h3 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Properties
                </h3>
                {data.portfolio.properties.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No properties yet.</p>
                ) : (
                  data.portfolio.properties.map((p) => (
                    <Row
                      key={p.id}
                      label={`${p.name}${p.city ? ` - ${p.city}` : ""}`}
                      value={`${p.rooms} rooms - ${p.tenants} tenants`}
                    />
                  ))
                )}
              </div>

              <Separator />

              <div>
                <h3 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Subscription
                </h3>
                <Row
                  label="Status"
                  value={
                    <Badge variant={statusVariant(data.quick.planStatus)}>
                      {data.quick.planStatus}
                    </Badge>
                  }
                />
                <Row label="Plan" value={data.quick.plan} />
                <Row label="Renews" value={day(data.quick.periodEnd)} />
                <Row label="Last login" value={when(data.quick.lastLoginAt)} />
                <p className="mt-3 mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Plan change history
                </p>
                {data.subscription.history.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No plan changes yet.</p>
                ) : (
                  data.subscription.history.map((h) => (
                    <Row
                      key={h.id}
                      label={`${h.from_plan} to ${h.to_plan} - ${day(h.created_at)}`}
                      value={inr(h.amount)}
                    />
                  ))
                )}
                <p className="mt-3 mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Plan payments
                </p>
                {data.subscription.payments.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No payments recorded.</p>
                ) : (
                  data.subscription.payments.map((p) => (
                    <Row
                      key={p.id}
                      label={`${p.target_plan} - ${p.status} - ${day(p.created_at)}`}
                      value={inr(p.amount)}
                    />
                  ))
                )}
              </div>

              <Separator />

              <div>
                <h3 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Notifications and usage
                </h3>
                <Row label="Notifications sent" value={String(data.usage.notificationsTotal)} />
                <Row label="Last 30 days" value={String(data.usage.notifications30d)} />
                <Row label="Last notification" value={when(data.usage.lastNotificationAt)} />
                {data.usage.byChannel.map((c) => (
                  <Row key={c.channel} label={`Channel: ${c.channel}`} value={String(c.count)} />
                ))}
                {data.usage.byStatus.map((s) => (
                  <Row key={s.status} label={`Delivery: ${s.status}`} value={String(s.count)} />
                ))}
                <Row label="Bills generated" value={String(data.usage.billsTotal)} />
                <Row label="Billed lifetime" value={inr(data.usage.billedLifetime)} />
                <Row label="Collected lifetime" value={inr(data.usage.collectedLifetime)} />
                <Row label="Outstanding" value={inr(data.usage.outstanding)} />
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <NotebookPen className="h-3.5 w-3.5" /> Support notes
                </h3>
                <Textarea
                  rows={4}
                  value={note ?? data.supportNote.note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Private notes for the platform team about this owner"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {data.supportNote.updated_at
                      ? `Last edited ${when(data.supportNote.updated_at)} by ${data.supportNote.updated_by_email}`
                      : "No notes saved yet"}
                  </p>
                  <Button
                    className="h-11 md:h-9"
                    disabled={note === null || saveNote.isPending}
                    onClick={() => saveNote.mutate(note ?? "")}
                  >
                    Save note
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
