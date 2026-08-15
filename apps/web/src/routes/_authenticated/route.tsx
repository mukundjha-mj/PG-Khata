import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlanStatusBanner } from "@/components/plan-status-banner";
import { AuthenticatedSkeleton } from "@/components/authenticated-skeleton";
import { useBranding } from "@/lib/branding";
import { PropertyScopeProvider } from "@/lib/property-scope";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // The generated route tree imports every route module eagerly, so a static
    // import here would put the Supabase client in the shared entry chunk and
    // ship it to marketing visitors who never sign in.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const userId = data.user.id;
    // Neither check depends on the other, so run them together instead of
    // paying two sequential round trips.
    const [{ data: platform }, { data: settings }] = await Promise.all([
      // Platform team accounts are not PG owners and must never load the owner app.
      supabase.from("super_admins").select("id").eq("id", userId).maybeSingle(),
      // A signup with no active plan and no redeemed coupon never sees the
      // dashboard: it lands on the plan page to pay or redeem a code first. The
      // plan page itself is exempt, since this beforeLoad also runs for it - a
      // plain redirect there would loop forever.
      location.pathname !== "/plan"
        ? supabase.from("settings").select("plan_status").eq("admin_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (platform) throw redirect({ to: "/console" });
    if (settings?.plan_status === "unpaid" || settings?.plan_status === "cancelled") {
      throw redirect({ to: "/plan" });
    }
    return { user: data.user };
  },
  pendingComponent: AuthenticatedSkeleton,
  pendingMs: 0,
  pendingMinMs: 0,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { brandName } = useBranding();
  return (
    <PropertyScopeProvider>
      <SidebarProvider>
        <div className="flex min-h-dvh w-full overflow-x-hidden bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
              <SidebarTrigger className="-ml-1 h-10 w-10 md:h-8 md:w-8" />
              <div className="hidden h-4 w-px bg-border sm:block" />
              <span className="truncate text-[13px] font-medium tracking-tight text-foreground">
                {brandName}
              </span>
              <ThemeToggle className="ml-auto h-10 w-10 md:h-8 md:w-8" />
            </header>
            <PlanStatusBanner />
            <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-8">
              <div className="mx-auto w-full max-w-[1400px]">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PropertyScopeProvider>
  );
}
