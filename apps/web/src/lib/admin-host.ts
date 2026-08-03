/**
 * The super admin console is served from its own subdomain, e.g. admin.basera.app.
 * Owners never see it on the main site.
 */
export function isAdminHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return host === "admin" || host.startsWith("admin.");
}

/** True when the current browser window is on the super admin subdomain. */
export function onAdminHost(): boolean {
  if (typeof window === "undefined") return false;
  return isAdminHost(window.location.hostname);
}
