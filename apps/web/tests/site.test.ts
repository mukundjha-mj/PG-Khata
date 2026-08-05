import { describe, expect, it } from "vitest";
import { SITE_URL, appUrl, authRedirect, isIndexableHost, siteUrl } from "@/lib/site";

/**
 * Marketing, the owner app and the console are one build on three hostnames.
 * Getting isIndexableHost wrong means Google indexes every page two or three
 * times over, and the sign-in page ends up in search results.
 */

describe("isIndexableHost", () => {
  it("indexes the marketing hosts", () => {
    expect(isIndexableHost("www.pgkhata.com")).toBe(true);
    expect(isIndexableHost("pgkhata.com")).toBe(true);
  });

  it("blocks the app and console hosts", () => {
    expect(isIndexableHost("app.pgkhata.com")).toBe(false);
    expect(isIndexableHost("admin.pgkhata.com")).toBe(false);
  });

  it("ignores case and a port", () => {
    expect(isIndexableHost("APP.PGKhata.com")).toBe(false);
    expect(isIndexableHost("app.pgkhata.com:3000")).toBe(false);
  });

  it("does not block a host that merely contains app or admin", () => {
    expect(isIndexableHost("apps.pgkhata.com")).toBe(true);
    expect(isIndexableHost("administration.pgkhata.com")).toBe(true);
    expect(isIndexableHost("myapp.pgkhata.com")).toBe(true);
  });

  it("indexes by default when the host is unknown", () => {
    expect(isIndexableHost(undefined)).toBe(true);
    expect(isIndexableHost("")).toBe(true);
  });
});

describe("siteUrl", () => {
  it("is absolute, because canonical tags and sitemaps require it", () => {
    expect(siteUrl("/")).toMatch(/^https:\/\//);
    expect(siteUrl("/blog/x")).toBe(`${SITE_URL}/blog/x`);
  });
});

describe("appUrl", () => {
  it("stays same-origin when VITE_APP_URL is unset, so localhost works", () => {
    // Nothing sets it in the test environment, matching development.
    expect(appUrl("/auth")).toBe("/auth");
  });
});

/**
 * Every target built here has to be covered by the Redirect URLs allowlist in
 * the Supabase dashboard. A target that is missing from that list does not
 * error — Supabase quietly substitutes the project's Site URL, and on the app
 * host that serves the marketing landing page, so the owner lands on the
 * pricing table while already signed in.
 *
 * The allowlist holds `https://app.pgkhata.com/**` and
 * `http://localhost:3000/**`. These tests pin the three paths the app actually
 * sends, so a typo or a stray relative path fails here rather than silently in
 * production.
 */
describe("authRedirect", () => {
  it("is absolute, so Supabase can match it against the allowlist", () => {
    expect(authRedirect("https://app.pgkhata.com", "/dashboard")).toBe(
      "https://app.pgkhata.com/dashboard",
    );
  });

  it("keeps the port, so a development origin still matches", () => {
    expect(authRedirect("http://localhost:3000", "/reset-password")).toBe(
      "http://localhost:3000/reset-password",
    );
  });

  it("covers every path the app sends, under a /** allowlist entry", () => {
    // Confirmation and Google both land on /dashboard; recovery on
    // /reset-password. Nothing else is sent to Supabase.
    for (const origin of ["https://app.pgkhata.com", "http://localhost:3000"]) {
      for (const path of ["/dashboard", "/reset-password"]) {
        const target = authRedirect(origin, path);
        expect(target.startsWith(`${origin}/`)).toBe(true);
        // A `/**` entry matches any path on the host, but only on that host.
        expect(new URL(target).origin).toBe(origin);
      }
    }
  });

  it("does not land on the marketing page, which is what the bare origin serves", () => {
    expect(authRedirect("https://app.pgkhata.com", "/dashboard")).not.toBe(
      "https://app.pgkhata.com",
    );
    expect(new URL(authRedirect("https://app.pgkhata.com", "/dashboard")).pathname).not.toBe("/");
  });
});
