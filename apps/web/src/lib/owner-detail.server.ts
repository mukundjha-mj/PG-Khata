import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { BRAND } from "@/lib/site";

type Admin = SupabaseClient<Database>;

/** Every room id that belongs to an owner, via their properties. */
async function ownerScope(db: Admin, adminId: string) {
  const { data: props, error: propErr } = await db
    .from("properties")
    .select("id, name, city, address, created_at")
    .eq("admin_id", adminId)
    .order("created_at");
  if (propErr) throw new Error("Unable to load properties");

  const propertyIds = (props ?? []).map((p) => p.id);
  const { data: rooms, error: roomErr } = propertyIds.length
    ? await db.from("rooms").select("id, property_id, capacity").in("property_id", propertyIds)
    : { data: [], error: null };
  if (roomErr) throw new Error("Unable to load rooms");

  return { properties: props ?? [], rooms: rooms ?? [], propertyIds };
}

export type OwnerTenantRow = {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  roomNumber: string;
  propertyName: string;
  monthlyRent: number;
  joiningDate: string;
  vacatedDate: string | null;
};

/** Every tenant across an owner's properties, newest first. Read-only support view. */
export async function loadOwnerTenants(db: Admin, adminId: string): Promise<OwnerTenantRow[]> {
  const { properties, propertyIds } = await ownerScope(db, adminId);
  if (!propertyIds.length) return [];

  const { data: rooms, error: roomErr } = await db
    .from("rooms")
    .select("id, room_number, monthly_rent, property_id")
    .in("property_id", propertyIds);
  if (roomErr) throw new Error("Unable to load rooms");

  const roomIds = (rooms ?? []).map((r) => r.id);
  if (!roomIds.length) return [];

  const { data: tenants, error } = await db
    .from("tenants")
    .select(
      "id, full_name, phone, status, room_id, joining_date, vacated_date, monthly_rent_override, created_at",
    )
    .in("room_id", roomIds)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error("Unable to load tenants");

  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const roomInfo = new Map((rooms ?? []).map((r) => [r.id, r]));

  return (tenants ?? []).map((t) => {
    const room = roomInfo.get(t.room_id);
    return {
      id: t.id,
      fullName: t.full_name,
      phone: t.phone,
      status: t.status,
      roomNumber: room?.room_number ?? "-",
      propertyName: room ? (propertyName.get(room.property_id) ?? "-") : "-",
      monthlyRent: Number(t.monthly_rent_override ?? room?.monthly_rent ?? 0),
      joiningDate: t.joining_date,
      vacatedDate: t.vacated_date,
    };
  });
}

export type OwnerRoomRow = {
  id: string;
  roomNumber: string;
  propertyName: string;
  roomType: string;
  capacity: number;
  monthlyRent: number;
  occupied: number;
};

/** Every room across an owner's properties, with live occupancy. Read-only support view. */
export async function loadOwnerRooms(db: Admin, adminId: string): Promise<OwnerRoomRow[]> {
  const { properties, propertyIds } = await ownerScope(db, adminId);
  if (!propertyIds.length) return [];

  const { data: rooms, error } = await db
    .from("rooms")
    .select("id, room_number, room_type, capacity, monthly_rent, property_id")
    .in("property_id", propertyIds)
    .order("room_number");
  if (error) throw new Error("Unable to load rooms");

  const roomIds = (rooms ?? []).map((r) => r.id);
  const { data: tenants } = roomIds.length
    ? await db.from("tenants").select("room_id, status").in("room_id", roomIds)
    : { data: [] };

  const occupiedCount = new Map<string, number>();
  for (const t of tenants ?? []) {
    if (t.status !== "active") continue;
    occupiedCount.set(t.room_id, (occupiedCount.get(t.room_id) ?? 0) + 1);
  }
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));

  return (rooms ?? []).map((r) => ({
    id: r.id,
    roomNumber: r.room_number,
    propertyName: propertyName.get(r.property_id) ?? "-",
    roomType: r.room_type,
    capacity: r.capacity,
    monthlyRent: Number(r.monthly_rent ?? 0),
    occupied: occupiedCount.get(r.id) ?? 0,
  }));
}

export type OwnerBillRow = {
  id: string;
  tenantName: string;
  propertyName: string;
  billMonth: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

/** Newest 300 bills across an owner's properties. Read-only support view. */
export async function loadOwnerBills(db: Admin, adminId: string): Promise<OwnerBillRow[]> {
  const { properties, propertyIds } = await ownerScope(db, adminId);
  if (!propertyIds.length) return [];

  const { data: bills, error } = await db
    .from("bills")
    .select(
      "id, tenant_id, property_id, bill_month, total_amount, paid_amount, status, due_date, created_at",
    )
    .in("property_id", propertyIds)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error("Unable to load bills");

  const tenantIds = [...new Set((bills ?? []).map((b) => b.tenant_id))];
  const { data: tenants } = tenantIds.length
    ? await db.from("tenants").select("id, full_name").in("id", tenantIds)
    : { data: [] };

  const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));

  return (bills ?? []).map((b) => ({
    id: b.id,
    tenantName: tenantName.get(b.tenant_id) ?? "-",
    propertyName: propertyName.get(b.property_id) ?? "-",
    billMonth: b.bill_month,
    totalAmount: Number(b.total_amount ?? 0),
    paidAmount: Number(b.paid_amount ?? 0),
    status: b.status,
    dueDate: b.due_date,
    createdAt: b.created_at,
  }));
}

export type OwnerPaymentRow = {
  id: string;
  tenantName: string;
  propertyName: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  transactionRef: string | null;
};

/** Newest 300 payments across an owner's properties. Read-only support view. */
export async function loadOwnerPaymentsList(
  db: Admin,
  adminId: string,
): Promise<OwnerPaymentRow[]> {
  const { properties, propertyIds } = await ownerScope(db, adminId);
  if (!propertyIds.length) return [];

  const { data: bills, error: billErr } = await db
    .from("bills")
    .select("id, tenant_id, property_id")
    .in("property_id", propertyIds);
  if (billErr) throw new Error("Unable to load bills");

  const billIds = (bills ?? []).map((b) => b.id);
  if (!billIds.length) return [];

  const { data: payments, error } = await db
    .from("payments")
    .select("id, bill_id, amount, payment_method, paid_at, transaction_ref")
    .in("bill_id", billIds)
    .order("paid_at", { ascending: false })
    .limit(300);
  if (error) throw new Error("Unable to load payments");

  const tenantIds = [...new Set((bills ?? []).map((b) => b.tenant_id))];
  const { data: tenants } = tenantIds.length
    ? await db.from("tenants").select("id, full_name").in("id", tenantIds)
    : { data: [] };

  const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const billInfo = new Map((bills ?? []).map((b) => [b.id, b]));

  return (payments ?? []).map((p) => {
    const bill = billInfo.get(p.bill_id);
    return {
      id: p.id,
      tenantName: bill ? (tenantName.get(bill.tenant_id) ?? "-") : "-",
      propertyName: bill ? (propertyName.get(bill.property_id) ?? "-") : "-",
      amount: Number(p.amount ?? 0),
      paymentMethod: p.payment_method,
      paidAt: p.paid_at,
      transactionRef: p.transaction_ref,
    };
  });
}

export type OwnerComplaintRow = {
  id: string;
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  note: string;
  status: string;
  phone: string;
  createdAt: string;
};

/** Newest 300 complaints for an owner, across every property. Read-only support view. */
export async function loadOwnerComplaints(
  db: Admin,
  adminId: string,
): Promise<OwnerComplaintRow[]> {
  const { data, error } = await db
    .from("complaints")
    .select("id, tenant_name, property_id, room_number, note, status, phone, created_at")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error("Unable to load complaints");

  const propertyIds = [...new Set((data ?? []).map((c) => c.property_id))];
  const { data: properties } = propertyIds.length
    ? await db.from("properties").select("id, name").in("id", propertyIds)
    : { data: [] };
  const propertyName = new Map((properties ?? []).map((p) => [p.id, p.name]));

  return (data ?? []).map((c) => ({
    id: c.id,
    tenantName: c.tenant_name,
    propertyName: propertyName.get(c.property_id) ?? "-",
    roomNumber: c.room_number,
    note: c.note,
    status: c.status,
    phone: c.phone,
    createdAt: c.created_at,
  }));
}

export type QuickFacts = {
  adminId: string;
  email: string;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  emailConfirmed: boolean;
  planStatus: string;
  plan: string;
  pendingPlan: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  lastPaymentAt: string | null;
  lastPaymentAmount: number;
  /** Newest billing runs: the months bills were created for, most recent first. */
  billingRuns: {
    billMonth: string;
    bills: number;
    firstCreatedAt: string;
    lastCreatedAt: string;
  }[];
};

/** Small, fast per-owner facts for the directory quick actions. */
export async function loadQuickFacts(db: Admin, adminId: string): Promise<QuickFacts> {
  const [{ rooms }, settings, authUser, adminRow] = await Promise.all([
    ownerScope(db, adminId),
    db
      .from("settings")
      .select(
        "plan, plan_status, pending_plan, current_period_start, current_period_end, last_payment_at, last_payment_amount",
      )
      .eq("admin_id", adminId)
      .maybeSingle(),
    db.auth.admin.getUserById(adminId),
    db.from("admins").select("email").eq("id", adminId).maybeSingle(),
  ]);

  const roomIds = rooms.map((r) => r.id);
  const { data: tenants } = roomIds.length
    ? await db.from("tenants").select("id").in("room_id", roomIds)
    : { data: [] };
  const tenantIds = (tenants ?? []).map((t) => t.id);

  const { data: bills } = tenantIds.length
    ? await db
        .from("bills")
        .select("bill_month, created_at")
        .in("tenant_id", tenantIds)
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [] };

  const runs = new Map<string, { bills: number; first: string; last: string }>();
  for (const b of bills ?? []) {
    const cur = runs.get(b.bill_month);
    if (!cur) runs.set(b.bill_month, { bills: 1, first: b.created_at, last: b.created_at });
    else {
      cur.bills += 1;
      if (b.created_at < cur.first) cur.first = b.created_at;
      if (b.created_at > cur.last) cur.last = b.created_at;
    }
  }

  const user = authUser.data?.user;
  return {
    adminId,
    email: adminRow.data?.email ?? user?.email ?? "",
    lastLoginAt: user?.last_sign_in_at ?? null,
    lastSeenAt: (user as { last_sign_in_at?: string } | undefined)?.last_sign_in_at ?? null,
    emailConfirmed: !!user?.email_confirmed_at,
    plan: settings.data?.plan ?? "starter",
    planStatus: settings.data?.plan_status ?? "trial",
    pendingPlan: settings.data?.pending_plan ?? null,
    periodStart: settings.data?.current_period_start ?? null,
    periodEnd: settings.data?.current_period_end ?? null,
    lastPaymentAt: settings.data?.last_payment_at ?? null,
    lastPaymentAmount: Number(settings.data?.last_payment_amount ?? 0),
    billingRuns: [...runs.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6)
      .map(([billMonth, v]) => ({
        billMonth,
        bills: v.bills,
        firstCreatedAt: v.first,
        lastCreatedAt: v.last,
      })),
  };
}

export type OwnerDetail = {
  account: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    created_at: string;
    brandName: string;
  };
  quick: QuickFacts;
  portfolio: {
    properties: { id: string; name: string; city: string; rooms: number; tenants: number }[];
    roomCount: number;
    capacity: number;
    activeTenants: number;
    vacatedTenants: number;
    occupancyRate: number;
  };
  subscription: {
    history: {
      id: string;
      from_plan: string;
      to_plan: string;
      direction: string;
      amount: number;
      credit_applied: number;
      note: string;
      created_at: string;
    }[];
    payments: {
      id: string;
      target_plan: string;
      amount: number;
      status: string;
      provider: string;
      created_at: string;
    }[];
  };
  usage: {
    notificationsTotal: number;
    notifications30d: number;
    byChannel: { channel: string; count: number }[];
    byStatus: { status: string; count: number }[];
    lastNotificationAt: string | null;
    billsTotal: number;
    billedLifetime: number;
    collectedLifetime: number;
    outstanding: number;
  };
  supportNote: { note: string; updated_at: string | null; updated_by_email: string };
};

/** Everything the platform team needs on one PG owner. */
export async function loadOwnerDetail(db: Admin, adminId: string): Promise<OwnerDetail> {
  const [adminRow, settings, scope, quick, note] = await Promise.all([
    db.from("admins").select("id, name, email, phone, created_at").eq("id", adminId).maybeSingle(),
    db.from("settings").select("brand_name").eq("admin_id", adminId).maybeSingle(),
    ownerScope(db, adminId),
    loadQuickFacts(db, adminId),
    db
      .from("owner_support_notes")
      .select("note, updated_at, updated_by_email")
      .eq("admin_id", adminId)
      .maybeSingle(),
  ]);

  if (!adminRow.data) throw new Error("Owner not found");

  const roomIds = scope.rooms.map((r) => r.id);
  const { data: tenants } = roomIds.length
    ? await db.from("tenants").select("id, room_id, status").in("room_id", roomIds)
    : { data: [] };
  const tenantIds = (tenants ?? []).map((t) => t.id);

  const [bills, notifications, history, planPayments] = await Promise.all([
    tenantIds.length
      ? db.from("bills").select("id, total_amount, paid_amount").in("tenant_id", tenantIds)
      : Promise.resolve({
          data: [] as { id: string; total_amount: number; paid_amount: number }[],
        }),
    tenantIds.length
      ? db
          .from("notification_logs")
          .select("id, channel, status, sent_at")
          .in("tenant_id", tenantIds)
          .order("sent_at", { ascending: false })
          .limit(2000)
      : Promise.resolve({
          data: [] as { id: string; channel: string; status: string; sent_at: string }[],
        }),
    db
      .from("plan_change_history")
      .select("id, from_plan, to_plan, direction, amount, credit_applied, note, created_at")
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("plan_payments")
      .select("id, target_plan, amount, status, provider, created_at")
      .eq("admin_id", adminId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const roomsByProperty = new Map<string, string[]>();
  for (const r of scope.rooms) {
    roomsByProperty.set(r.property_id, [...(roomsByProperty.get(r.property_id) ?? []), r.id]);
  }
  const activeByRoom = new Map<string, number>();
  let activeTenants = 0;
  let vacatedTenants = 0;
  for (const t of tenants ?? []) {
    if (t.status === "active") {
      activeTenants += 1;
      activeByRoom.set(t.room_id, (activeByRoom.get(t.room_id) ?? 0) + 1);
    } else if (t.status === "vacated") vacatedTenants += 1;
  }

  const capacity = scope.rooms.reduce((sum, r) => sum + Number(r.capacity ?? 0), 0);
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const notifRows = notifications.data ?? [];
  const countBy = (key: "channel" | "status") => {
    const map = new Map<string, number>();
    for (const n of notifRows) map.set(n[key], (map.get(n[key]) ?? 0) + 1);
    return [...map.entries()].map(([k, count]) => ({ [key]: k, count })) as never[];
  };

  const billRows = bills.data ?? [];

  return {
    account: {
      id: adminRow.data.id,
      name: adminRow.data.name,
      email: adminRow.data.email,
      phone: adminRow.data.phone,
      created_at: adminRow.data.created_at,
      brandName: settings.data?.brand_name ?? BRAND,
    },
    quick,
    portfolio: {
      properties: scope.properties.map((p) => {
        const ids = roomsByProperty.get(p.id) ?? [];
        return {
          id: p.id,
          name: p.name,
          city: p.city,
          rooms: ids.length,
          tenants: ids.reduce((sum, id) => sum + (activeByRoom.get(id) ?? 0), 0),
        };
      }),
      roomCount: scope.rooms.length,
      capacity,
      activeTenants,
      vacatedTenants,
      occupancyRate: capacity > 0 ? Math.round((activeTenants / capacity) * 100) : 0,
    },
    subscription: {
      history: (history.data ?? []).map((h) => ({
        ...h,
        amount: Number(h.amount ?? 0),
        credit_applied: Number(h.credit_applied ?? 0),
      })),
      payments: (planPayments.data ?? []).map((p) => ({ ...p, amount: Number(p.amount ?? 0) })),
    },
    usage: {
      notificationsTotal: notifRows.length,
      notifications30d: notifRows.filter((n) => n.sent_at >= since30).length,
      byChannel: countBy("channel"),
      byStatus: countBy("status"),
      lastNotificationAt: notifRows[0]?.sent_at ?? null,
      billsTotal: billRows.length,
      billedLifetime: billRows.reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
      collectedLifetime: billRows.reduce((s, b) => s + Number(b.paid_amount ?? 0), 0),
      outstanding: billRows.reduce(
        (s, b) => s + Math.max(0, Number(b.total_amount ?? 0) - Number(b.paid_amount ?? 0)),
        0,
      ),
    },
    supportNote: {
      note: note.data?.note ?? "",
      updated_at: note.data?.updated_at ?? null,
      updated_by_email: note.data?.updated_by_email ?? "",
    },
  };
}

/** Writes the platform team's private note about an owner. */
export async function saveSupportNote(
  db: Admin,
  adminId: string,
  note: string,
  actorId: string,
  actorEmail: string,
) {
  const { error } = await db.from("owner_support_notes").upsert(
    {
      admin_id: adminId,
      note,
      updated_by: actorId,
      updated_by_email: actorEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "admin_id" },
  );
  if (error) {
    console.error("[owner-detail] note write failed", error);
    throw new Error("Unable to save the support note");
  }
  return { ok: true as const };
}
