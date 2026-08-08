import { createFileRoute } from "@tanstack/react-router";

import { BRAND, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const PAGE_URL = siteUrl("/terms");
const TITLE = `Terms and Conditions - ${BRAND}`;
const DESCRIPTION = `The terms that govern using ${BRAND}, the billing and tenant management platform for PG and hostel owners.`;
const UPDATED = "7 August 2026";

export const Route = createFileRoute("/terms")({
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
  component: TermsPage,
});

const sections = [
  {
    title: "1. Who these terms apply to",
    body: `These terms govern any use of ${BRAND} (the "Service"), a web application that helps PG and hostel owners in India manage tenants, rooms and monthly billing. By creating an account or using the Service, you agree to these terms on behalf of yourself and the business you represent.`,
  },
  {
    title: "2. What the Service does",
    body: `${BRAND} lets an owner record properties, rooms and tenants, generate monthly rent and utility bills, collect payments via UPI, and send reminders by email and WhatsApp. The Service does not hold, transfer or process rent money itself; tenants pay the owner directly, and any UPI QR or link shown on a bill routes payment straight to the owner's own bank account or UPI ID.`,
  },
  {
    title: "3. Your account",
    body: "You are responsible for the accuracy of the property, tenant and billing information you enter, and for keeping your login credentials confidential. You must be at least 18 years old and legally able to run the business you are using the Service for.",
  },
  {
    title: "4. Subscription, trial and payment",
    body: "New accounts get a 14 day free trial with no card required. After the trial, continued use requires an active paid plan, billed monthly in advance and priced by the number of rooms on your account, as shown on the pricing page at the time of purchase. Subscription payments are processed by Razorpay; we do not store your card or bank details.",
  },
  {
    title: "5. Changing or cancelling your plan",
    body: "You can upgrade, downgrade or cancel your subscription at any time from Settings. Upgrades take effect immediately with the remaining days of your current cycle credited toward the new plan. Downgrades and cancellations take effect from your next renewal date; you keep your current plan's features until then. See the Cancellation and Refunds policy for details.",
  },
  {
    title: "6. Tenant data you upload",
    body: "Tenant records, address proof and payment history you enter belong to you as the property owner. You are responsible for having the right to collect and store this information under applicable Indian law, including consent from your tenants where required. We process this data only to run the Service on your behalf, as described in the Privacy Policy.",
  },
  {
    title: "7. Acceptable use",
    body: "You agree not to use the Service to send unlawful, harassing or misleading communications to tenants, to attempt to bypass billing limits, or to interfere with the platform's normal operation. We may suspend an account that we reasonably believe is being used this way.",
  },
  {
    title: "8. Third party services",
    body: "The Service relies on third parties to work: Razorpay for subscription payments, Supabase for data storage, Resend for transactional email, and the Meta WhatsApp Cloud API for WhatsApp reminders. Their availability affects ours; we are not liable for outages or failures originating on their end.",
  },
  {
    title: "9. Availability and liability",
    body: `The Service is provided on an "as is" basis without warranties of any kind. We take reasonable care with backups and uptime but do not guarantee uninterrupted access. To the extent permitted by law, ${BRAND}'s liability for any claim arising from your use of the Service is limited to the subscription fees you paid in the three months before the claim arose.`,
  },
  {
    title: "10. Changes to these terms",
    body: "We may update these terms as the Service changes. Material changes will be reflected on this page with an updated date; continued use after a change means you accept the revised terms.",
  },
  {
    title: "11. Governing law",
    body: "These terms are governed by the laws of India. Any dispute will be subject to the exclusive jurisdiction of the courts in Gautam Buddh Nagar, Uttar Pradesh.",
  },
  {
    title: "12. Contact",
    body: "Questions about these terms can be sent to support@pgkhata.com.",
  },
];

function TermsPage() {
  return (
    <div className="marketing min-h-screen bg-cream font-marketing-body text-ink">
      <MarketingNav />

      <main className="px-6 pt-32 pb-16">
        <div className="mx-auto max-w-[760px]">
          <span className="font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
            Ref. Legal
          </span>
          <h1 className="mt-3 font-marketing-display text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold text-ink">
            Terms and Conditions
          </h1>
          <p className="mt-3 font-marketing-mono text-[13px] text-ink/55">
            Last updated {UPDATED}
          </p>

          <div className="mt-10 border-t-2 border-ink">
            {sections.map((s) => (
              <section key={s.title} className="border-b border-line py-6">
                <h2 className="font-marketing-display text-[18px] font-bold text-ink">
                  {s.title}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/70">{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>

      <MarketingFooter maxWidth="760px" />
    </div>
  );
}
