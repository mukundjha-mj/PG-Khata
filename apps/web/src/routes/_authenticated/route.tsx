import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthenticatedSkeleton } from "@/components/authenticated-skeleton";
import { getOwnerRouteAccess, type OwnerRouteAccess } from "@/lib/owner-route-auth";
import { useBranding } from "@/lib/branding";
import { PropertyScopeProvider } from "@/lib/property-scope";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: loadAuthenticatedOwner,
  pendingComponent: AuthenticatedSkeleton,
  // Avoid replacing the shell for short, uncached auth rechecks.
  pendingMs: 300,
  pendingMinMs: 0,
  component: AuthenticatedLayout,
});

function loadAuthenticatedOwner() {
  const access = getOwnerRouteAccess();
  return access instanceof Promise
    ? access.then(resolveOwnerRouteAccess)
    : resolveOwnerRouteAccess(access);
}

function resolveOwnerRouteAccess(access: OwnerRouteAccess) {
  if (access.kind === "unauthenticated") throw redirect({ to: "/auth" });
  if (access.kind === "platform-admin") throw redirect({ to: "/console" });
  return { user: access.user };
}

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
              <ThemeToggle className="ml-auto" />
            </header>
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
