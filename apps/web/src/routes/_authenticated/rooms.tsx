import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePropertyScope } from "@/lib/property-scope";
import { ROOM_TYPES, formatMoney, occupancyOf, type Room } from "@/lib/pg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable, TableSkeleton } from "@/components/responsive-table";
import { DensityToggle } from "@/components/density-toggle";
import { EmptyState } from "@/components/empty-state";
import { useDensity } from "@/lib/use-density";
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
import { BRAND } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: `Rooms - ${BRAND}` },
      {
        name: "description",
        content: "Room inventory with type, capacity, base rent and live occupancy per property.",
      },
      { property: "og:title", content: `Rooms - ${BRAND}` },
      { property: "og:description", content: "Room inventory and occupancy for each PG property." },
    ],
  }),
  component: RoomsPage,
});

type Draft = {
  property_id: string;
  room_number: string;
  room_type: (typeof ROOM_TYPES)[number];
  capacity: number;
  monthly_rent: number;
  room_size: string;
};

function RoomsPage() {
  const queryClient = useQueryClient();
  const { selectedPropertyId } = usePropertyScope();
  const propertyFilter = selectedPropertyId ?? "all";
  const { density, setDensity } = useDensity("rooms");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [draft, setDraft] = useState<Draft>({
    property_id: "",
    room_number: "",
    room_type: "single",
    capacity: 1,
    monthly_rent: 0,
    room_size: "",
  });

  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const [rooms, tenants] = await Promise.all([
        supabase.from("rooms").select("*").order("room_number"),
        supabase.from("tenants").select("id, room_id, status").eq("status", "active"),
      ]);
      if (rooms.error) throw rooms.error;
      if (tenants.error) throw tenants.error;
      return { rooms: rooms.data, tenants: tenants.data };
    },
  });

  const occupancy = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of data?.tenants ?? []) map.set(t.room_id, (map.get(t.room_id) ?? 0) + 1);
    return map;
  }, [data]);

  const propertyName = useMemo(
    () => new Map((properties ?? []).map((p) => [p.id, p.name])),
    [properties],
  );

  const rooms = (data?.rooms ?? []).filter(
    (r) => propertyFilter === "all" || r.property_id === propertyFilter,
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.property_id) throw new Error("Pick a property");
      if (!draft.room_number.trim()) throw new Error("Room number is required");
      const payload = {
        property_id: draft.property_id,
        room_number: draft.room_number.trim(),
        room_type: draft.room_type,
        capacity: Number(draft.capacity) || 1,
        monthly_rent: Number(draft.monthly_rent) || 0,
        room_size: draft.room_size.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("rooms").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rooms").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(editing ? "Room updated" : "Room added");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Room deleted");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setDraft({
      property_id: propertyFilter !== "all" ? propertyFilter : (properties?.[0]?.id ?? ""),
      room_number: "",
      room_type: "single",
      capacity: 1,
      monthly_rent: 0,
      room_size: "",
    });
    setOpen(true);
  }

  function openEdit(room: Room) {
    setEditing(room);
    setDraft({
      property_id: room.property_id,
      room_number: room.room_number,
      room_type: room.room_type,
      capacity: room.capacity,
      monthly_rent: Number(room.monthly_rent),
      room_size: room.room_size ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Room Inventory &amp; Occupancy</h1>
          <p className="page-subtitle">Inventory, capacity and rent for each room.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <Button className="w-full sm:w-auto" onClick={openNew} disabled={!properties?.length}>
            <Plus className="mr-1.5 h-4 w-4" /> Add room
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <TableSkeleton rows={6} columns={5} density={density} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 sm:p-0">
            <div className="mb-2 sm:px-6 sm:pt-4 md:hidden">
              <DensityToggle density={density} onChange={setDensity} />
            </div>
            <ResponsiveTable
              labels={["Room", "Property", "Type", "Occupancy", "Rent", ""]}
              density={density}
              compactColumns={3}
              virtualize
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          title={properties?.length ? "No rooms in this view" : "No properties yet"}
                          description={
                            properties?.length
                              ? "Switch the property filter or add a room to get started."
                              : "Add a property first, then create rooms inside it."
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {rooms.map((room) => {
                    const occ = occupancy.get(room.id) ?? 0;
                    const state = occupancyOf(occ, room.capacity);
                    return (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">{room.room_number}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {propertyName.get(room.property_id) ?? "-"}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {room.room_type}
                        </TableCell>
                        <TableCell>
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
                            {occ}/{room.capacity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(room.monthly_rent)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit room ${room.room_number}`}
                              onClick={() => openEdit(room)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete room ${room.room_number}`}
                              onClick={() => setDeleteTarget(room)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit room" : "Add room"}</DialogTitle>
            <DialogDescription>
              Rent here is the default for tenants in this room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                value={draft.property_id}
                onValueChange={(v) => setDraft({ ...draft, property_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {(properties ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="r-number">Room number</Label>
                <Input
                  id="r-number"
                  value={draft.room_number}
                  onChange={(e) => setDraft({ ...draft, room_number: e.target.value })}
                  placeholder="101"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={draft.room_type}
                  onValueChange={(v) => setDraft({ ...draft, room_type: v as Draft["room_type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-capacity">Capacity (beds)</Label>
                <Input
                  id="r-capacity"
                  type="number"
                  min={1}
                  value={draft.capacity}
                  onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-rent">Monthly rent (₹)</Label>
                <Input
                  id="r-rent"
                  type="number"
                  min={0}
                  value={draft.monthly_rent}
                  onChange={(e) => setDraft({ ...draft, monthly_rent: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-size">Room size (optional)</Label>
              <Input
                id="r-size"
                value={draft.room_size}
                onChange={(e) => setDraft({ ...draft, room_size: e.target.value })}
                placeholder="10x12 ft"
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
            <AlertDialogTitle>Delete room {deleteTarget?.room_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tenants assigned to this room will be removed too. This cannot be undone.
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
    </div>
  );
}
