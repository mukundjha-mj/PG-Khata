import { createFileRoute } from "@tanstack/react-router";

import { BRAND, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

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
    <div className="marketing min-h-screen bg-cream font-marketing-body text-ink">
      <MarketingNav />

      <main className="px-6 pt-32 pb-16">
        <div className="mx-auto max-w-[760px]">
          <span className="font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
            Ref. Contact
          </span>
          <h1 className="mt-3 font-marketing-display text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold text-ink">
            Contact Us
          </h1>
          <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-ink/65">
            Questions about your account, billing, or how {BRAND} works? Reach us directly, we
            reply from a real inbox, not a ticket queue.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden border-2 border-ink sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="field-box border-ink/10 bg-paper p-6">
                <p className="font-marketing-mono text-[12px] font-bold tracking-wide text-ink/50 uppercase">
                  {d.label}
                </p>
                {d.href ? (
                  <a
                    href={d.href}
                    className="mt-2 block text-[16px] font-medium text-clay-dark hover:underline"
                  >
                    {d.value}
                  </a>
                ) : (
                  <p className="mt-2 text-[16px] font-medium text-ink">{d.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <MarketingFooter maxWidth="760px" />
    </div>
  );
}
