import { useState } from "react";
import { Copy, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

type Props = {
  label: string;
  description: string;
  url: string | null;
  isActive: boolean;
  loading: boolean;
  onRegenerate: () => void;
  onToggleActive: (isActive: boolean) => void;
  regenerating: boolean;
  togglingActive: boolean;
};

/** Copy / regenerate / activate-toggle UI for a shareable per-property link. */
export function ShareLinkCard({
  label,
  description,
  url,
  isActive,
  loading,
  onRegenerate,
  onToggleActive,
  regenerating,
  togglingActive,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <Switch
          aria-label={`Enable ${label}`}
          checked={isActive}
          disabled={loading || togglingActive}
          onCheckedChange={onToggleActive}
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-1.5">
        <input
          readOnly
          value={loading ? "Loading…" : (url ?? "")}
          className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          aria-label="Copy link"
          disabled={loading || !url}
          onClick={copy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          aria-label="Regenerate link"
          disabled={loading || regenerating}
          onClick={() => setConfirmRegenerate(true)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate this link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current link will stop working immediately. Anyone who still has it won't be able
              to use it - share the new one instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRegenerate();
                setConfirmRegenerate(false);
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
