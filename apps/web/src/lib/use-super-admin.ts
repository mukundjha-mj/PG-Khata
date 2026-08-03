import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformIdentity } from "@/lib/platform-auth.functions";

/**
 * Identity of the current session across the owner / platform boundary.
 * `isSuperAdmin` alone does not grant access: `mfaSatisfied` must also be true.
 */
export function usePlatformIdentity() {
  const load = useServerFn(getPlatformIdentity);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["platform-identity"],
    queryFn: () => load(),
    staleTime: 60_000,
    retry: false,
  });
  return {
    identity: data ?? null,
    isSuperAdmin: !!data?.isSuperAdmin,
    isLoading,
    refetch,
  };
}
