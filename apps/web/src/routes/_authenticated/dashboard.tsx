import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DoorOpen,
  Users,
  IndianRupee,
  Clock,
  ArrowRight,
  Receipt,
  UserPlus,
  AlertTriangle,
  Plus,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getScheduledReminders, cancelReminderFn } from "@/lib/reminders.functions";
import { getMyWhatsAppQuotaStatus } from "@/lib/plan.functions";
import { PersonalReminderDialog } from "@/components/personal-reminder-dialog";
import { PropertyScopeSwitcher } from "@/components/property-scope-switcher";
import { usePropertyScope } from "@/lib/property-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { MessageSquareWarning } from "lucide-react";
import { effectiveRent, formatDate, formatMoney, occupancyOf } from "@/lib/pg";
import {
  balanceOf,
  currentMonth,
  displayStatus,
  monthLabel,
  STATUS_LABEL,
  STATUS_STYLE,
  type Bill,
  type DisplayStatus,
} from "@/lib/billing";
import { BRAND } from "@/lib/site";

const MS_PER_DAY = 86_400_000;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `Dashboard - ${BRAND}` },
      {
        name: "description",
        content: "Occupancy, tenant count and expected monthly collection for your PG properties.",
      },
      { property: "og:title", content: `Dashboard - ${BRAND}` },
      { property: "og:description", content: "Occupancy and collection overview for your PGs." },
    ],
  }),
  component: Dashboard,
});

function useOverview(propertyId: string | null) {
  const month = currentMonth();
  return useQuery({
    queryKey: ["overview", month, propertyId],
    queryFn: async () => {
      let propertiesQuery = supabase.from("properties").select("*").order("name");
      let roomsQuery = supabase.from("rooms").select("*");
      let billsQuery = supabase.from("bills").select("*").eq("bill_month", month);
      if (propertyId) {
        propertiesQuery = propertiesQuery.eq("id", propertyId);
        roomsQuery = roomsQuery.eq("property_id", propertyId);
        billsQuery = billsQuery.eq("property_id", propertyId);
      }
      const [properties, rooms, tenants, bills] = await Promise.all([
        propertiesQuery,
        roomsQuery,
        supabase.from("tenants").select("*"),
        billsQuery,
      ]);
      if (properties.error) throw properties.error;
      if (rooms.error) throw rooms.error;
      if (tenants.error) throw tenants.error;
      if (bills.error) throw bills.error;
      const roomIds = new Set(rooms.data.map((r) => r.id));
      const scopedTenants = propertyId
        ? tenants.data.filter((t) => roomIds.has(t.room_id))
        : tenants.data;
      return {
        properties: properties.data,
        rooms: rooms.data,
        tenants: scopedTenants,
        bills: bills.data,
        month,
      };
    },
  });
}

function useOpenComplaintsCount(propertyId: string | null) {
  return useQuery({
    queryKey: ["complaints-open-count", propertyId],
    queryFn: async () => {
      let query = supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .neq("status", "resolved");
      if (propertyId) query = query.eq("property_id", propertyId);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Bills past their due date with a balance still owed, across every month -
 * not just the current billing cycle. A bill that went overdue last month is
 * exactly what this card exists to surface, so it can't be scoped to
 * `currentMonth()` the way `useOverview` is.
 */
function useOverdueBills(propertyId: string | null) {
  return useQuery({
    queryKey: ["overdue-bills", propertyId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase.from("bills").select("*").lt("due_date", today).gt("total_amount", 0);
      if (propertyId) query = query.eq("property_id", propertyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter((b) => balanceOf(b) > 0);
    },
  });
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="shadow-none transition-colors hover:border-foreground/15">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="stat-label">{label}</CardTitle>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="stat-value">{value}</p>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { selectedPropertyId } = usePropertyScope();
  const { data, isLoading, isError, refetch } = useOverview(selectedPropertyId);
  const { data: openComplaints } = useOpenComplaintsCount(selectedPropertyId);
  const { data: overdueBills } = useOverdueBills(selectedPropertyId);
  const queryClient = useQueryClient();
  const getScheduledRemindersFn = useServerFn(getScheduledReminders);
  const cancelReminderServerFn = useServerFn(cancelReminderFn);
  const getQuotaStatus = useServerFn(getMyWhatsAppQuotaStatus);
  const [personalReminderOpen, setPersonalReminderOpen] = useState(false);
  const { data: scheduledReminders } = useQuery({
    queryKey: ["scheduled-reminders"],
    queryFn: () => getScheduledRemindersFn(),
  });
  // Shares the "whatsapp-quota-status" query key with Settings, so both read
  // the same cached value instead of issuing a duplicate request.
  const { data: quota } = useQuery({
    queryKey: ["whatsapp-quota-status"],
    queryFn: () => getQuotaStatus({}),
  });
  const dismissReminder = useMutation({
    mutationFn: (id: string) => cancelReminderServerFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reminders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const today = new Date().toISOString().slice(0, 10);
  const remindersDue = (scheduledReminders ?? []).filter((r) => r.remindOn <= today);

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load your dashboard"
        description="Something went wrong fetching your properties and bills. Check your connection and try again."
        actionLabel="Try again"
        onAction={() => refetch()}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const activeTenants = data.tenants.filter((t) => t.status === "active");
  const roomById = new Map(data.rooms.map((r) => [r.id, r]));
  const occupiedByRoom = new Map<string, number>();
  for (const t of activeTenants) {
    occupiedByRoom.set(t.room_id, (occupiedByRoom.get(t.room_id) ?? 0) + 1);
  }
  const vacantRooms = data.rooms.filter((r) => (occupiedByRoom.get(r.id) ?? 0) === 0).length;
  const occupiedRooms = data.rooms.length - vacantRooms;
  const beds = data.rooms.reduce((sum, r) => sum + r.capacity, 0);
  const expected = activeTenants.reduce(
    (sum, t) => sum + effectiveRent(t, roomById.get(t.room_id)),
    0,
  );

  const thisMonth = data.month;
  const monthBills = data.bills;
  const billed = monthBills.reduce((s, b) => s + Number(b.total_amount), 0);
  const collected = monthBills.reduce((s, b) => s + Number(b.paid_amount), 0);
  const outstanding = monthBills.reduce((s, b) => s + balanceOf(b), 0);
  const collectedPct = billed > 0 ? Math.round((collected / billed) * 100) : 0;
  const occupancyPct = data.rooms.length > 0 ? Math.round((occupiedRooms / data.rooms.length) * 100) : 0;
  const counts: Record<DisplayStatus, number> = {
    paid: 0,
    pending: 0,
    "partially-paid": 0,
    overdue: 0,
  };
  for (const b of monthBills) counts[displayStatus(b)] += 1;

  const tenantNameById = new Map(data.tenants.map((t) => [t.id, t.full_name]));
  const now = Date.now();
  const daysOverdue = (b: Bill) =>
    b.due_date ? Math.floor((now - new Date(b.due_date).getTime()) / MS_PER_DAY) : 0;
  const overdueSorted = [...(overdueBills ?? [])].sort((a, b) => daysOverdue(b) - daysOverdue(a));

  return (
    <div className="page-stack">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Property Performance Dashboard</h1>
          <p className="page-subtitle">Overview of your properties, occupancy and expected rent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/payments">
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Record payment
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/tenants">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add tenant
            </Link>
          </Button>
        </div>
      </div>

      <PropertyScopeSwitcher />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Collected this month"
          value={formatMoney(collected)}
          hint={billed > 0 ? `${collectedPct}% of ${formatMoney(billed)} billed` : "No bills yet"}
          icon={IndianRupee}
        />
        <Stat
          label="Pending collection"
          value={formatMoney(outstanding)}
          hint={monthBills.length > 0 ? `${counts.overdue} overdue this month` : "Nothing billed yet"}
          icon={Receipt}
        />
        <Stat
          label="Occupancy"
          value={`${occupiedRooms} / ${data.rooms.length}`}
          hint={data.rooms.length > 0 ? `${occupancyPct}% occupied` : "No rooms yet"}
          icon={DoorOpen}
        />
        <Stat
          label="Active tenants"
          value={String(activeTenants.length)}
          hint={`${beds} beds across ${data.rooms.length} rooms`}
          icon={Users}
        />
      </div>

      <Card className={overdueSorted.length > 0 ? "border-destructive/40 bg-destructive/5" : ""}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {overdueSorted.length > 0
                ? `${overdueSorted.length} bill${overdueSorted.length === 1 ? "" : "s"} overdue`
                : "Overdue"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Bills past their due date with a balance still owed, across every month.
            </p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/payments">
              Payments <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {overdueSorted.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing overdue right now.</p>
          )}
          {overdueSorted.slice(0, 5).map((b) => {
            const overdueDays = daysOverdue(b);
            return (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="truncate">
                  <span className="font-medium">{tenantNameById.get(b.tenant_id) ?? "Tenant"}</span>
                  <span className="text-muted-foreground"> - {monthLabel(b.bill_month)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-destructive">{formatMoney(balanceOf(b))}</span>
                  <span className="text-xs text-muted-foreground">
                    {overdueDays} day{overdueDays === 1 ? "" : "s"} overdue
                  </span>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/payments">Record</Link>
                  </Button>
                </span>
              </div>
            );
          })}
          {overdueSorted.length > 5 && (
            <p className="pt-1 text-center text-xs text-muted-foreground">
              +{overdueSorted.length - 5} more
            </p>
          )}
        </CardContent>
      </Card>

      <Card className={remindersDue.length > 0 ? "border-warning/40 bg-warning/5" : ""}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>
              {remindersDue.length > 0
                ? `${remindersDue.length} reminder${remindersDue.length === 1 ? "" : "s"} due`
                : "Reminders due"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Tenant reminders go out with tonight&apos;s run - personal notes just wait here until
              you dismiss them.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPersonalReminderOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Set reminder
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/payments">
                Payments <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {remindersDue.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing due right now.</p>
          )}
          {remindersDue.slice(0, 5).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="truncate">
                <span className="font-medium">{r.tenantName}</span>
                {r.note && <span className="text-muted-foreground"> - {r.note}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground">{formatDate(r.remindOn)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={dismissReminder.isPending}
                  onClick={() => dismissReminder.mutate(r.id)}
                >
                  Dismiss
                </Button>
              </span>
            </div>
          ))}
          {remindersDue.length > 5 && (
            <p className="pt-1 text-center text-xs text-muted-foreground">
              +{remindersDue.length - 5} more
            </p>
          )}
        </CardContent>
      </Card>

      <PersonalReminderDialog
        open={personalReminderOpen}
        tenants={activeTenants.map((t) => ({ id: t.id, fullName: t.full_name }))}
        onOpenChange={setPersonalReminderOpen}
      />

      {quota && quota.limit !== null ? (
        <Card className={quota.remaining === 0 ? "border-warning/40 bg-warning/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              WhatsApp quota
            </CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/settings">
                Settings <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Sent this month</span>
              <span className="font-medium tabular-nums">
                {quota.used} / {quota.limit}
              </span>
            </div>
            <Progress value={Math.min(100, (quota.used / quota.limit) * 100)} />
            {quota.remaining === 0 ? (
              <p className="text-xs text-destructive">
                Quota reached - new WhatsApp sends are skipped until next month or an upgrade.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{quota.remaining} messages left.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card
        className={openComplaints && openComplaints > 0 ? "border-warning/40 bg-warning/5" : ""}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
            {openComplaints
              ? `${openComplaints} open complaint${openComplaints === 1 ? "" : "s"}`
              : "Complaints"}
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link to="/complaints">
              View <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        {(!openComplaints || openComplaints === 0) && (
          <CardContent>
            <p className="text-sm text-muted-foreground">Nothing open right now.</p>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <h2 className="section-title">Occupancy by room</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/rooms">
                Manage <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rooms.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No rooms yet. Add a property, then its rooms.
              </p>
            )}
            {data.rooms.slice(0, 8).map((room) => {
              const occ = occupiedByRoom.get(room.id) ?? 0;
              const state = occupancyOf(occ, room.capacity);
              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">Room {room.room_number}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground">
                      {occ}/{room.capacity}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        state === "full"
                          ? "border-transparent bg-success/15 text-success"
                          : state === "partial"
                            ? "border-transparent bg-warning/20 text-warning-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      {state === "full" ? "Full" : state === "partial" ? "Partial" : "Vacant"}
                    </Badge>
                  </span>
                </div>
              );
            })}
            {data.rooms.length > 8 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                +{data.rooms.length - 8} more room{data.rooms.length - 8 === 1 ? "" : "s"} -{" "}
                <Link to="/rooms" className="underline underline-offset-4">
                  view all
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <h2 className="section-title">Collections - {monthLabel(thisMonth)}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/payments">
                Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {monthBills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bills generated for this month yet.{" "}
                <Link to="/bills" className="underline underline-offset-4">
                  Generate bills
                </Link>
                .
              </p>
            ) : (
              <>
                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(collected)} / {formatMoney(billed)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${collectedPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {collectedPct}% of billed amount collected
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["paid", "pending", "partially-paid", "overdue"] as const).map((status) => (
                    <div
                      key={status}
                      className={`rounded-md border border-border p-3 ${STATUS_STYLE[status]}`}
                    >
                      <p className="stat-label">{STATUS_LABEL[status]}</p>
                      <p className="subsection-title">{counts[status]}</p>
                    </div>
                  ))}
                </div>

                {outstanding > 0 && (
                  <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                    <span className="text-sm font-medium text-destructive">
                      Outstanding this month
                    </span>
                    <span className="stat-value text-destructive">{formatMoney(outstanding)}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
