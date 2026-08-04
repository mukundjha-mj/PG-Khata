import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_URL, isIndexableHost } from "@/lib/site";

/**
 * Served as a route rather than a static file because it has to vary by host.
 * `app.` and `admin.` serve the same build as the marketing site, so without a
 * per-host answer Google would index the owner app and the internal console
 * alongside the landing page.
 */

const ALLOWED = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
Disallow: /console
Disallow: /auth

Sitemap: ${SITE_URL}/sitemap.xml
`;

const BLOCKED = `User-agent: *
Disallow: /
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = new URL(request.url).hostname;
        return new Response(isIndexableHost(host) ? ALLOWED : BLOCKED, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
