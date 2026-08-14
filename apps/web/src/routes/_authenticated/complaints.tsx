import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePropertyScope } from "@/lib/property-scope";
import { COMPLAINT_STATUSES, COMPLAINT_STATUS_LABEL, formatDate, type Complaint } from "@/lib/pg";
import { DataPagination, usePagination } from "@/components/data-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/filter-bar";
import { ResponsiveTable, TableSkeleton } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Badge } from "@/components/ui/badge";
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
import { BRAND } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/complaints")({
  head: () => ({
    meta: [
      { title: `Complaints - ${BRAND}` },
      {
        name: "description",
        content: "Tenant complaints submitted through your property's complaint link.",
      },
      { property: "og:title", content: `Complaints - ${BRAND}` },
      { property: "og:description", content: "Track and resolve tenant complaints." },
    ],
  }),
  component: ComplaintsPage,
});

const STATUS_STYLES: Record<string, string> = {
  open: "border-transparent bg-destructive/15 text-destructive",
  "in-progress": "border-transparent bg-warning/20 text-warning-foreground",
  resolved: "border-transparent bg-success/15 text-success",
};

function ComplaintsPage() {
  const queryClient = useQueryClient();
  const { selectedPropertyId } = usePropertyScope();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Complaint | null>(null);

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["complaints", selectedPropertyId],
    queryFn: async () => {
      let query = supabase.from("complaints").select("*").order("created_at", { ascending: false });
      if (selectedPropertyId) query = query.eq("property_id", selectedPropertyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const debouncedSearch = useDebouncedValue(search, 250);

  const visible = (complaints ?? []).filter((c) => {
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const q = debouncedSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.tenant_name.toLowerCase().includes(q) ||
      c.room_number.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: (typeof COMPLAINT_STATUSES)[number];
    }) => {
      const { error } = await supabase.from("complaints").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaints-open-count"] });
      toast.success("Status updated");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const complaintPage = usePagination(visible, 12);

  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">Complaints</h1>
        <p className="page-subtitle">
          Submitted by tenants through your property's complaint link.
        </p>
      </div>

      <FilterBar
        label="Search & filter complaints"
        quickChips={[
          { label: "All", active: statusFilter === "all", onSelect: () => setStatusFilter("all") },
          ...COMPLAINT_STATUSES.map((s) => ({
            label: COMPLAINT_STATUS_LABEL[s],
            active: statusFilter === s,
            onSelect: () => setStatusFilter(s),
          })),
        ]}
        // Status has its own dropdown and quick-chip row above, so it
        // doesn't also get a removable chip here - that would be two
        // controls doing the same job.
        chips={[
          ...(search.trim()
            ? [{ label: `Search: ${search.trim()}`, onClear: () => setSearch("") }]
            : []),
        ]}
        onReset={() => {
          setStatusFilter("all");
          setSearch("");
        }}
      >
        <div className="relative w-full sm:min-w-56 sm:flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search complaints by name, room or phone"
            className="pl-8"
            placeholder="Search by name, room or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter complaints by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COMPLAINT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {COMPLAINT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {isLoading ? (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <TableSkeleton rows={6} columns={6} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 sm:p-0">
            <ResponsiveTable
              labels={["Tenant", "Room", "Phone", "Note", "Status", "When"]}
              compactColumns={3}
              virtualize
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complaintPage.pageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          title="No complaints"
                          description="Share your property's complaint link with tenants to start collecting reports here."
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {complaintPage.pageRows.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setEditing(c)}>
                      <TableCell className="font-medium">{c.tenant_name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.room_number}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {c.note}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[c.status]}>
                          {COMPLAINT_STATUS_LABEL[c.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(c.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      )}

      <DataPagination
        page={complaintPage.page}
        pageCount={complaintPage.pageCount}
        from={complaintPage.from}
        to={complaintPage.to}
        total={complaintPage.total}
        onPageChange={complaintPage.setPage}
        label="complaints"
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.tenant_name}</DialogTitle>
            <DialogDescription>
              Room {editing?.room_number} - {editing?.phone}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-foreground">{editing?.note}</p>
          <div className="space-y-1.5">
            <Select
              value={editing?.status ?? "open"}
              onValueChange={(v) =>
                editing &&
                setStatus.mutate({
                  id: editing.id,
                  status: v as (typeof COMPLAINT_STATUSES)[number],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPLAINT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {COMPLAINT_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
