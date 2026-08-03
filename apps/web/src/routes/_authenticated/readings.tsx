import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatMoney } from "@/lib/pg";
import { useDirectory } from "@/lib/use-directory";
import type { Reading } from "@/lib/billing";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable, TableSkeleton } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/readings")({
  head: () => ({
    meta: [
      { title: "Meter readings - PG Manager" },
      {
        name: "description",
        content:
          "Log monthly electricity meter readings per room; units and amounts flow straight into the next bill run.",
      },
      { property: "og:title", content: "Meter readings - PG Manager" },
      {
        property: "og:description",
        content: "Room-wise electricity meter log for accurate billing.",
      },
    ],
  }),
  component: ReadingsPage,
});

function ReadingsPage() {
  const directory = useDirectory();
  const queryClient = useQueryClient();
  const [roomId, setRoomId] = useState<string>("");
  const [reading, setReading] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const rate = Number(directory.data?.settings?.electricity_rate_per_unit ?? 0);

  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("electricity_readings")
        .select("*")
        .order("reading_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const latestByRoom = useMemo(() => {
    const map = new Map<string, Reading>();
    for (const r of readings ?? []) {
      const prev = map.get(r.room_id);
      if (!prev || r.reading_date > prev.reading_date) map.set(r.room_id, r);
    }
    return map;
  }, [readings]);

  const previous = roomId ? latestByRoom.get(roomId) : undefined;
  const units = previous ? Number(reading || 0) - Number(previous.meter_reading) : null;

  const addReading = useMutation({
    mutationFn: async () => {
      if (!roomId) throw new Error("Pick a room first.");
      const value = Number(reading);
      if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid meter reading.");
      if (previous && value < Number(previous.meter_reading)) {
        throw new Error(
          `Reading is lower than the last one (${previous.meter_reading}). Check the value.`,
        );
      }
      const consumed = previous ? value - Number(previous.meter_reading) : null;
      const { error } = await supabase.from("electricity_readings").insert({
        room_id: roomId,
        reading_date: date,
        meter_reading: value,
        units_consumed_since_previous: consumed,
        rate_per_unit: rate,
        calculated_amount: consumed === null ? null : Math.round(consumed * rate * 100) / 100,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reading saved.");
      setReading("");
      queryClient.invalidateQueries({ queryKey: ["readings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeReading = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("electricity_readings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reading deleted.");
      queryClient.invalidateQueries({ queryKey: ["readings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loading = isLoading || directory.isLoading;

  const rooms = directory.data?.rooms ?? [];
  const roomLabel = (id: string) => {
    const room = directory.roomById.get(id);
    if (!room) return "Room";
    const property = directory.propertyById.get(room.property_id);
    return `Room ${room.room_number}${property ? ` · ${property.name}` : ""}`;
  };

  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">Electricity readings</h1>
        <p className="page-subtitle">
          Log the meter for each room. Units since the previous reading auto-fill the next bill run
          at {formatMoney(rate)}/unit.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a reading</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {roomLabel(r.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meter">Meter reading</Label>
              <Input
                id="meter"
                type="number"
                min={0}
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                placeholder={previous ? `Last: ${previous.meter_reading}` : "First reading"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reading-date">Date</Label>
              <Input
                id="reading-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button onClick={() => addReading.mutate()} disabled={addReading.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Save reading
            </Button>
          </div>
          {roomId && (
            <p className="mt-3 text-xs text-muted-foreground">
              {previous
                ? `Previous ${previous.meter_reading} on ${formatDate(previous.reading_date)} · ${
                    units !== null && units >= 0 ? units : 0
                  } units = ${formatMoney(Math.max(0, units ?? 0) * rate)}`
                : "No previous reading for this room - this becomes the baseline."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>Latest per room</CardTitle>
          <Gauge className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : rooms.length === 0 ? (
            <EmptyState
              title="No rooms yet"
              description="Create rooms before logging electricity meter readings."
            />
          ) : (
            <ResponsiveTable labels={["Room", "Last reading", "On", "Units", "Amount"]} virtualize>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Last reading</TableHead>
                    <TableHead>On</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((r) => {
                    const last = latestByRoom.get(r.id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{roomLabel(r.id)}</TableCell>
                        <TableCell>{last ? last.meter_reading : "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {last ? formatDate(last.reading_date) : "-"}
                        </TableCell>
                        <TableCell>{last?.units_consumed_since_previous ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {last?.calculated_amount != null
                            ? formatMoney(last.calculated_amount)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reading history</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : (readings ?? []).length === 0 ? (
            <EmptyState
              title="No readings logged yet"
              description="Record a meter reading above to start tracking electricity usage."
            />
          ) : (
            <ResponsiveTable labels={["Date", "Room", "Meter", "Units", "Amount", ""]} virtualize>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Meter</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(readings ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.reading_date)}</TableCell>
                      <TableCell className="font-medium">{roomLabel(r.room_id)}</TableCell>
                      <TableCell>{r.meter_reading}</TableCell>
                      <TableCell>{r.units_consumed_since_previous ?? "-"}</TableCell>
                      <TableCell>
                        {r.calculated_amount != null ? formatMoney(r.calculated_amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete reading"
                          onClick={() => removeReading.mutate(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
