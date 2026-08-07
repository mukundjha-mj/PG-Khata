import { createFileRoute, Link } from "@tanstack/react-router";

import { BRAND, appUrl, siteUrl } from "@/lib/site";

const PAGE_URL = siteUrl("/contact-us");
const TITLE = `Contact Us - ${BRAND}`;
const DESCRIPTION = `Get in touch with the ${BRAND} team for support, billing or general questions.`;

export const Route = createFileRoute("/contact-us")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: BRAND,
          url: siteUrl("/"),
          email: "support@pgkhata.com",
          telephone: "+91-82944-95929",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Noida",
            addressRegion: "Uttar Pradesh",
            postalCode: "203109",
            addressCountry: "IN",
          },
        }),
      },
    ],
  }),
  component: ContactPage,
});

const details = [
  { label: "Support email", value: "support@pgkhata.com", href: "mailto:support@pgkhata.com" },
  { label: "Phone", value: "+91 82944 95929", href: "tel:+918294495929" },
  { label: "Registered address", value: "Noida, Sector 66, Uttar Pradesh 203109, India" },
  { label: "Support hours", value: "Monday to Saturday, 10 AM to 7 PM IST" },
];

function ContactPage() {
  return (
    <div className="marketing min-h-screen bg-cream font-body text-ink">
      <nav className="border-b border-line bg-cream/85 py-4 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold">
            <span className="inline-block h-3 w-3 rotate-45 rounded-[3px] bg-clay" />
            {BRAND}
          </Link>
          <a
            href={appUrl("/auth")}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:-translate-y-px hover:bg-clay"
          >
            Start free trial
          </a>
        </div>
      </nav>

      <main className="px-6 py-16">
        <div className="mx-auto max-w-[760px]">
          <p className="text-[13px] font-bold tracking-[0.08em] text-clay uppercase">
            Get in touch
          </p>
          <h1 className="mt-4 font-display text-[clamp(32px,4.4vw,52px)] leading-[1.08] font-semibold">
            Contact Us
          </h1>
          <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-ink/65">
            Questions about your account, billing, or how {BRAND} works? Reach us directly, we
            reply from a real inbox, not a ticket queue.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="rounded-3xl border border-line bg-paper p-6">
                <p className="text-[13px] font-bold tracking-wide text-ink/50 uppercase">
                  {d.label}
                </p>
                {d.href ? (
                  <a
                    href={d.href}
                    className="mt-2 block text-[17px] font-medium text-clay-dark hover:underline"
                  >
                    {d.value}
                  </a>
                ) : (
                  <p className="mt-2 text-[17px] font-medium">{d.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-[760px] px-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[13px] text-ink/50">
          <span>2026 {BRAND}. Registered in Noida, Uttar Pradesh, India.</span>
          <Link to="/" className="hover:text-clay">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
