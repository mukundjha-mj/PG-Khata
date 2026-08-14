import { createFileRoute } from "@tanstack/react-router";

import { BRAND, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const PAGE_URL = siteUrl("/cancellation-and-refunds");
const TITLE = `Cancellation and Refunds Policy - ${BRAND}`;
const DESCRIPTION = `How cancelling or changing your ${BRAND} subscription works, and our refund policy.`;
const UPDATED = "7 August 2026";

export const Route = createFileRoute("/cancellation-and-refunds")({
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
  component: CancellationPage,
});

const sections = [
  {
    title: "1. Trial access",
    body: "New accounts require an active paid plan before use. Trial access, where offered, is granted only through a coupon code and is not available to every signup.",
  },
  {
    title: "2. Cancelling your subscription",
    body: "You can cancel your subscription at any time from Settings. Cancelling stops future billing; you keep access to your current plan's features until the end of the month you already paid for, and your data remains exportable as PDF and CSV after that.",
  },
  {
    title: "3. Downgrading your plan",
    body: "Moving to a lower tier takes effect from your next renewal date. You keep your current plan's features until then, nothing is charged immediately, and no refund is issued for the unused time on your current plan since it carries over to the end of the paid cycle.",
  },
  {
    title: "4. Upgrading your plan",
    body: "Moving to a higher tier takes effect immediately. You pay the difference for the days remaining in your current billing cycle, calculated after crediting the unused portion of your current plan; from your next renewal you are billed the new plan's full monthly price.",
  },
  {
    title: "5. Refunds",
    body: "Subscription fees already charged for a billing cycle are not refunded if you cancel or downgrade partway through that cycle, since you retain access to the plan's features for the rest of the period you paid for. If you believe you were charged in error, for example a duplicate charge or a payment failure that still debited your account, write to support@pgkhata.com with your registered email and the payment reference; verified billing errors are refunded to the original payment method within 7 working days.",
  },
  {
    title: "6. Failed or disputed payments",
    body: "If a renewal payment fails, we will notify you by email and give you a short grace period to update your payment method before any plan features are restricted. If you dispute a charge directly with your bank or Razorpay without contacting us first, we reserve the right to suspend the account under dispute until it is resolved.",
  },
  {
    title: "7. Contact",
    body: "For any billing, cancellation or refund question, write to support@pgkhata.com or call +91 82944 95929.",
  },
];

function CancellationPage() {
  return (
    <div className="marketing min-h-screen bg-cream font-marketing-body text-ink">
      <MarketingNav />

      <main className="px-6 pt-32 pb-16">
        <div className="mx-auto max-w-[760px]">
          <span className="font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
            Ref. Legal
          </span>
          <h1 className="mt-3 font-marketing-display text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold text-ink">
            Cancellation and Refunds
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
