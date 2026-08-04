import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CircleDot,
  Clock,
  ShieldCheck,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { OwnerDirectory } from "@/components/owner-directory";
import { ConsoleCard, ConsoleLayout, type ConsoleTab } from "@/components/console-layout";
import { PlatformSignIn, TotpChallenge, TotpEnroll } from "@/components/platform-auth-gates";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformIdentity } from "@/lib/use-super-admin";
import { listAuditLog } from "@/lib/platform-auth.functions";
import { getPlatformStats, listAllAccounts } from "@/lib/super-admin.functions";
import type { AccountRow, PlatformStats } from "@/lib/super-admin.server";

export const Route = createFileRoute("/console")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PGKhata Control - Super admin" },
      {
        name: "description",
        content: "Internal PGKhata platform console for managing every PG owner account.",
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

const inr = (n: number) => "Rs. " + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

function ConsolePage() {
  const { data: user, isLoading: sessionLoading } = useSession();
  const { identity, isLoading: identityLoading, refetch } = usePlatformIdentity();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ConsoleTab>("overview");
  const [search, setSearch] = useState("");

  const statsFn = useServerFn(getPlatformStats);
  const accountsFn = useServerFn(listAllAccounts);
  const auditFn = useServerFn(listAuditLog);

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
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        [r.name, r.email, r.brand_name].some((v) => (v ?? "").toLowerCase().includes(q)),
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
          accountsLoading={accounts.isLoading}
          audit={audit.data ?? []}
          onOpenOwners={() => setTab("owners")}
        />
      ) : null}

      {tab === "owners" ? (
        <div className="rounded-xl border border-console-border bg-console-panel p-2 sm:p-4">
          <OwnerDirectory accounts={filtered} isLoading={accounts.isLoading} />
        </div>
      ) : null}

      {tab === "revenue" ? <Revenue stats={stats.data} loading={stats.isLoading} /> : null}

      {tab === "usage" ? <Usage stats={stats.data} accounts={rows} /> : null}

      {tab === "health" ? <Health stats={stats.data} /> : null}

      {tab === "audit" ? <AuditLog rows={audit.data ?? []} loading={audit.isLoading} full /> : null}

      {tab === "broadcast" ? (
        <ConsoleCard>
          <CardTitle
            title="Platform broadcast"
            subtitle="Send an announcement to every PG owner, or to one plan tier"
          />
          <p className="mt-4 text-sm text-console-muted">
            Broadcasting is not switched on yet. Once messaging delivery is configured, drafts sent
            from here will be logged in the audit trail with the recipient segment.
          </p>
        </ConsoleCard>
      ) : null}

      {tab === "settings" ? (
        <ConsoleCard>
          <CardTitle title="Platform settings" subtitle="Security posture of this console" />
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Fact label="Signed in as" value={email} />
            <Fact label="Two factor" value={identity.mfaEnrolled ? "Enabled (TOTP)" : "Not set"} />
            <Fact label="Session assurance" value={identity.mfaSatisfied ? "aal2" : "aal1"} />
            <Fact label="Audit log" value="Append only" />
          </dl>
        </ConsoleCard>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-console-border bg-console-raised px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-console-muted">{label}</dt>
      <dd className="truncate text-sm">{value}</dd>
    </div>
  );
}

function Metric({
  icon: Icon,
  chip,
  chipTone = "ok",
  label,
  value,
  hint,
}: {
  icon: typeof TrendingUp;
  chip: string;
  chipTone?: "ok" | "warn" | "muted";
  label: string;
  value: string;
  hint: string;
}) {
  const tone =
    chipTone === "ok"
      ? "text-console-ok"
      : chipTone === "warn"
        ? "text-console-warn"
        : "text-console-muted";
  return (
    <ConsoleCard>
      <div className="flex items-start justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-console-raised">
          <Icon className="h-4 w-4 text-console-accent" />
        </div>
        <span className={`text-xs font-medium ${tone}`}>{chip}</span>
      </div>
      <p className="eyebrow mt-4">{label}</p>
      <p className="console-num stat-value mt-1">{value}</p>
      <p className="mt-1 text-xs text-console-muted">{hint}</p>
    </ConsoleCard>
  );
}

type AuditRow = {
  id: string;
  action: string;
  actor_email: string;
  reason: string | null;
  created_at: string;
};

function Overview({
  stats,
  loading,
  accounts,
  accountsLoading,
  audit,
  onOpenOwners,
}: {
  stats: PlatformStats | undefined;
  loading: boolean;
  accounts: AccountRow[];
  accountsLoading: boolean;
  audit: AuditRow[];
  onOpenOwners: () => void;
}) {
  const attention = useMemo(
    () => accounts.filter((a) => a.plan_status !== "active" || a.pending_plan).slice(0, 6),
    [accounts],
  );

  return (
    <>
      {attention.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-console-border bg-console-accent-soft px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-console-warn" />
          <p className="text-sm">
            {attention.length} PG owner{attention.length === 1 ? "" : "s"} need a look at their
            subscription.
          </p>
          <button
            type="button"
            onClick={onOpenOwners}
            className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md border border-console-border px-3 text-sm"
          >
            Review owners <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {loading || !stats ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={TrendingUp}
            chip={`${stats.payingOwners} paying`}
            label="Monthly recurring revenue"
            value={inr(stats.mrr)}
            hint={`${stats.owners} PG owner accounts`}
          />
          <Metric
            icon={UserPlus}
            chip={`+ ${stats.newOwners30d}`}
            label="New signups, last 30 days"
            value={String(stats.newOwners30d)}
            hint={`${stats.trialOwners} on trial, ${stats.payingOwners} paying`}
          />
          <Metric
            icon={Banknote}
            chip={stats.outstanding > 0 ? "Dues open" : "All clear"}
            chipTone={stats.outstanding > 0 ? "warn" : "ok"}
            label="Collected this month"
            value={inr(stats.collectedThisMonth)}
            hint={`${inr(stats.outstanding)} outstanding across owners`}
          />
          <Metric
            icon={ShieldCheck}
            chip="All clear"
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
              title="PG owners needing attention"
              subtitle="Overdue payments, expiring trials, and pending plan changes"
            />
            <button
              type="button"
              onClick={onOpenOwners}
              className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md border border-console-border px-3 text-sm"
            >
              View all
            </button>
          </div>

          {accountsLoading ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : attention.length === 0 ? (
            <p className="mt-4 text-sm text-console-muted">
              Every owner account is active with nothing pending.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-console-border">
              {attention.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.brand_name || a.name}</p>
                    <p className="truncate text-xs text-console-muted">{a.email}</p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Tag>{a.plan}</Tag>
                    <Tag tone={a.plan_status === "active" ? "ok" : "warn"}>
                      {a.plan_status.replace(/_/g, " ")}
                    </Tag>
                    <span className="console-num text-xs text-console-muted">
                      {a.rooms} rooms, {a.tenants} tenants
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ConsoleCard>

        <ConsoleCard>
          <CardTitle title="System health" subtitle="Platform wide job status" />
          <div className="mt-4 space-y-3">
            <HealthRow
              ok
              title="Monthly billing run"
              detail={`${stats?.billsThisMonth ?? 0} bills raised this month`}
            />
            <HealthRow
              ok
              title="Plan payments"
              detail={`${inr(stats?.planRevenueCaptured ?? 0)} captured to date`}
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

      <AuditLog rows={audit} loading={false} />
    </>
  );
}

function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "text-console-ok"
      : tone === "warn"
        ? "text-console-warn"
        : "text-console-muted";
  return (
    <span
      className={`rounded-md border border-console-border bg-console-raised px-2 py-0.5 text-[11px] capitalize ${cls}`}
    >
      {children}
    </span>
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

function Revenue({ stats, loading }: { stats: PlatformStats | undefined; loading: boolean }) {
  if (loading || !stats) return <Skeleton className="h-64 w-full" />;
  const mix = [
    { label: "Starter", value: stats.planCounts.starter },
    { label: "Growing", value: stats.planCounts.growing },
    { label: "Scale", value: stats.planCounts.scale },
  ];
  const max = Math.max(1, ...mix.map((m) => m.value));

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={TrendingUp}
          chip="Monthly"
          label="Recurring revenue"
          value={inr(stats.mrr)}
          hint={`${stats.payingOwners} paying owners`}
        />
        <Metric
          icon={Banknote}
          chip="Lifetime"
          label="Plan revenue captured"
          value={inr(stats.planRevenueCaptured)}
          hint="Successful plan payments"
        />
        <Metric
          icon={Clock}
          chip="Trials"
          chipTone="warn"
          label="Owners on trial"
          value={String(stats.trialOwners)}
          hint="Not yet converted"
        />
        <Metric
          icon={Banknote}
          chip="This month"
          label="Rent collected"
          value={inr(stats.collectedThisMonth)}
          hint={`${inr(stats.billedThisMonth)} billed`}
        />
      </div>

      <ConsoleCard>
        <CardTitle title="Plan mix" subtitle="Active owner accounts by tier" />
        <div className="mt-5 flex h-40 items-end gap-6">
          {mix.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="console-num text-xs text-console-muted">{m.value}</span>
              <div
                className="w-full rounded-t-md bg-console-accent"
                style={{ height: `${(m.value / max) * 100}%`, minHeight: 6 }}
              />
              <span className="text-xs text-console-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </ConsoleCard>
    </>
  );
}

function Usage({ stats, accounts }: { stats: PlatformStats | undefined; accounts: AccountRow[] }) {
  const top = [...accounts].sort((a, b) => b.rooms - a.rooms).slice(0, 8);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={TrendingUp}
          chip="Platform"
          label="Properties"
          value={String(stats?.properties ?? 0)}
          hint="Across all owners"
        />
        <Metric
          icon={TrendingUp}
          chip="Platform"
          label="Rooms"
          value={String(stats?.rooms ?? 0)}
          hint="Managed inventory"
        />
        <Metric
          icon={TrendingUp}
          chip="Platform"
          label="Active tenants"
          value={String(stats?.activeTenants ?? 0)}
          hint="Currently checked in"
        />
        <Metric
          icon={Banknote}
          chip="This month"
          label="Bills raised"
          value={String(stats?.billsThisMonth ?? 0)}
          hint={inr(stats?.billedThisMonth ?? 0)}
        />
      </div>

      <ConsoleCard>
        <CardTitle title="Heaviest accounts" subtitle="Owners using the most room capacity" />
        <ul className="mt-4 divide-y divide-console-border">
          {top.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 truncate text-sm">{a.brand_name || a.name}</span>
              <span className="ml-auto console-num text-xs text-console-muted">
                {a.properties} properties, {a.rooms} rooms, {a.tenants} tenants
              </span>
            </li>
          ))}
          {top.length === 0 ? <p className="text-sm text-console-muted">No accounts yet.</p> : null}
        </ul>
      </ConsoleCard>
    </>
  );
}

function Health({ stats }: { stats: PlatformStats | undefined }) {
  return (
    <ConsoleCard>
      <CardTitle title="System health" subtitle="Platform wide job status" />
      <div className="mt-4 space-y-3">
        <HealthRow
          ok
          title="Monthly billing run"
          detail={`${stats?.billsThisMonth ?? 0} bills raised this month`}
        />
        <HealthRow
          ok
          title="Payment capture"
          detail={`${inr(stats?.collectedThisMonth ?? 0)} collected this month`}
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
