import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, DoorOpen, Users, IndianRupee, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { effectiveRent, formatMoney, occupancyOf } from "@/lib/pg";
import {
  balanceOf,
  currentMonth,
  displayStatus,
  monthLabel,
  type DisplayStatus,
} from "@/lib/billing";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - PG Manager" },
      {
        name: "description",
        content: "Occupancy, tenant count and expected monthly collection for your PG properties.",
      },
      { property: "og:title", content: "Dashboard - PG Manager" },
      { property: "og:description", content: "Occupancy and collection overview for your PGs." },
    ],
  }),
  component: Dashboard,
});

function useOverview() {
  const month = currentMonth();
  return useQuery({
    queryKey: ["overview", month],
    queryFn: async () => {
      const [properties, rooms, tenants, bills] = await Promise.all([
        supabase.from("properties").select("*").order("name"),
        supabase.from("rooms").select("*"),
        supabase.from("tenants").select("*"),
        supabase.from("bills").select("*").eq("bill_month", month),
      ]);
      if (properties.error) throw properties.error;
      if (rooms.error) throw rooms.error;
      if (tenants.error) throw tenants.error;
      if (bills.error) throw bills.error;
      return {
        properties: properties.data,
        rooms: rooms.data,
        tenants: tenants.data,
        bills: bills.data,
        month,
      };
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
  const { data, isLoading } = useOverview();

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
  const counts: Record<DisplayStatus, number> = {
    paid: 0,
    pending: 0,
    "partially-paid": 0,
    overdue: 0,
  };
  for (const b of monthBills) counts[displayStatus(b)] += 1;


  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">Property Performance Dashboard</h1>
        <p className="page-subtitle">
          Overview of your properties, occupancy and expected rent.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active tenants"
          value={String(activeTenants.length)}
          hint={`${beds} beds across ${data.rooms.length} rooms`}
          icon={Users}
        />
        <Stat
          label="Occupied rooms"
          value={`${occupiedRooms} / ${data.rooms.length}`}
          hint={`${vacantRooms} vacant`}
          icon={DoorOpen}
        />
        <Stat
          label="Properties"
          value={String(data.properties.length)}
          hint="PGs under management"
          icon={Building2}
        />
        <Stat
          label="Expected monthly rent"
          value={formatMoney(expected)}
          hint="Rent only - electricity added at billing"
          icon={IndianRupee}
        />
      </div>

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
                  <span className="font-medium">Room {room.room_number}</span>
                  <span className="flex items-center gap-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <h2 className="section-title">
              Collections - {monthLabel(thisMonth)}
            </h2>
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
                  <div className="rounded-md border border-border p-3">
                    <p className="stat-label">Paid</p>
                    <p className="subsection-title text-foreground">{counts.paid}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="stat-label">Pending</p>
                    <p className="subsection-title text-foreground">{counts.pending}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="stat-label">Partial</p>
                    <p className="subsection-title text-foreground">
                      {counts["partially-paid"]}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="stat-label">Overdue</p>
                    <p className="subsection-title text-foreground">{counts.overdue}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Outstanding this month:{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(outstanding)}
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
