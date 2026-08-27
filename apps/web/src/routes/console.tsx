import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleDot,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { OwnerDirectory } from "@/components/owner-directory";
import { ConsoleCard, ConsoleLayout, type ConsoleTab } from "@/components/console-layout";
import { BroadcastPanel } from "@/components/broadcast-panel";
import { PlatformSignIn, TotpChallenge, TotpEnroll } from "@/components/platform-auth-gates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformIdentity } from "@/lib/use-super-admin";
import { listAuditLog } from "@/lib/platform-auth.functions";
import {
  getGlobalWhatsAppQuota,
  getPlatformStats,
  listAllAccounts,
  setGlobalWhatsAppQuota,
} from "@/lib/super-admin.functions";
import type { AccountRow, PlatformStats } from "@/lib/super-admin.server";

export const Route = createFileRoute("/console")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PGKhata Control - Super admin" },
      {
        name: "description",
        content:
          "Internal PGKhata platform console for managing PG owner operations and WhatsApp allowances.",
      },
      { property: "og:title", content: "PGKhata Control - Super admin" },
      { property: "og:description", content: "Internal console for the PGKhata platform team." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsolePage,
});

function useSession() {
  return useQuery({
    queryKey: ["console-session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
    staleTime: 60_000,
  });
}

async function signOutEverything(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
  window.location.reload();
}

const inr = (value: number) => `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function ConsolePage() {
  const { data: user, isLoading: sessionLoading } = useSession();
  const { identity, isLoading: identityLoading, refetch } = usePlatformIdentity();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ConsoleTab>("overview");
  const [search, setSearch] = useState("");
  const statsFn = useServerFn(getPlatformStats);
  const accountsFn = useServerFn(listAllAccounts);
  const auditFn = useServerFn(listAuditLog);
  const quotaFn = useServerFn(getGlobalWhatsAppQuota);
  const ready = Boolean(identity?.isSuperAdmin && identity?.mfaSatisfied);
  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => statsFn(),
    enabled: ready,
  });
  const accounts = useQuery({
    queryKey: ["platform-accounts"],
    queryFn: () => accountsFn(),
    enabled: ready,
  });
  const audit = useQuery({
    queryKey: ["platform-audit-log"],
    queryFn: () => auditFn(),
    enabled: ready,
  });
  const defaultQuota = useQuery({
    queryKey: ["global-whatsapp-quota"],
    queryFn: () => quotaFn(),
    enabled: ready,
  });

  if (sessionLoading) return <Loading />;
  if (!user) return <PlatformSignIn />;
  if (identityLoading || !identity) return <Loading />;
  const signOut = () => signOutEverything(queryClient);
  const email = user.email ?? "";
  if (!identity.isSuperAdmin) {
    return (
      <div className="console-shell dark min-h-screen p-6">
        <EmptyState
          title="No platform access"
          description="This console is limited to the PGKhata platform team. PG owner accounts cannot be used here."
        />
      </div>
    );
  }
  const afterMfa = async () => {
    await supabase.auth.refreshSession();
    queryClient.clear();
    await refetch();
    window.location.reload();
  };
  if (!identity.mfaEnrolled) return <TotpEnroll onDone={afterMfa} />;
  if (!identity.mfaSatisfied) return <TotpChallenge onDone={afterMfa} onSignOut={signOut} />;

  const rows = accounts.data ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) =>
        [row.name, row.email, row.brand_name].some((value) => value.toLowerCase().includes(term)),
      )
    : rows;

  return (
    <ConsoleLayout
      tab={tab}
      onTab={setTab}
      email={email}
      onSignOut={signOut}
      counts={{ owners: rows.length }}
      search={search}
      onSearch={setSearch}
    >
      {tab === "overview" ? (
        <Overview
          stats={stats.data}
          loading={stats.isLoading}
          accounts={filtered}
          onOpenOwners={() => setTab("owners")}
        />
      ) : null}
      {tab === "owners" ? (
        <div className="rounded-xl border border-console-border bg-console-panel p-2 sm:p-4">
          <OwnerDirectory accounts={filtered} isLoading={accounts.isLoading} />
        </div>
      ) : null}
      {tab === "usage" ? <Usage stats={stats.data} accounts={rows} /> : null}
      {tab === "health" ? <Health stats={stats.data} /> : null}
      {tab === "audit" ? <AuditLog rows={audit.data ?? []} loading={audit.isLoading} full /> : null}
      {tab === "broadcast" ? <BroadcastPanel /> : null}
      {tab === "settings" ? (
        <PlatformSettings
          defaultLimit={defaultQuota.data?.limit}
          loading={defaultQuota.isLoading}
        />
      ) : null}
    </ConsoleLayout>
  );
}

function Loading() {
  return (
    <div className="console-shell dark min-h-screen space-y-3 p-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function CardTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="section-title">{title}</h2>
      {subtitle ? <p className="text-xs text-console-muted">{subtitle}</p> : null}
    </div>
  );
}

function Metric({
  icon: Icon,
  chip,
  tone = "ok",
  label,
  value,
  hint,
}: {
  icon: typeof TrendingUp;
  chip: string;
  tone?: "ok" | "warn" | "muted";
  label: string;
  value: string;
  hint: string;
}) {
  const textTone =
    tone === "ok"
      ? "text-console-ok"
      : tone === "warn"
        ? "text-console-warn"
        : "text-console-muted";
  return (
    <ConsoleCard>
      <div className="flex items-start justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-console-raised">
          <Icon className="h-4 w-4 text-console-accent" />
        </div>
        <span className={`text-xs font-medium ${textTone}`}>{chip}</span>
      </div>
      <p className="eyebrow mt-4">{label}</p>
      <p className="console-num stat-value mt-1">{value}</p>
      <p className="mt-1 text-xs text-console-muted">{hint}</p>
    </ConsoleCard>
  );
}

function Overview({
  stats,
  loading,
  accounts,
  onOpenOwners,
}: {
  stats: PlatformStats | undefined;
  loading: boolean;
  accounts: AccountRow[];
  onOpenOwners: () => void;
}) {
  const reached = accounts
    .filter((account) => !account.whatsapp_unlimited && account.whatsapp_remaining === 0)
    .slice(0, 6);
  return (
    <>
      {reached.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-console-warn/40 bg-console-accent-soft px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-console-warn" />
          <p className="text-sm">
            {reached.length} owner{reached.length === 1 ? "" : "s"} reached their WhatsApp
            allowance.
          </p>
          <button
            type="button"
            onClick={onOpenOwners}
            className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md border border-console-border px-3 text-sm"
          >
            Review owners
          </button>
        </div>
      ) : null}
      {loading || !stats ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={UserPlus}
            chip={`+ ${stats.newOwners30d}`}
            label="New signups, last 30 days"
            value={String(stats.newOwners30d)}
            hint={`${stats.owners} PG owner accounts`}
          />
          <Metric
            icon={MessageCircle}
            chip={`${stats.quotaReachedOwners} reached`}
            tone={stats.quotaReachedOwners ? "warn" : "ok"}
            label="WhatsApp messages this month"
            value={String(stats.whatsappSentThisMonth)}
            hint={`${stats.unlimitedOwners} owners have unlimited access`}
          />
          <Metric
            icon={Banknote}
            chip={stats.outstanding > 0 ? "Dues open" : "All clear"}
            tone={stats.outstanding > 0 ? "warn" : "ok"}
            label="Collected this month"
            value={inr(stats.collectedThisMonth)}
            hint={`${inr(stats.outstanding)} outstanding across owners`}
          />
          <Metric
            icon={ShieldCheck}
            chip="Operations"
            label="Bills raised this month"
            value={String(stats.billsThisMonth)}
            hint={`${inr(stats.billedThisMonth)} billed platform wide`}
          />
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ConsoleCard>
          <div className="flex flex-wrap items-start gap-3">
            <CardTitle
              title="Owners at their WhatsApp allowance"
              subtitle="Sales and support signal for additional WhatsApp capacity"
            />
            <button
              type="button"
              onClick={onOpenOwners}
              className="ml-auto inline-flex min-h-9 items-center rounded-md border border-console-border px-3 text-sm"
            >
              Manage allowances
            </button>
          </div>
          {reached.length === 0 ? (
            <p className="mt-4 text-sm text-console-muted">
              No owner has exhausted a finite allowance this month.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-console-border">
              {reached.map((account) => (
                <li key={account.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {account.name || account.brand_name}
                    </p>
                    <p className="truncate text-xs text-console-muted">{account.email}</p>
                  </div>
                  <span className="console-num ml-auto text-xs text-console-warn">
                    {account.whatsapp_sent_this_month} / {account.whatsapp_monthly_limit} sent
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ConsoleCard>
        <ConsoleCard>
          <CardTitle title="System health" subtitle="Free-product operations" />
          <div className="mt-4 space-y-3">
            <HealthRow
              ok
              title="Monthly billing run"
              detail={`${stats?.billsThisMonth ?? 0} bills raised this month`}
            />
            <HealthRow
              ok={(stats?.quotaReachedOwners ?? 0) === 0}
              title="WhatsApp allowances"
              detail={`${stats?.quotaReachedOwners ?? 0} owners at their allowance`}
            />
            <HealthRow
              ok={(stats?.outstanding ?? 0) === 0}
              title="Rent collection"
              detail={`${inr(stats?.outstanding ?? 0)} outstanding`}
            />
            <HealthRow
              ok
              title="Console access"
              detail="Two factor enforced, audit log append only"
            />
          </div>
        </ConsoleCard>
      </div>
    </>
  );
}

function Usage({ stats, accounts }: { stats: PlatformStats | undefined; accounts: AccountRow[] }) {
  const top = [...accounts]
    .sort((a, b) => b.whatsapp_sent_this_month - a.whatsapp_sent_this_month)
    .slice(0, 8);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={MessageCircle}
          chip="Calendar month"
          label="WhatsApp messages sent"
          value={String(stats?.whatsappSentThisMonth ?? 0)}
          hint="Successful messages only"
        />
        <Metric
          icon={AlertTriangle}
          chip="Action needed"
          tone={(stats?.quotaReachedOwners ?? 0) > 0 ? "warn" : "ok"}
          label="Owners at allowance"
          value={String(stats?.quotaReachedOwners ?? 0)}
          hint="Use owner controls to adjust"
        />
        <Metric
          icon={TrendingUp}
          chip="Platform"
          label="Active tenants"
          value={String(stats?.activeTenants ?? 0)}
          hint="Across all PG owners"
        />
        <Metric
          icon={ShieldCheck}
          chip="Exceptions"
          label="Unlimited owners"
          value={String(stats?.unlimitedOwners ?? 0)}
          hint="Explicit super-admin overrides"
        />
      </div>
      <ConsoleCard>
        <CardTitle title="Highest WhatsApp usage" subtitle="Current calendar month" />
        <ul className="mt-4 divide-y divide-console-border">
          {top.map((account) => (
            <li key={account.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 truncate text-sm">{account.name || account.brand_name}</span>
              <span className="ml-auto console-num text-xs text-console-muted">
                {account.whatsapp_unlimited
                  ? `${account.whatsapp_sent_this_month} sent · unlimited`
                  : `${account.whatsapp_sent_this_month} / ${account.whatsapp_monthly_limit}`}
              </span>
            </li>
          ))}
          {top.length === 0 ? <p className="text-sm text-console-muted">No owners yet.</p> : null}
        </ul>
      </ConsoleCard>
    </>
  );
}

function Health({ stats }: { stats: PlatformStats | undefined }) {
  return (
    <ConsoleCard>
      <CardTitle title="System health" subtitle="Platform-wide operations" />
      <div className="mt-4 space-y-3">
        <HealthRow
          ok
          title="Monthly billing run"
          detail={`${stats?.billsThisMonth ?? 0} bills raised this month`}
        />
        <HealthRow
          ok
          title="WhatsApp usage accounting"
          detail={`${stats?.whatsappSentThisMonth ?? 0} sent messages this month`}
        />
        <HealthRow
          ok={(stats?.outstanding ?? 0) === 0}
          title="Outstanding dues"
          detail={inr(stats?.outstanding ?? 0)}
        />
        <HealthRow
          ok
          title="Console security"
          detail="Two factor enforced on every platform session"
        />
      </div>
    </ConsoleCard>
  );
}
function HealthRow({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-console-border bg-console-raised px-3 py-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-console-ok" />
      ) : (
        <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-console-warn" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-console-muted">{detail}</p>
      </div>
    </div>
  );
}

type AuditRow = {
  id: string;
  action: string;
  actor_email: string;
  reason: string | null;
  created_at: string;
};
function AuditLog({
  rows,
  loading,
  full = false,
}: {
  rows: AuditRow[];
  loading: boolean;
  full?: boolean;
}) {
  const list = full ? rows : rows.slice(0, 6);
  return (
    <ConsoleCard>
      <CardTitle title="Recent audit activity" subtitle="Sensitive actions across the platform" />
      {loading ? (
        <Skeleton className="mt-4 h-24 w-full" />
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm text-console-muted">No entries yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-console-border">
          {list.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline gap-2 py-2.5 text-sm">
              <span className="font-medium">{row.action.replace(/_/g, " ")}</span>
              <span className="text-console-muted">{row.actor_email}</span>
              {row.reason ? <span className="text-console-muted">- {row.reason}</span> : null}
              <span className="console-num ml-auto text-xs text-console-muted">
                {new Date(row.created_at).toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ConsoleCard>
  );
}

function PlatformSettings({
  defaultLimit,
  loading,
}: {
  defaultLimit: number | undefined;
  loading: boolean;
}) {
  const queryClient = useQueryClient();
  const setQuota = useServerFn(setGlobalWhatsAppQuota);
  const [limit, setLimit] = useState<string | null>(null);
  const value = limit ?? (defaultLimit === undefined ? "" : String(defaultLimit));
  const numericLimit = Number(value);
  const valid = Number.isInteger(numericLimit) && numericLimit >= 0 && numericLimit <= 100_000;
  const save = useMutation({
    mutationFn: () => setQuota({ data: { limit: numericLimit } }),
    onSuccess: () => {
      toast.success("Default WhatsApp allowance updated for future owners");
      queryClient.invalidateQueries({ queryKey: ["global-whatsapp-quota"] });
      queryClient.invalidateQueries({ queryKey: ["platform-audit-log"] });
      setLimit(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (loading) return <Skeleton className="h-48 w-full" />;
  return (
    <ConsoleCard>
      <CardTitle
        title="Default WhatsApp allowance"
        subtitle="Applied only when a new PG owner account is created"
      />
      <div className="mt-5 max-w-md space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="global-whatsapp-quota">Messages per calendar month</Label>
          <Input
            id="global-whatsapp-quota"
            type="number"
            min={0}
            max={100000}
            value={value}
            onChange={(event) => setLimit(event.target.value)}
            className="border-console-border bg-console-raised"
          />
          <p className="text-xs text-console-muted">
            Existing owners keep their own current quota. Change those individually from PG Owners.
          </p>
        </div>
        <Button
          disabled={!valid || save.isPending || numericLimit === defaultLimit}
          onClick={() => save.mutate()}
        >
          Save default for future owners
        </Button>
      </div>
    </ConsoleCard>
  );
}
