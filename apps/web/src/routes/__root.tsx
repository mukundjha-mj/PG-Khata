import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import appLogo from "@/assets/logo.png";
import { Toaster } from "@/components/ui/sonner";
import { BrandingProvider } from "@/lib/branding";
import { invalidateOwnerRouteAccess } from "@/lib/owner-route-auth";
import { BRAND } from "@/lib/site";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${BRAND} - Tenants, Rooms & Rent Billing` },
      {
        name: "description",
        content:
          "Admin console for PG and hostel owners: manage tenants, rooms, occupancy and monthly rent billing in one place.",
      },
      { name: "author", content: BRAND },
      { property: "og:title", content: `${BRAND} - Tenants, Rooms & Rent Billing` },
      {
        property: "og:description",
        content: "Manage PG tenants, rooms, occupancy and monthly rent billing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: appLogo },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,450;0,9..144,600;0,9..144,700;1,9..144,450&family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@300;400;500;600;700&family=Archivo+Narrow:wght@500;600;700&family=JetBrains+Mono:wght@400;700&family=Work+Sans:wght@400;500;600&display=swap",
      },
    ],
    scripts: import.meta.env.PROD
      ? [
          {
            async: true,
            src: "https://www.googletagmanager.com/gtag/js?id=G-T2R5JJZKGK",
          },
          {
            children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-T2R5JJZKGK');`,
          },
          {
            children: `(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "y8utmbgh5u");`,
          },
        ]
      : [],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // The root wraps the marketing pages too, so the Supabase client is loaded
    // here rather than imported at module scope — otherwise every visitor to
    // the landing page downloads the auth client to run a listener that will
    // never fire for them.
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;

        invalidateOwnerRouteAccess();
        if (event === "SIGNED_OUT") {
          queryClient.clear();
          void router.navigate({ to: "/auth", replace: true });
          return;
        }

        router.invalidate();
        queryClient.invalidateQueries();
      });
      // The effect can be torn down before the import resolves; without this
      // the listener would outlive it and keep invalidating a stale router.
      if (cancelled) sub.subscription.unsubscribe();
      else unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster richColors position="top-right" />
      </BrandingProvider>
    </QueryClientProvider>
  );
}
