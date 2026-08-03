import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { FileDrop } from "@/components/file-drop";
import {
  ADDRESS_PROOF_TYPES,
  TENANT_STATUSES,
  effectiveRent,
  formatDate,
  formatMoney,
  type Tenant,
} from "@/lib/pg";
import { DataPagination, usePagination } from "@/components/data-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/filter-bar";
import { ResponsiveTable, TableSkeleton } from "@/components/responsive-table";
import { DensityToggle } from "@/components/density-toggle";
import { EmptyState } from "@/components/empty-state";
import { useDensity } from "@/lib/use-density";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/tenants")({
  head: () => ({
    meta: [
      { title: "Tenants - PG Manager" },
      {
        name: "description",
        content:
          "Tenant records with room allotment, rent, deposit, KYC documents and joining details.",
      },
      { property: "og:title", content: "Tenants - PG Manager" },
      { property: "og:description", content: "Tenant records, room allotment and KYC documents." },
    ],
  }),
  component: TenantsPage,
});

type Draft = {
  full_name: string;
  phone: string;
  alternate_phone: string;
  email: string;
  room_id: string;
  joining_date: string;
  status: (typeof TENANT_STATUSES)[number];
  security_deposit: number;
  monthly_rent_override: string;
  permanent_address: string;
  address_proof_type: string;
  address_proof_file_url: string | null;
  photo_url: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  vacated_date: string;
  notes: string;
};

const emptyDraft: Draft = {
  full_name: "",
  phone: "",
  alternate_phone: "",
  email: "",
  room_id: "",
  joining_date: new Date().toISOString().slice(0, 10),
  status: "active",
  security_deposit: 0,
  monthly_rent_override: "",
  permanent_address: "",
  address_proof_type: "",
  address_proof_file_url: null,
  photo_url: null,
  emergency_contact_name: "",
  emergency_contact_phone: "",
  vacated_date: "",
  notes: "",
};

const STATUS_STYLES: Record<string, string> = {
  active: "border-transparent bg-success/15 text-success",
  "notice-period": "border-transparent bg-warning/20 text-warning-foreground",
  vacated: "text-muted-foreground",
};

function TenantsPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [vacateTarget, setVacateTarget] = useState<Tenant | null>(null);

  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const { data: rooms } = useQuery({
    queryKey: ["rooms-with-property"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*, properties(name)")
        .order("room_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const roomLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rooms ?? []) {
      const pname = (r as { properties?: { name?: string } | null }).properties?.name;
      map.set(r.id, pname ? `${pname} · ${r.room_number}` : r.room_number);
    }
    return map;
  }, [rooms]);

  const roomById = useMemo(() => new Map((rooms ?? []).map((r) => [r.id, r])), [rooms]);

  const debouncedSearch = useDebouncedValue(search, 250);

  const visible = (tenants ?? []).filter((t) => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const q = debouncedSearch.trim().toLowerCase();
    const matchesSearch =
      !q || t.full_name.toLowerCase().includes(q) || t.phone.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.full_name.trim()) throw new Error("Tenant name is required");
      if (!draft.phone.trim()) throw new Error("Phone number is required");
      if (!draft.room_id) throw new Error("Assign a room");
      const payload = {
        full_name: draft.full_name.trim(),
        phone: draft.phone.trim(),
        alternate_phone: draft.alternate_phone.trim() || null,
        email: draft.email.trim() || null,
        room_id: draft.room_id,
        joining_date: draft.joining_date,
        status: draft.status,
        security_deposit: Number(draft.security_deposit) || 0,
        monthly_rent_override:
          draft.monthly_rent_override === "" ? null : Number(draft.monthly_rent_override),
        permanent_address: draft.permanent_address.trim() || null,
        address_proof_type: draft.address_proof_type
          ? (draft.address_proof_type as (typeof ADDRESS_PROOF_TYPES)[number])
          : null,
        address_proof_file_url: draft.address_proof_file_url,
        photo_url: draft.photo_url,
        emergency_contact_name: draft.emergency_contact_name.trim() || null,
        emergency_contact_phone: draft.emergency_contact_phone.trim() || null,
        vacated_date: draft.vacated_date || null,
        notes: draft.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("tenants").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenants").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(editing ? "Tenant updated" : "Tenant added");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Tenant removed");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vacate = useMutation({
    mutationFn: async (tenant: Tenant) => {
      const { error } = await supabase
        .from("tenants")
        .update({
          status: "vacated" as const,
          vacated_date: tenant.vacated_date ?? new Date().toISOString().slice(0, 10),
        })
        .eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Tenant marked as vacated - the bed is now free");
      setVacateTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  function openNew() {
    setEditing(null);
    setDraft({ ...emptyDraft, room_id: rooms?.[0]?.id ?? "" });
    setOpen(true);
  }

  function openEdit(t: Tenant) {
    setEditing(t);
    setDraft({
      full_name: t.full_name,
      phone: t.phone,
      alternate_phone: t.alternate_phone ?? "",
      email: t.email ?? "",
      room_id: t.room_id,
      joining_date: t.joining_date,
      status: t.status,
      security_deposit: Number(t.security_deposit),
      monthly_rent_override:
        t.monthly_rent_override === null ? "" : String(Number(t.monthly_rent_override)),
      permanent_address: t.permanent_address ?? "",
      address_proof_type: t.address_proof_type ?? "",
      address_proof_file_url: t.address_proof_file_url,
      photo_url: t.photo_url,
      emergency_contact_name: t.emergency_contact_name ?? "",
      emergency_contact_phone: t.emergency_contact_phone ?? "",
      vacated_date: t.vacated_date ?? "",
      notes: t.notes ?? "",
    });
    setOpen(true);
  }

  const tenantPage = usePagination(visible, 12);
  const { density, setDensity } = useDensity("tenants");

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Tenant Records &amp; KYC</h1>
          <p className="page-subtitle">
            Records, room allotment and KYC documents.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openNew} disabled={!rooms?.length}>
          <Plus className="mr-1.5 h-4 w-4" /> Add tenant
        </Button>
      </div>

      <FilterBar
        label="Search & filter tenants"
        quickChips={[
          { label: "All", active: statusFilter === "all", onSelect: () => setStatusFilter("all") },
          ...TENANT_STATUSES.map((s) => ({
            label: s.replace("-", " "),
            active: statusFilter === s,
            onSelect: () => setStatusFilter(s),
          })),
        ]}
        chips={[
          ...(statusFilter !== "all"
            ? [{ label: `Status: ${statusFilter.replace("-", " ")}`, onClear: () => setStatusFilter("all") }]
            : []),
          ...(search.trim() ? [{ label: `Search: ${search.trim()}`, onClear: () => setSearch("") }] : []),
        ]}
        onReset={() => {
          setStatusFilter("all");
          setSearch("");
        }}
      >
        <div className="relative w-full sm:min-w-56 sm:flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search tenants by name or phone"
            className="pl-8"
            placeholder="Search by name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter tenants by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TENANT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace("-", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {isLoading ? (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <TableSkeleton rows={6} columns={6} density={density} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 sm:p-0">
            <div className="mb-2 sm:px-6 sm:pt-4 md:hidden">
              <DensityToggle density={density} onChange={setDensity} />
            </div>
            <ResponsiveTable
              labels={["Name","Phone","Room","Joined","Status","Rent",""]}
              density={density}
              compactColumns={3}
              virtualize
            >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rent</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        title={rooms?.length ? "No tenants match this view" : "No rooms yet"}
                        description={
                          rooms?.length
                            ? "Try clearing the search or status filter to see every tenant."
                            : "Create a room first, then add tenants and assign them to rooms."
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {tenantPage.pageRows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.phone}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {roomLabel.get(t.room_id) ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(t.joining_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[t.status]}>
                        {t.status.replace("-", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(effectiveRent(t, roomById.get(t.room_id)))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {t.status !== "vacated" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Mark ${t.full_name} as vacated`}
                            title="Mark as vacated"
                            onClick={() => setVacateTarget(t)}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" aria-label={`Edit ${t.full_name}`} onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" aria-label={`Delete ${t.full_name}`} onClick={() => setDeleteTarget(t)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </ResponsiveTable>
            <div className="pb-1 sm:px-6 sm:pb-4">
              <DataPagination
                page={tenantPage.page}
                pageCount={tenantPage.pageCount}
                from={tenantPage.from}
                to={tenantPage.to}
                total={tenantPage.total}
                onPageChange={tenantPage.setPage}
                label="tenants"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit tenant" : "Add tenant"}</DialogTitle>
            <DialogDescription>
              Rent falls back to the room's rent unless you set an override.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-name">Full name</Label>
                <Input
                  id="t-name"
                  value={draft.full_name}
                  onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-phone">Phone</Label>
                <Input
                  id="t-phone"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="+91 90000 00000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-alt">Alternate phone</Label>
                <Input
                  id="t-alt"
                  value={draft.alternate_phone}
                  onChange={(e) => setDraft({ ...draft, alternate_phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-email">Email</Label>
                <Input
                  id="t-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Room</Label>
                <Select
                  value={draft.room_id}
                  onValueChange={(v) => setDraft({ ...draft, room_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rooms ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {roomLabel.get(r.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TENANT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace("-", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-join">Joining date</Label>
                <Input
                  id="t-join"
                  type="date"
                  value={draft.joining_date}
                  onChange={(e) => setDraft({ ...draft, joining_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-vacate">Vacated date</Label>
                <Input
                  id="t-vacate"
                  type="date"
                  value={draft.vacated_date}
                  onChange={(e) => setDraft({ ...draft, vacated_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-deposit">Security deposit (₹)</Label>
                <Input
                  id="t-deposit"
                  type="number"
                  min={0}
                  value={draft.security_deposit}
                  onChange={(e) =>
                    setDraft({ ...draft, security_deposit: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-rent">Rent override (₹)</Label>
                <Input
                  id="t-rent"
                  type="number"
                  min={0}
                  placeholder={
                    draft.room_id
                      ? String(Number(roomById.get(draft.room_id)?.monthly_rent ?? 0))
                      : "Room default"
                  }
                  value={draft.monthly_rent_override}
                  onChange={(e) => setDraft({ ...draft, monthly_rent_override: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-address">Permanent address</Label>
              <Textarea
                id="t-address"
                rows={2}
                value={draft.permanent_address}
                onChange={(e) => setDraft({ ...draft, permanent_address: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-ec-name">Emergency contact</Label>
                <Input
                  id="t-ec-name"
                  value={draft.emergency_contact_name}
                  onChange={(e) => setDraft({ ...draft, emergency_contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-ec-phone">Emergency phone</Label>
                <Input
                  id="t-ec-phone"
                  value={draft.emergency_contact_phone}
                  onChange={(e) => setDraft({ ...draft, emergency_contact_phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Address proof type</Label>
                <Select
                  value={draft.address_proof_type}
                  onValueChange={(v) => setDraft({ ...draft, address_proof_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select proof" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDRESS_PROOF_TYPES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {user && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FileDrop
                  label="Tenant photo"
                  accept="image/*"
                  userId={user.id}
                  value={draft.photo_url}
                  onChange={(path) => setDraft({ ...draft, photo_url: path })}
                />
                <FileDrop
                  label="Address proof file"
                  accept="image/*,application/pdf"
                  userId={user.id}
                  value={draft.address_proof_file_url}
                  onChange={(path) => setDraft({ ...draft, address_proof_file_url: path })}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="t-notes">Notes</Label>
              <Textarea
                id="t-notes"
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their bills and notification history will be deleted too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!vacateTarget} onOpenChange={(o) => !o && setVacateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {vacateTarget?.full_name} as vacated?</AlertDialogTitle>
            <AlertDialogDescription>
              Their bed in {vacateTarget ? (roomLabel.get(vacateTarget.room_id) ?? "the room") : "the room"}{" "}
              is freed immediately and they stop appearing in new bill runs. Past bills and
              payments stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={vacate.isPending}
              onClick={() => vacateTarget && vacate.mutate(vacateTarget)}
            >
              Mark vacated
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
