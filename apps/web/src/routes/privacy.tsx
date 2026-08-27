import { createFileRoute } from "@tanstack/react-router";

import { BRAND, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const PAGE_URL = siteUrl("/privacy");
const TITLE = `Privacy Policy - ${BRAND}`;
const DESCRIPTION = `How ${BRAND} collects, stores and uses data for PG and hostel owners and their tenants.`;
const UPDATED = "27 August 2026";

export const Route = createFileRoute("/privacy")({
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
  }),
  component: PrivacyPage,
});

const sections = [
  {
    title: "1. What this policy covers",
    body: `This policy explains what data ${BRAND} collects when a PG or hostel owner ("you", the account holder) uses the Service, and when that owner enters information about their tenants. It applies to www.pgkhata.com and the app hosted at app.pgkhata.com.`,
  },
  {
    title: "2. Data you give us directly",
    body: "Your name, email, phone number and password when you sign up (or your name and email via Google sign in), your property and room details, and your UPI ID or bank details used to collect rent from your own tenants. We never see or store this UPI collection money; it moves directly between your tenant and your account.",
  },
  {
    title: "3. Tenant data you enter",
    body: "As the account owner, you enter your tenants' name, phone number, email, address proof, deposit and rent details, and payment history so the Service can generate bills and reminders on your behalf. You are responsible for having the tenant's consent to store this information; we act as a data processor on your instructions, not as the party who collected it from the tenant.",
  },
  {
    title: "4. Data collected automatically",
    body: "Standard web server logs (IP address, browser type, pages visited) for security and debugging. We do not use third party advertising trackers or sell any data to advertisers.",
  },
  {
    title: "5. How we use this data",
    body: "To run the Service: generating and sending bills, calculating dues, sending payment reminders by email and WhatsApp, administering your account's messaging allowance, and providing customer support. We do not use tenant data for marketing.",
  },
  {
    title: "6. Who we share data with",
    body: "We share data only with the infrastructure providers needed to run the Service, each acting under their own security and privacy commitments: Supabase (database and file storage, hosted with encryption at rest), Resend (sending bill and reminder emails), and Meta's WhatsApp Cloud API (sending WhatsApp reminders from our official business number). We do not sell or rent data to anyone.",
  },
  {
    title: "7. Data retention",
    body: "We keep your account and tenant data for as long as your account is active, plus a reasonable period after cancellation to allow you to export it. You can request deletion of your account and associated data by writing to support@pgkhata.com; some records may be retained longer where required by Indian tax or accounting law.",
  },
  {
    title: "8. Security",
    body: "Data is stored with Supabase using encryption at rest and access control (row level security) so one owner's account can never read another owner's data. Passwords are never stored in plain text. No system is perfectly secure, and we cannot guarantee absolute security of data transmitted over the internet.",
  },
  {
    title: "9. Your choices",
    body: "You can export your tenant and billing records as PDF or CSV at any time from the Service, correct inaccurate information directly in the app, and close your account by writing to support@pgkhata.com.",
  },
  {
    title: "10. Children's data",
    body: "The Service is intended for business owners running a PG or hostel and is not directed at children. Tenant records may relate to individuals of any age, but the account holder, not a child, controls that data.",
  },
  {
    title: "11. Changes to this policy",
    body: "We may update this policy as the Service changes. Material changes will be reflected on this page with an updated date.",
  },
  {
    title: "12. Contact",
    body: "Questions about this policy, or requests to access or delete data, can be sent to support@pgkhata.com or by phone at +91 82944 95929.",
  },
];

function PrivacyPage() {
  return (
    <div className="marketing min-h-screen bg-cream font-marketing-body text-ink">
      <MarketingNav />
      <main className="px-6 pt-32 pb-16">
        <div className="mx-auto max-w-[760px]">
          <span className="font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
            Ref. Legal
          </span>
          <h1 className="mt-3 font-marketing-display text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold text-ink">
            Privacy Policy
          </h1>
          <p className="mt-3 font-marketing-mono text-[13px] text-ink/55">Last updated {UPDATED}</p>
          <div className="mt-10 border-t-2 border-ink">
            {sections.map((section) => (
              <section key={section.title} className="border-b border-line py-6">
                <h2 className="font-marketing-display text-[18px] font-bold text-ink">
                  {section.title}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/70">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <MarketingFooter maxWidth="760px" />
    </div>
  );
}
