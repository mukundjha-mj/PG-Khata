import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/lib/pg";
import { usePlan } from "@/lib/use-plan";
import { checkPropertyLimit } from "@/lib/plan-limits";
import { ShareLinkCard } from "@/components/share-link-card";
import {
  getSignupLink,
  regenerateSignupLinkFn,
  setSignupLinkActiveFn,
} from "@/lib/signup-links.functions";
import {
  getComplaintLink,
  regenerateComplaintLinkFn,
  setComplaintLinkActiveFn,
} from "@/lib/complaint-links.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: `Properties - ${BRAND}` },
      {
        name: "description",
        content: "Add and manage the PG properties you operate, with address and billing mode.",
      },
      { property: "og:title", content: `Properties - ${BRAND}` },
      { property: "og:description", content: "Manage the PG properties you operate." },
    ],
  }),
  component: PropertiesPage,
});

type Draft = {
  name: string;
  address: string;
  city: string;
  electricity_mode: string;
  electricity_rate_per_unit: string;
};

const emptyDraft: Draft = {
  name: "",
  address: "",
  city: "",
  electricity_mode: "flat",
  electricity_rate_per_unit: "",
};

function PropertiesPage() {
  const queryClient = useQueryClient();
  const { tier } = usePlan();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [limitReason, setLimitReason] = useState<string | null>(null);

  const { data: properties, isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Property name is required");
      const payload = {
        name: draft.name,
        address: draft.address,
        city: draft.city,
        electricity_mode: draft.electricity_mode,
        electricity_rate_per_unit: draft.electricity_rate_per_unit.trim()
          ? Number(draft.electricity_rate_per_unit)
          : null,
      };
      if (editing) {
        const { error } = await supabase.from("properties").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("properties").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(editing ? "Property updated" : "Property added");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Property deleted");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    const check = checkPropertyLimit(tier, properties?.length ?? 0);
    if (!check.allowed) {
      setLimitReason(check.reason);
      return;
    }
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(p: Property) {
    setEditing(p);
    setDraft({
      name: p.name,
      address: p.address,
      city: p.city,
      electricity_mode: p.electricity_mode,
      electricity_rate_per_unit:
        p.electricity_rate_per_unit === null ? "" : String(Number(p.electricity_rate_per_unit)),
    });
    setOpen(true);
  }

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">Every PG building you manage.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add property
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle>{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <p>{p.address || "No address"}</p>
                  <p>{p.city}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Electricity: {p.electricity_mode === "meter" ? "Meter reading" : "Flat charge"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
                <PropertyShareLinks propertyId={p.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No properties yet. Add your first PG to get started.
            </p>
            <Button className="mt-4" onClick={openNew}>
              <Plus className="mr-1.5 h-4 w-4" /> Add property
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit property" : "Add property"}</DialogTitle>
            <DialogDescription>Basic details for this PG building.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Sunrise PG"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-address">Address</Label>
              <Input
                id="p-address"
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-city">City</Label>
                <Input
                  id="p-city"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Electricity billing</Label>
                <Select
                  value={draft.electricity_mode}
                  onValueChange={(v) => setDraft({ ...draft, electricity_mode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat charge</SelectItem>
                    <SelectItem value="meter">Meter reading</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {draft.electricity_mode === "meter" && (
              <div className="space-y-1.5">
                <Label htmlFor="p-rate">Electricity rate (₹ per unit)</Label>
                <Input
                  id="p-rate"
                  type="number"
                  min={0}
                  step="0.5"
                  value={draft.electricity_rate_per_unit}
                  onChange={(e) =>
                    setDraft({ ...draft, electricity_rate_per_unit: e.target.value })
                  }
                  placeholder="Uses your default rate from Settings"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use your default rate from Settings.
                </p>
              </div>
            )}
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
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes its rooms and any bills linked to them. This cannot be undone.
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

      <AlertDialog open={!!limitReason} onOpenChange={(o) => !o && setLimitReason(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You've reached your plan's property limit</AlertDialogTitle>
            <AlertDialogDescription>{limitReason}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link to="/plan">See plans and upgrade</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Signup + complaint share links for one property, shown inline on its card. */
function PropertyShareLinks({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const getSignupLinkFn = useServerFn(getSignupLink);
  const regenerateSignupFn = useServerFn(regenerateSignupLinkFn);
  const setSignupActiveFn = useServerFn(setSignupLinkActiveFn);
  const getComplaintLinkFn = useServerFn(getComplaintLink);
  const regenerateComplaintFn = useServerFn(regenerateComplaintLinkFn);
  const setComplaintActiveFn = useServerFn(setComplaintLinkActiveFn);

  const signupQuery = useQuery({
    queryKey: ["signup-link", propertyId],
    queryFn: () => getSignupLinkFn({ data: { propertyId } }),
  });
  const complaintQuery = useQuery({
    queryKey: ["complaint-link", propertyId],
    queryFn: () => getComplaintLinkFn({ data: { propertyId } }),
  });

  const regenerateSignup = useMutation({
    mutationFn: () => regenerateSignupFn({ data: { propertyId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-link", propertyId] });
      toast.success("Signup link regenerated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleSignupActive = useMutation({
    mutationFn: (isActive: boolean) => setSignupActiveFn({ data: { propertyId, isActive } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["signup-link", propertyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const regenerateComplaint = useMutation({
    mutationFn: () => regenerateComplaintFn({ data: { propertyId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint-link", propertyId] });
      toast.success("Complaint link regenerated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleComplaintActive = useMutation({
    mutationFn: (isActive: boolean) => setComplaintActiveFn({ data: { propertyId, isActive } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["complaint-link", propertyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // appUrl() falls back to an empty string when VITE_APP_URL is unset (fine for
  // same-origin dev links), so build from the page's own origin instead - this
  // link is always opened from the app the owner is actually signed into.
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-2 pt-1">
      <ShareLinkCard
        label="Tenant signup link"
        description="Tenants fill this in themselves and are added as active tenants right away - no login needed."
        url={signupQuery.data ? `${origin}/signup/${signupQuery.data.token}` : null}
        isActive={signupQuery.data?.is_active ?? true}
        loading={signupQuery.isLoading}
        onRegenerate={() => regenerateSignup.mutate()}
        onToggleActive={(v) => toggleSignupActive.mutate(v)}
        regenerating={regenerateSignup.isPending}
        togglingActive={toggleSignupActive.isPending}
      />
      <ShareLinkCard
        label="Complaint link"
        description="Tenants use this to report an issue - it shows up on your Complaints page and dashboard."
        url={complaintQuery.data ? `${origin}/complaint/${complaintQuery.data.token}` : null}
        isActive={complaintQuery.data?.is_active ?? true}
        loading={complaintQuery.isLoading}
        onRegenerate={() => regenerateComplaint.mutate()}
        onToggleActive={(v) => toggleComplaintActive.mutate(v)}
        regenerating={regenerateComplaint.isPending}
        togglingActive={toggleComplaintActive.isPending}
      />
    </div>
  );
}
