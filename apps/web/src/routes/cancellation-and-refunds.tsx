import { createFileRoute, Link } from "@tanstack/react-router";

import { BRAND, appUrl, siteUrl } from "@/lib/site";

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
    title: "1. Free trial",
    body: "Every new account starts with a 14 day free trial with no card required. You can use the Service fully during the trial and decide not to continue at no cost.",
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
            Cancellation and Refunds
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
