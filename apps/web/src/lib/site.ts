/**
 * The public hostnames, in one place.
 *
 * Marketing (`/`, `/blog/*`) and the owner app (`/_authenticated/*`) are a
 * single build served on two hostnames. A session cookie set on the marketing
 * host is not sent to the app host, so a link that crosses from one to the
 * other has to be absolute — a relative `/auth` would sign the owner in on
 * whichever host they happened to land on.
 *
 * `VITE_APP_URL` is left unset in development and preview builds, which makes
 * `appUrl` fall back to a same-origin path and keeps localhost working.
 */

export const BRAND = "PGKhata";

/** Marketing origin. Absolute, because canonical tags and sitemaps require it. */
export const SITE_URL = import.meta.env["VITE_SITE_URL"] || "https://www.pgkhata.com";

/** Owner app origin. Empty means "same origin as the page being served". */
export const APP_URL = import.meta.env["VITE_APP_URL"] || "";

/** Link from a marketing page into the app. */
export function appUrl(path: string): string {
  return `${APP_URL}${path}`;
}

/** Absolute marketing URL, for canonical tags, og:url and structured data. */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * Hostnames that must never be indexed: the owner app and the internal
 * console. Both serve the same build as the marketing site, so without this
 * every page would be indexed two or three times over.
 */
export function isIndexableHost(hostname: string | undefined | null): boolean {
  if (!hostname) return true;
  const host = hostname.toLowerCase().split(":")[0]!;
  return !host.startsWith("app.") && !host.startsWith("admin.");
}
