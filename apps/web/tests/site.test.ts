import { describe, expect, it } from "vitest";
import { SITE_URL, appUrl, isIndexableHost, siteUrl } from "@/lib/site";

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
