import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Infinity as InfinityIcon,
  MessageCircle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { setOwnerWhatsAppQuota } from "@/lib/super-admin.functions";

const PAGE_SIZE = 10;

type Account = {
  id: string;
  name: string;
  email: string;
  brand_name: string;
  created_at: string;
  properties: number;
  rooms: number;
  tenants: number;
  whatsapp_monthly_limit: number;
  whatsapp_unlimited: boolean;
  whatsapp_sent_this_month: number;
  whatsapp_remaining: number | null;
};

type Draft = { limit: string; unlimited: boolean };

const day = (value: string) => new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });

/** Searchable super-admin directory with per-owner WhatsApp quota controls. */
export function OwnerDirectory({
  accounts,
  isLoading,
}: {
  accounts: Account[];
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const setQuota = useServerFn(setOwnerWhatsAppQuota);
  const [search, setSearch] = useState("");
  const [quotaState, setQuotaState] = useState<"all" | "available" | "reached" | "unlimited">(
    "all",
  );
  const [sort, setSort] = useState<"newest" | "usage" | "tenants" | "name">("newest");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const term = useDebouncedValue(search, 300).toLowerCase();

  const save = useMutation({
    mutationFn: (input: { adminId: string; monthlyLimit: number; unlimited: boolean }) =>
      setQuota({ data: input }),
    onSuccess: () => {
      toast.success("WhatsApp allowance updated");
      queryClient.invalidateQueries({ queryKey: ["platform-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      queryClient.invalidateQueries({ queryKey: ["platform-audit-log"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const rows = accounts.filter((account) => {
      const matchesText =
        !term ||
        [account.name, account.email, account.brand_name].some((value) =>
          value.toLowerCase().includes(term),
        );
      const matchesQuota =
        quotaState === "all" ||
        (quotaState === "unlimited" && account.whatsapp_unlimited) ||
        (quotaState === "reached" &&
          !account.whatsapp_unlimited &&
          account.whatsapp_remaining === 0) ||
        (quotaState === "available" &&
          !account.whatsapp_unlimited &&
          (account.whatsapp_remaining ?? 0) > 0);
      return matchesText && matchesQuota;
    });
    return [...rows].sort((a, b) => {
      if (sort === "usage") return b.whatsapp_sent_this_month - a.whatsapp_sent_this_month;
      if (sort === "tenants") return b.tenants - a.tenants;
      if (sort === "name") return (a.name || a.email).localeCompare(b.name || b.email);
      return a.created_at < b.created_at ? 1 : -1;
    });
  }, [accounts, quotaState, sort, term]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtersOn = Boolean(search) || quotaState !== "all" || sort !== "newest";

  const reset = () => {
    setSearch("");
    setQuotaState("all");
    setSort("newest");
    setPage(1);
  };

  const draftFor = (account: Account): Draft =>
    drafts[account.id] ?? {
      limit: String(account.whatsapp_monthly_limit),
      unlimited: account.whatsapp_unlimited,
    };

  const updateDraft = (id: string, patch: Partial<Draft>, account: Account) => {
    setDrafts((currentDrafts) => ({ ...currentDrafts, [id]: { ...draftFor(account), ...patch } }));
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-console-muted">
            PG owner WhatsApp allowances
          </h2>
          <p className="mt-1 text-xs text-console-muted">
            Usage is counted from sent messages since the start of the current calendar month.
          </p>
        </div>
        <span className="text-xs text-console-muted">
          {filtered.length} of {accounts.length} owners
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Search name, email, brand"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="h-11 border-console-border bg-console-raised sm:h-9"
          aria-label="Search owners"
        />
        <select
          value={quotaState}
          onChange={(event) => {
            setQuotaState(event.target.value as typeof quotaState);
            setPage(1);
          }}
          className="h-11 rounded-md border border-console-border bg-console-raised px-3 text-sm sm:h-9"
          aria-label="Filter by WhatsApp allowance state"
        >
          <option value="all">All allowance states</option>
          <option value="available">Messages remaining</option>
          <option value="reached">Allowance reached</option>
          <option value="unlimited">Unlimited</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          className="h-11 rounded-md border border-console-border bg-console-raised px-3 text-sm sm:h-9"
          aria-label="Sort owners"
        >
          <option value="newest">Newest first</option>
          <option value="usage">Most WhatsApp sent</option>
          <option value="tenants">Most tenants</option>
          <option value="name">Name A to Z</option>
        </select>
      </div>

      {filtersOn ? (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9">
          Reset filters
        </Button>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No matching owners"
          description="Try a different search term or clear filters."
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((account) => {
            const draft = draftFor(account);
            const limit = Number(draft.limit);
            const validLimit = Number.isInteger(limit) && limit >= 0 && limit <= 100_000;
            const changed =
              draft.unlimited !== account.whatsapp_unlimited ||
              (validLimit && limit !== account.whatsapp_monthly_limit);
            return (
              <Card key={account.id} className="border-console-border bg-console-panel">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{account.name || account.brand_name}</p>
                      <p className="truncate text-sm text-console-muted">{account.email}</p>
                      <p className="mt-1 text-xs text-console-muted">
                        {account.properties} properties · {account.rooms} rooms · {account.tenants}{" "}
                        active tenants · joined {day(account.created_at)}
                      </p>
                    </div>
                    <QuotaStatus account={account} />
                  </div>

                  <div className="grid gap-3 rounded-lg border border-console-border bg-console-raised p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor={`quota-${account.id}`} className="text-console-muted">
                        Monthly message allowance
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`quota-${account.id}`}
                          type="number"
                          min={0}
                          max={100000}
                          value={draft.limit}
                          disabled={draft.unlimited}
                          onChange={(event) =>
                            updateDraft(account.id, { limit: event.target.value }, account)
                          }
                          className="h-10 border-console-border bg-console-panel"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 shrink-0"
                          disabled={draft.unlimited}
                          onClick={() =>
                            updateDraft(
                              account.id,
                              { limit: String((Number(draft.limit) || 0) + 50) },
                              account,
                            )
                          }
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          50
                        </Button>
                      </div>
                    </div>
                    <div className="flex h-10 items-center gap-2 rounded-md border border-console-border px-3">
                      <Switch
                        id={`unlimited-${account.id}`}
                        checked={draft.unlimited}
                        onCheckedChange={(unlimited) =>
                          updateDraft(account.id, { unlimited }, account)
                        }
                      />
                      <Label htmlFor={`unlimited-${account.id}`} className="cursor-pointer text-sm">
                        Unlimited
                      </Label>
                    </div>
                    <Button
                      className="h-10"
                      disabled={!validLimit || !changed || save.isPending}
                      onClick={() =>
                        save.mutate({
                          adminId: account.id,
                          monthlyLimit: limit,
                          unlimited: draft.unlimited,
                        })
                      }
                    >
                      Save allowance
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-console-muted">
            Page {current} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function QuotaStatus({ account }: { account: Account }) {
  if (account.whatsapp_unlimited) {
    return (
      <Badge variant="outline" className="gap-1 border-console-ok/40 text-console-ok">
        <InfinityIcon className="h-3.5 w-3.5" /> {account.whatsapp_sent_this_month} sent · unlimited
      </Badge>
    );
  }
  const reached = account.whatsapp_remaining === 0;
  return (
    <Badge variant="outline" className={reached ? "border-console-warn/40 text-console-warn" : ""}>
      <MessageCircle className="mr-1 h-3.5 w-3.5" />
      {account.whatsapp_sent_this_month} / {account.whatsapp_monthly_limit} sent ·{" "}
      {account.whatsapp_remaining} left
    </Badge>
  );
}
