import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPersonalReminderFn } from "@/lib/reminders.functions";

export type PersonalReminderTenant = { id: string; fullName: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PersonalReminderDialog({
  open,
  tenants,
  onOpenChange,
}: {
  open: boolean;
  tenants: PersonalReminderTenant[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createPersonalReminderFn);

  const [tenantId, setTenantId] = useState("");
  const [remindOn, setRemindOn] = useState(todayIso());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setTenantId("");
      setRemindOn(todayIso());
      setNote("");
    }
  }, [open]);

  const save = useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error("Pick a tenant.");
      return createFn({ data: { tenantId, remindOn, note: note.trim() || null } });
    },
    onSuccess: () => {
      toast.success("Reminder set.");
      queryClient.invalidateQueries({ queryKey: ["scheduled-reminders"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set a payment reminder</DialogTitle>
          <DialogDescription>
            A follow-up note for yourself - shows on your dashboard on that date, the tenant is
            never notified.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="personal-reminder-tenant">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger id="personal-reminder-tenant">
                <SelectValue placeholder="Pick a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="personal-reminder-date">Date</Label>
            <Input
              id="personal-reminder-date"
              type="date"
              min={todayIso()}
              value={remindOn}
              onChange={(e) => setRemindOn(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="personal-reminder-note">Note (optional)</Label>
            <Textarea
              id="personal-reminder-note"
              rows={3}
              placeholder="e.g. Said they'd pay by the 14th"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !tenantId}>
            {save.isPending ? "Saving…" : "Set reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
