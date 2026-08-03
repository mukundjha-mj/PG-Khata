import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { formatMoney } from "@/lib/pg";
import {
  balanceOf,
  recordPayment,
  PAYMENT_METHODS,
  type Bill,
  type PaymentMethod,
} from "@/lib/billing";

export type PaymentTarget = { bill: Bill; tenantName: string };

export function RecordPaymentDialog({
  target,
  onOpenChange,
}: {
  target: PaymentTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const bill = target?.bill;
  const balance = bill ? balanceOf(bill) : 0;

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  function reset(open: boolean) {
    if (!open) {
      setAmount("");
      setMethod("UPI");
      setPaidAt(new Date().toISOString().slice(0, 10));
      setRef("");
      setNotes("");
    }
    onOpenChange(open);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!bill) throw new Error("No bill selected.");
      return recordPayment({
        billId: bill.id,
        amount: Number(amount || balance),
        method,
        paidAt,
        transactionRef: ref,
        notes,
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded.");
      queryClient.invalidateQueries();
      reset(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {target?.tenantName} · outstanding {formatMoney(balance)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">Amount received</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder={String(balance)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              type="button"
              className="w-fit text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => setAmount(String(balance))}
            >
              Use full balance
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-date">Paid on</Label>
              <Input
                id="pay-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-ref">Transaction reference</Label>
            <Input
              id="pay-ref"
              placeholder="UPI ref / cheque no. (optional)"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea
              id="pay-notes"
              rows={2}
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => reset(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || balance <= 0}>
            {save.isPending ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
