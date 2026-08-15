import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { previewBroadcastSegment, sendBroadcastMessage } from "@/lib/broadcast.functions";
import { listAuditLog } from "@/lib/platform-auth.functions";
import type { BroadcastSegment } from "@/lib/broadcast.server";

const SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  all: "All owners",
  trial: "On trial",
  active: "Active subscribers",
  starter: "Starter plan",
  growing: "Growing plan",
  scale: "Scale plan",
};

/** Super-admin-only: email an announcement to a segment of PG owners. */
export function BroadcastPanel() {
  const queryClient = useQueryClient();
  const previewFn = useServerFn(previewBroadcastSegment);
  const sendFn = useServerFn(sendBroadcastMessage);
  const auditFn = useServerFn(listAuditLog);

  const [segment, setSegment] = useState<BroadcastSegment>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);

  const audit = useQuery({
    queryKey: ["platform-audit-log"],
    queryFn: () => auditFn(),
  });
  const history = (audit.data ?? []).filter((row) => row.action === "send_broadcast").slice(0, 10);

  const preview = useMutation({
    mutationFn: () => previewFn({ data: { segment } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { segment, subject, body } }),
    onSuccess: (result) => {
      toast.success(
        result.failedCount > 0
          ? `Sent to ${result.sentCount} of ${result.recipientCount} owners - ${result.failedCount} failed`
          : `Sent to ${result.sentCount} owner${result.sentCount === 1 ? "" : "s"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["platform-audit-log"] });
      setSubject("");
      setBody("");
      setConfirming(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  const startConfirm = () => {
    if (!canSend) return;
    setConfirming(true);
    preview.mutate();
  };

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-console-border bg-console-panel p-4 sm:p-5">
        <h2 className="section-title">Send an announcement</h2>
        <p className="mt-1 text-xs text-console-muted">
          Emails every owner in the chosen segment. There is no undo once it sends.
        </p>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-segment">Segment</Label>
            <Select
              value={segment}
              onValueChange={(v) => {
                setSegment(v as BroadcastSegment);
                setConfirming(false);
              }}
            >
              <SelectTrigger id="broadcast-segment" className="h-11 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-subject">Subject</Label>
            <Input
              id="broadcast-subject"
              maxLength={200}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setConfirming(false);
              }}
              placeholder="What's new on PGKhata"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-body">Message</Label>
            <Textarea
              id="broadcast-body"
              maxLength={5000}
              rows={6}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setConfirming(false);
              }}
              placeholder="Separate paragraphs with a blank line."
            />
          </div>

          {!confirming ? (
            <Button disabled={!canSend} onClick={startConfirm}>
              <Send className="mr-2 h-4 w-4" />
              Review recipients
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-console-border bg-console-raised p-3">
              {preview.isPending ? (
                <Skeleton className="h-5 w-40" />
              ) : preview.data ? (
                <p className="text-sm">
                  This will email <span className="font-medium">{preview.data.recipientCount}</span>{" "}
                  owner
                  {preview.data.recipientCount === 1 ? "" : "s"} in{" "}
                  <span className="font-medium">{SEGMENT_LABELS[segment]}</span>.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={send.isPending || preview.isPending}
                  onClick={() => send.mutate()}
                >
                  {send.isPending ? "Sending..." : "Send now"}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-console-border bg-console-panel p-4 sm:p-5">
        <h2 className="section-title">Recent broadcasts</h2>
        {audit.isLoading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : history.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No broadcasts yet"
              description="Sent announcements will show up here with their segment and recipient count."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-console-border">
            {history.map((row) => (
              <BroadcastHistoryRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BroadcastHistoryRow({
  row,
}: {
  row: { id: string; target_label: string | null; reason: string | null; created_at: string };
}) {
  const label = row.target_label
    ? (SEGMENT_LABELS[row.target_label as BroadcastSegment] ?? row.target_label)
    : "-";
  return (
    <li className="flex flex-wrap items-baseline gap-2 py-2.5 text-sm">
      <span className="font-medium capitalize">{label}</span>
      <span className="console-num ml-auto text-xs text-console-muted">
        {new Date(row.created_at).toLocaleString("en-IN")}
      </span>
    </li>
  );
}
