import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  pricingPlans as plans,
  includedOnEveryPlan,
  planComparison,
  pricingFaqs,
  tierByKey,
  planTiers,
  enterprisePlan,
} from "@/lib/pricing-plans";
import { rupees, type BillingCycle } from "@/lib/plan-proration";
import { onAdminHost } from "@/lib/admin-host";
import { BRAND, appUrl, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { BillingCycleToggle } from "@/components/billing-cycle-toggle";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (onAdminHost()) throw redirect({ to: "/console" });
  },
  head: () => ({
    meta: [
      { title: `${BRAND} - PG Billing, Sorted.` },
      {
        name: "description",
        content: `${BRAND} generates rent, electricity and other charges for every PG tenant on the 1st, sends the bill with a UPI QR, and tracks who has paid.`,
      },
      { property: "og:title", content: `${BRAND} - PG Billing, Sorted.` },
      {
        property: "og:description",
        content:
          "Automatic monthly rent and electricity bills for PG and hostel owners, with UPI payments and collection tracking.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // Absolute: the same build answers on the app and console subdomains, so a
    // relative canonical would point each host at itself.
    links: [{ rel: "canonical", href: siteUrl("/") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: BRAND,
          url: siteUrl("/"),
          applicationCategory: "BusinessApplication",
          description: "Billing and tenant management for PG and hostel owners across India.",
          offers: {
            "@type": "Offer",
            price: String(tierByKey("starter").amount),
            priceCurrency: "INR",
          },
        }),
      },
    ],
  }),
  component: LandingPage,
});

const painPoints = [
  {
    entry: "01",
    title: "Manual reminders, every month",
    body: "Typing out the same rent and electricity message to thirty different people, one chat at a time.",
  },
  {
    entry: "02",
    title: "Payments lost in the noise",
    body: "Screenshots in a chat, cash in an envelope, no single place to see who has actually paid.",
  },
  {
    entry: "03",
    title: "Tenant records in a register",
    body: "Address proof, room history, deposits, scattered across a notebook and your phone gallery.",
  },
];

const features = [
  {
    title: "Tenants and rooms, organized",
    body: "Name, phone, address proof, room number and size, deposit, every tenant's full record, searchable in seconds.",
  },
  {
    title: "Bills sent automatically",
    body: "On the 1st, every active tenant gets their rent, electricity and other charges, with email delivery you can rely on.",
  },
  {
    title: "UPI QR, built into the bill",
    body: "Tenants scan and pay directly from the bill. Paid bills mark themselves, no follow up needed.",
  },
  {
    title: "Reminders that do not need you",
    body: "Overdue bills get a polite automatic nudge, before you even notice they are late.",
  },
  {
    title: "Your data, backed up daily",
    body: "Every tenant record and payment history, backed up automatically, restorable in one click if anything goes wrong.",
  },
  {
    title: "See collections at a glance",
    body: "Expected versus collected, occupancy, overdue tenants, the whole month's picture on one screen.",
  },
];

const steps = [
  {
    step: "01",
    title: "Add your property, rooms and tenants",
    body: "Room numbers, sizes, rent, and each tenant's details, takes about 15 minutes for a typical PG.",
  },
  {
    step: "02",
    title: "Bills draft themselves on the 1st",
    body: "Rent, electricity and any extra charges are calculated for every tenant, review and approve before sending.",
  },
  {
    step: "03",
    title: "Tenants get the bill, with a QR",
    body: "They scan, pay via UPI, and the bill marks itself paid. No app to download, nothing for them to log into.",
  },
  {
    step: "04",
    title: "You check one dashboard",
    body: "See who has paid, who is overdue, and this month's total collection, from your phone, in under a minute.",
  },
];

function useReveal() {
  useEffect(() => {
    // Content is visible by default (see .marketing .reveal in styles.css).
    // Only opt in to the entrance animation once we know IntersectionObserver
    // can actually run, so a slow connection or a JS error never hides content.
    document.querySelector(".marketing")?.classList.add("js-reveal-ready");

    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** REF tag attached directly to a heading — replaces the banned kicker-above-heading pattern. */
function RefTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-3 font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
      {children}
    </span>
  );
}

function LandingPage() {
  useReveal();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="marketing min-h-screen overflow-x-hidden bg-cream font-marketing-body text-ink">
      <MarketingNav />

      {/* HERO */}
      <header className="ledger-lines relative overflow-hidden px-6 pt-32 pb-20 sm:pt-36">
        <div className="relative mx-auto grid max-w-[1180px] items-start gap-14 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h1 className="font-marketing-display text-[clamp(38px,5vw,66px)] leading-[1.05] font-bold tracking-[-0.01em] text-ink">
              Rent day, without the reminders.
            </h1>
            <p className="mt-6 mb-8 max-w-[460px] text-[18px] leading-relaxed text-ink/70">
              {BRAND} generates every tenant's rent, electricity and other charges on the 1st, then
              sends the bill with a UPI QR and payment link. You just watch the money come in.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={appUrl("/auth")}
                className="inline-flex items-center gap-2.5 border-2 border-ink bg-clay px-7 py-4 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)] transition-transform hover:-translate-y-0.5"
              >
                Start your free month
                <Arrow />
              </a>
              <a
                href="#how"
                className="border-b-2 border-ink px-2 py-4 text-[15px] font-semibold transition-opacity hover:opacity-60"
              >
                See how it works
              </a>
            </div>
            <dl className="mt-14 flex flex-wrap gap-9 border-t border-line pt-6">
              {[
                ["0", "logins your tenants need"],
                ["1st", "of every month, automatically"],
                ["2 min", "to add a new tenant"],
              ].map(([b, s]) => (
                <div key={s}>
                  <dt className="font-marketing-mono text-[24px] font-bold text-ink">{b}</dt>
                  <dd className="text-[13px] text-ink/70">{s}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Bill document mockup — the hero centerpiece, not a small floating card. */}
          <div className="perforated relative mx-auto w-full max-w-[460px] border border-line bg-paper shadow-[var(--marketing-shadow)]">
            <div className="flex items-start justify-between border-b-2 border-ink p-6">
              <div>
                <p className="font-marketing-mono text-[11px] tracking-[0.08em] text-ink/50 uppercase">
                  Bill No. PGK-2026-0847
                </p>
                <p className="mt-1 font-marketing-display text-[19px] font-bold text-ink">
                  Rahul Verma, Room 204
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink/55">August 2026, Sunrise PG</p>
              </div>
              <span className="stamp">Pending</span>
            </div>
            <div className="p-6">
              {[
                ["Room rent", "Rs. 8,500"],
                ["Electricity (42 units)", "Rs. 378"],
                ["Wifi and maintenance", "Rs. 300"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between border-b border-dashed border-line py-3 text-[14.5px] font-marketing-body"
                >
                  <span className="text-ink/65">{k}</span>
                  <span className="font-marketing-mono">{v}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between border-t-2 border-ink pt-4">
                <div>
                  <p className="font-marketing-mono text-[12px] text-ink/55 uppercase">
                    Total due, Aug 10
                  </p>
                  <p className="font-marketing-mono text-[28px] font-bold text-ink">Rs. 9,178</p>
                </div>
                <span className="flex h-14 w-14 items-center justify-center bg-ink text-cream">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="barcode mx-6 mb-6" aria-hidden="true" />
          </div>
        </div>
      </header>

      {/* PAIN */}
      <section className="border-t-2 border-ink bg-ink px-6 py-24 text-cream">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="max-w-[640px] font-marketing-display text-[clamp(28px,3.2vw,42px)] leading-[1.1] font-bold">
            <RefTag>Ref. Old Way</RefTag>
            You did not start a PG business to become a bill sending machine.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden border border-cream/15 md:grid-cols-3">
            {painPoints.map((p) => (
              <div
                key={p.entry}
                className="border-cream/15 bg-ink p-8 md:border-r last:md:border-r-0"
              >
                <span className="font-marketing-mono text-[12px] font-bold tracking-[0.08em] text-clay">
                  ENTRY {p.entry}
                </span>
                <h3 className="mt-3 mb-2 font-marketing-display text-[19px] font-bold">
                  {p.title}
                </h3>
                <p className="text-[14.5px] leading-relaxed text-cream/60">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — bill line-item list, not an icon-tile card grid */}
      <section id="features" className="px-6 py-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="max-w-[640px] font-marketing-display text-[clamp(30px,3.4vw,44px)] font-bold text-ink">
            <RefTag>Ref. Statement</RefTag>
            One dashboard. Every bill sent for you.
          </h2>
          <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink/60">
            Everything a PG owner touches every month, rebuilt so it takes minutes, not evenings.
          </p>
          <div className="mt-10 border-t-2 border-ink">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="grid gap-4 border-b border-line py-6 sm:grid-cols-[1fr_1.4fr] sm:items-center"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-marketing-mono text-[12px] font-bold text-ink/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-marketing-display text-[18px] font-bold text-ink">
                    {f.title}
                  </h3>
                </div>
                <p className="text-[14.5px] leading-relaxed text-ink/65">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="px-6 pb-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="max-w-[640px] font-marketing-display text-[clamp(30px,3.4vw,44px)] font-bold text-ink">
            <RefTag>Ref. Procedure</RefTag>
            Set it up once. It runs every month after.
          </h2>
          <div className="mt-10 border-t-2 border-ink">
            {steps.map((s, i) => (
              <div
                key={s.step}
                className={`grid items-center gap-6 border-b border-line py-8 sm:grid-cols-[100px_1fr]`}
              >
                <span className="field-box px-3 py-2 text-center font-marketing-mono text-[13px] font-bold text-ink">
                  STEP {s.step}
                </span>
                <div>
                  <h3 className="mb-1.5 font-marketing-display text-[18px] font-bold text-ink">
                    {s.title}
                  </h3>
                  <p className="max-w-[560px] text-[14.5px] text-ink/60">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — rate table, not floating cards */}
      <section id="pricing" className="px-6 pb-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="max-w-[640px] font-marketing-display text-[clamp(30px,3.4vw,44px)] font-bold text-ink">
            <RefTag>Ref. Tariff</RefTag>
            Priced for what you actually run.
          </h2>
          <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink/60">
            No setup fees. No per tenant charges hidden in the fine print. Cancel any time.
          </p>

          <div className="mt-8 flex flex-col items-start gap-2">
            <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
            {billingCycle === "annual" ? (
              <p className="text-[13px] text-ink/60">Pay yearly and get roughly 2 months free.</p>
            ) : null}
          </div>

          <div className="mt-6 overflow-hidden border-2 border-ink">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-ink bg-sage-light/50">
                    <th className="px-6 py-4 font-marketing-mono text-[12px] font-bold tracking-[0.06em] text-ink/70 uppercase">
                      Tariff slab
                    </th>
                    {plans.map((p) => {
                      const tier = planTiers.find((t) => t.name === p.name)!;
                      const annualPrice = tier.annualAmount ?? tier.amount * 12;
                      const showingAnnual = billingCycle === "annual";
                      return (
                        <th key={p.name} className="px-6 py-4 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-marketing-display text-[15px] font-bold text-ink uppercase">
                              {p.name}
                            </span>
                            {p.popular && <span className="stamp">Recommended</span>}
                          </div>
                          {showingAnnual ? (
                            <>
                              <p className="mt-1 font-marketing-mono text-[22px] font-bold text-ink">
                                {rupees(annualPrice)}
                                <span className="text-[12px] font-normal text-ink/50">/yr</span>
                              </p>
                              <p className="text-[11.5px] text-ink/50">
                                <span className="line-through">{rupees(tier.amount * 12)}</span>{" "}
                                about {rupees(annualPrice / 12)}/mo
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 font-marketing-mono text-[22px] font-bold text-ink">
                              {p.price}
                              <span className="text-[12px] font-normal text-ink/50">/mo</span>
                            </p>
                          )}
                          <p className="mt-0.5 text-[12px] text-ink/55">{p.sub}</p>
                        </th>
                      );
                    })}
                    <th className="px-6 py-4 text-left">
                      <span className="font-marketing-display text-[15px] font-bold text-ink uppercase">
                        {enterprisePlan.name}
                      </span>
                      <p className="mt-1 font-marketing-mono text-[22px] font-bold text-ink">
                        {enterprisePlan.price}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink/55">{enterprisePlan.sub}</p>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {planComparison.map((row) => {
                    const sameAcrossTiers =
                      row.starter === row.growing &&
                      row.growing === row.scale &&
                      row.scale === row.enterprise;
                    return (
                      <tr
                        key={row.feature}
                        className={`border-b border-line last:border-0 ${sameAcrossTiers ? "opacity-60" : ""}`}
                      >
                        <th scope="row" className="px-6 py-4 text-[14px] font-medium text-ink/80">
                          {row.feature}
                        </th>
                        <td className="px-6 py-4 font-marketing-mono text-[13.5px] text-ink/70">
                          {row.starter}
                        </td>
                        <td className="px-6 py-4 font-marketing-mono text-[13.5px] text-ink/70">
                          {row.growing}
                        </td>
                        <td className="px-6 py-4 font-marketing-mono text-[13.5px] text-ink/70">
                          {row.scale}
                        </td>
                        <td className="px-6 py-4 font-marketing-mono text-[13.5px] text-ink/70">
                          {row.enterprise}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-ink bg-sage-light/30">
                    <td className="px-6 py-4" />
                    {plans.map((p) => (
                      <td key={p.name} className="px-6 py-5">
                        <a
                          href={appUrl("/auth")}
                          className="block border-2 border-ink bg-clay py-3 text-center text-[13.5px] font-semibold text-paper"
                        >
                          Start your free month
                        </a>
                        <p className="mt-2 text-center text-[11.5px] text-ink/55">
                          No card required
                        </p>
                      </td>
                    ))}
                    <td className="px-6 py-5">
                      <a
                        href="/contact-us"
                        className="block border-2 border-ink bg-paper py-3 text-center text-[13.5px] font-semibold text-ink"
                      >
                        Contact us
                      </a>
                      <p className="mt-2 text-center text-[11.5px] text-ink/55">
                        We'll price it with you
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Included on every plan */}
          <div className="reveal field-box mt-10 p-8 sm:p-10" data-label="Included on every plan">
            <ul className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {includedOnEveryPlan.map((it) => (
                <li key={it} className="flex items-start gap-2.5 text-[14px] text-ink/80">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-clay" />
                  {it}
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing FAQ */}
          <div className="reveal mt-8 grid gap-4 sm:grid-cols-2">
            {pricingFaqs.map((f) => (
              <div key={f.q} className="border border-line bg-paper p-6">
                <h3 className="font-marketing-display text-[16px] font-bold text-ink">{f.q}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/65">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6">
        <div className="reveal mx-auto max-w-[1180px] border-2 border-ink bg-sage-light px-8 py-16 text-center sm:px-16">
          <h2 className="mx-auto max-w-[640px] font-marketing-display text-[clamp(28px,3.6vw,44px)] font-bold text-ink">
            Stop typing the same bill message thirty times a month.
          </h2>
          <p className="mt-5 mb-8 text-[16px] text-ink/60">
            Set up your first property free, no card required.
          </p>
          <a
            href={appUrl("/auth")}
            className="inline-flex items-center gap-2.5 border-2 border-ink bg-clay px-7 py-4 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)] transition-transform hover:-translate-y-0.5"
          >
            Start your free month
            <Arrow />
          </a>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
