import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatedIcon, type AnimatedIconName } from "@/components/animated-icon";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/brand-mark";
import { useBranding } from "@/lib/branding";
import { useAdminProfile } from "@/lib/use-admin-profile";

const items: { title: string; url: string; icon: AnimatedIconName }[] = [
  { title: "Dashboard", url: "/dashboard", icon: "line-md:home-md-twotone" },
  { title: "Properties", url: "/properties", icon: "line-md:grid-3-twotone" },
  { title: "Rooms", url: "/rooms", icon: "line-md:list-3-twotone" },
  { title: "Tenants", url: "/tenants", icon: "line-md:account" },
  { title: "Complaints", url: "/complaints", icon: "line-md:alert-circle-twotone" },
  { title: "Billing", url: "/bills", icon: "line-md:document-twotone" },
  { title: "Payments", url: "/payments", icon: "line-md:clipboard-check" },
  { title: "Readings", url: "/readings", icon: "line-md:gauge-twotone-loop" },
  { title: "Reports", url: "/reports", icon: "line-md:document-report-twotone" },
  { title: "Plan", url: "/plan", icon: "line-md:confirm-circle" },
  { title: "Plan history", url: "/plan-history", icon: "line-md:clipboard-check" },
  { title: "Settings", url: "/settings", icon: "line-md:cog-loop" },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const showLabels = !collapsed;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { brandName } = useBranding();
  // Two owners can share the same brand name ("PG Manager" is the default),
  // so show the signed-in owner's own name underneath it - editable on the
  // Settings page - instead of a generic label that can't tell them apart.
  const { data: profile } = useAdminProfile();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          <BrandMark size={26} priority className="rounded-[7px]" />
          {showLabels && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight">{brandName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {profile?.name || "Admin workspace"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                    tooltip={item.title}
                    className="h-11 text-[15px] md:h-8 md:text-sm"
                  >
                    <Link
                      to={item.url}
                      onClick={() => setOpenMobile(false)}
                      className="group/icon flex items-center gap-2.5"
                    >
                      <AnimatedIcon name={item.icon} replayOnHover className="h-4 w-4 shrink-0" />
                      {showLabels && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sign out"
              className="group/icon h-11 text-[15px] md:h-8 md:text-sm"
            >
              <AnimatedIcon name="line-md:logout" replayOnHover className="h-4 w-4" />
              {showLabels && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
