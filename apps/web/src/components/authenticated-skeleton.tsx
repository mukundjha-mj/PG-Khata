import { Skeleton } from "@/components/ui/skeleton";

const NAV_ITEM_COUNT = 12;

/**
 * Stand-in for AuthenticatedLayout while beforeLoad (auth + plan-status
 * checks) is in flight. `_authenticated` is `ssr: false`, so without this the
 * user sees a blank tab until those checks resolve - matches the real
 * sidebar/header shape so nothing jumps once it does.
 */
export function AuthenticatedSkeleton() {
  return (
    <div className="flex min-h-dvh w-full overflow-x-hidden bg-background">
      <aside className="hidden h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-3 py-2">
          <Skeleton className="h-[26px] w-[26px] shrink-0 rounded-[7px]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>

        <div className="flex-1 space-y-1 px-3 py-3">
          <Skeleton className="mb-2 h-2.5 w-16" />
          {Array.from({ length: NAV_ITEM_COUNT }).map((_, i) => (
            <div key={i} className="flex h-8 items-center gap-2.5 px-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex h-8 items-center gap-2.5 px-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
          <Skeleton className="h-8 w-8 shrink-0 rounded-md md:h-8 md:w-8" />
          <div className="hidden h-4 w-px bg-border sm:block" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="ml-auto h-8 w-8 shrink-0 rounded-md" />
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-40 w-full" />
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
