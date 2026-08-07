import { createFileRoute, Link } from "@tanstack/react-router";

import { BRAND, appUrl, siteUrl } from "@/lib/site";

const PAGE_URL = siteUrl("/privacy");
const TITLE = `Privacy Policy - ${BRAND}`;
const DESCRIPTION = `How ${BRAND} collects, stores and uses data for PG and hostel owners and their tenants.`;
const UPDATED = "7 August 2026";

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
    body: "To run the Service: generating and sending bills, calculating dues, sending payment reminders by email and WhatsApp, processing your subscription payment, and providing customer support. We do not use tenant data for marketing.",
  },
  {
    title: "6. Who we share data with",
    body: "We share data only with the infrastructure providers needed to run the Service, each acting under their own security and privacy commitments: Supabase (database and file storage, hosted with encryption at rest), Resend (sending bill and reminder emails), Meta's WhatsApp Cloud API (sending WhatsApp reminders from our official business number), and Razorpay (processing your subscription payment to us). We do not sell or rent data to anyone.",
  },
  {
    title: "7. Data retention",
    body: "We keep your account and tenant data for as long as your account is active, plus a reasonable period after cancellation to allow you to export it or reactivate. You can request deletion of your account and associated data by writing to support@pgkhata.com; some records may be retained longer where required by Indian tax or accounting law.",
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
          <p className="text-[13px] font-bold tracking-[0.08em] text-clay uppercase">Legal</p>
          <h1 className="mt-4 font-display text-[clamp(32px,4.4vw,52px)] leading-[1.08] font-semibold">
            Privacy Policy
          </h1>
          <p className="mt-4 text-[15px] text-ink/55">Last updated {UPDATED}</p>

          <div className="mt-10 space-y-9">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="font-display text-[21px] font-semibold">{s.title}</h2>
                <p className="mt-2.5 text-[16px] leading-relaxed text-ink/70">{s.body}</p>
              </section>
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
