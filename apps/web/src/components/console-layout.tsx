import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Gauge,
  LayoutGrid,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ConsoleTab =
  | "overview"
  | "owners"
  | "coupons"
  | "revenue"
  | "usage"
  | "health"
  | "audit"
  | "broadcast"
  | "settings";

const NAV: { id: ConsoleTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "owners", label: "PG Owners", icon: Users },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "revenue", label: "Revenue", icon: BarChart3 },
  { id: "usage", label: "Usage and Cost", icon: Gauge },
  { id: "health", label: "System Health", icon: Activity },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "broadcast", label: "Broadcast", icon: Bell },
];

export function ConsoleLayout({
  tab,
  onTab,
  email,
  onSignOut,
  counts,
  search,
  onSearch,
  children,
}: {
  tab: ConsoleTab;
  onTab: (t: ConsoleTab) => void;
  email: string;
  onSignOut: () => void;
  counts: Partial<Record<ConsoleTab, number>>;
  search: string;
  onSearch: (v: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const title = [...NAV, { id: "settings" as const, label: "Settings", icon: Settings }].find(
    (n) => n.id === tab,
  )?.label;

  const nav = (
    <>
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-console-accent">
          <ShieldCheck className="h-5 w-5 text-console-bg" />
        </div>
        <div className="leading-tight">
          <p className="console-display text-base font-semibold">PGKhata</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-console-muted">Control</p>
        </div>
      </div>

      <nav className="space-y-1 px-3">
        {NAV.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={tab === item.id}
            count={counts[item.id]}
            onClick={() => {
              onTab(item.id);
              setOpen(false);
            }}
          />
        ))}
      </nav>

      <p className="px-6 pb-2 pt-6 text-[11px] uppercase tracking-[0.18em] text-console-muted">
        Configuration
      </p>
      <nav className="space-y-1 px-3">
        <NavButton
          item={{ id: "settings", label: "Settings", icon: Settings }}
          active={tab === "settings"}
          onClick={() => {
            onTab("settings");
            setOpen(false);
          }}
        />
      </nav>

      <div className="mt-auto border-t border-console-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-console-raised text-xs font-semibold">
            {email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{email.split("@")[0]}</p>
            <p className="text-[11px] text-console-muted">Super admin</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="ml-auto grid h-9 w-9 place-items-center rounded-md text-console-muted hover:bg-console-raised hover:text-console-fg"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="console-shell dark min-h-screen w-full overflow-x-hidden">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-console-border bg-console-panel lg:flex">
          {nav}
        </aside>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <div className="console-shell dark absolute inset-y-0 left-0 flex w-72 flex-col border-r border-console-border bg-console-panel">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-4 grid h-10 w-10 place-items-center rounded-md text-console-muted"
              >
                <X className="h-5 w-5" />
              </button>
              {nav}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-console-border bg-console-bg px-4 py-4 sm:px-6">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-md border border-console-border lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="page-title truncate">{title}</h1>
              <p className="text-xs text-console-muted">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-console-muted" />
                <input
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search owners"
                  aria-label="Search owners"
                  className="h-11 w-full rounded-lg border border-console-border bg-console-panel pl-9 pr-3 text-sm text-console-fg outline-none placeholder:text-console-muted focus:border-console-accent"
                />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 space-y-5 bg-console-bg p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  count,
  onClick,
}: {
  item: { id: ConsoleTab; label: string; icon: typeof LayoutGrid };
  active: boolean;
  count?: number | undefined;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        active
          ? "bg-console-accent-soft font-medium text-console-fg"
          : "text-console-muted hover:bg-console-raised hover:text-console-fg",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {typeof count === "number" ? (
        <span className="console-num ml-auto rounded-md bg-console-raised px-1.5 py-0.5 text-[11px]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function ConsoleCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-console-border bg-console-panel p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}
