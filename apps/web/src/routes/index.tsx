import { useEffect } from "react";
import type { ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { onAdminHost } from "@/lib/admin-host";
import { BRAND, appUrl, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (onAdminHost()) throw redirect({ to: "/console" });
  },
  head: () => ({
    meta: [
      { title: `${BRAND} - PG Billing, Sorted.` },
      {
        name: "description",
        content: `${BRAND} generates rent, electricity and other charges for every PG tenant on the 1st, sends the bill with a UPI pay link, and tracks who has paid.`,
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
    title: "A UPI pay link, built into the bill",
    body: "Tenants tap and pay directly from the bill. Paid bills mark themselves, no follow up needed.",
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
    title: "Tenants get the bill, with a pay link",
    body: "They tap, pay via UPI, and the bill marks itself paid. No app to download, nothing for them to log into.",
  },
  {
    step: "04",
    title: "You check one dashboard",
    body: "See who has paid, who is overdue, and this month's total collection, from your phone, in under a minute.",
  },
];

function useReveal() {
  useEffect(() => {
    document.querySelector(".marketing")?.classList.add("js-reveal-ready");

    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    els.forEach((element) => io.observe(element));

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

function RefTag({ children }: { children: ReactNode }) {
  return (
    <span className="mr-3 font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
      {children}
    </span>
  );
}

function LandingPage() {
  useReveal();

  return (
    <div className="marketing min-h-screen overflow-x-hidden bg-cream font-marketing-body text-ink">
      <MarketingNav />

      <header className="ledger-lines relative overflow-hidden px-6 pt-32 pb-20 sm:pt-36">
        <div className="relative mx-auto grid max-w-[1180px] items-start gap-14 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h1 className="text-balance font-marketing-display text-[clamp(38px,5vw,66px)] leading-[1.05] font-bold tracking-[-0.01em] text-ink">
              Rent day, without the reminders.
            </h1>
            <p className="mt-6 mb-8 max-w-[460px] text-[18px] leading-relaxed text-ink/70">
              {BRAND} generates every tenant&apos;s rent, electricity and other charges on the 1st,
              then sends the bill with a UPI payment link. You just watch the money come in.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={appUrl("/auth")}
                className="inline-flex items-center gap-2.5 border-2 border-ink bg-clay px-7 py-4 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)] transition-transform hover:-translate-y-0.5"
              >
                Get started
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
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-marketing-mono text-[24px] font-bold text-ink">{value}</dt>
                  <dd className="text-[13px] text-ink/70">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

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
              ].map(([label, amount]) => (
                <div
                  key={label}
                  className="flex justify-between border-b border-dashed border-line py-3 text-[14.5px] font-marketing-body"
                >
                  <span className="text-ink/65">{label}</span>
                  <span className="font-marketing-mono">{amount}</span>
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

      <section className="border-t-2 border-ink bg-ink px-6 py-24 text-cream">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="font-marketing-display text-[clamp(22px,3.2vw,42px)] leading-[1.1] font-bold">
            <RefTag>Ref. Old Way</RefTag>
            You did not start a PG business to become a bill sending machine.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden border border-cream/15 md:grid-cols-3">
            {painPoints.map((point) => (
              <div
                key={point.entry}
                className="border-cream/15 bg-ink p-8 md:border-r last:md:border-r-0"
              >
                <span className="font-marketing-mono text-[12px] font-bold tracking-[0.08em] text-clay">
                  ENTRY {point.entry}
                </span>
                <h3 className="mt-3 mb-2 font-marketing-display text-[19px] font-bold">
                  {point.title}
                </h3>
                <p className="text-[14.5px] leading-relaxed text-cream/60">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="font-marketing-display text-[clamp(24px,3.4vw,44px)] font-bold text-ink">
            <RefTag>Ref. Statement</RefTag>
            One dashboard. Every bill sent for you.
          </h2>
          <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink/60">
            Everything a PG owner touches every month, rebuilt so it takes minutes, not evenings.
          </p>
          <div className="mt-10 border-t-2 border-ink">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="grid gap-4 border-b border-line py-6 sm:grid-cols-[1fr_1.4fr] sm:items-center"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-marketing-mono text-[12px] font-bold text-ink/40">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-marketing-display text-[18px] font-bold text-ink">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-[14.5px] leading-relaxed text-ink/65">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="px-6 pb-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="font-marketing-display text-[clamp(22px,3.4vw,44px)] font-bold text-ink">
            <RefTag>Ref. Procedure</RefTag>
            Set it up once. It runs every month after.
          </h2>
          <div className="mt-10 border-t-2 border-ink">
            {steps.map((step) => (
              <div
                key={step.step}
                className="grid items-center gap-6 border-b border-line py-8 sm:grid-cols-[100px_1fr]"
              >
                <span className="field-box px-3 py-2 text-center font-marketing-mono text-[13px] font-bold text-ink">
                  STEP {step.step}
                </span>
                <div>
                  <h3 className="mb-1.5 font-marketing-display text-[18px] font-bold text-ink">
                    {step.title}
                  </h3>
                  <p className="max-w-[560px] text-[14.5px] text-ink/60">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="reveal mx-auto max-w-[1180px] border-2 border-ink bg-paper p-8 sm:p-10">
          <h2 className="font-marketing-display text-[clamp(22px,3.2vw,38px)] font-bold text-ink">
            <RefTag>Ref. Access</RefTag>A simpler start for every owner.
          </h2>
          <p className="mt-4 max-w-[680px] text-[16px] leading-relaxed text-ink/65">
            During our current rollout, property, room, tenant, billing, reporting, and document
            tools are available without a paid plan. WhatsApp delivery uses a monthly account
            allowance managed by PGKhata so we can run messaging responsibly.
          </p>
        </div>
      </section>

      <section className="px-6">
        <div className="reveal mx-auto max-w-[1180px] border-2 border-ink bg-sage-light px-8 py-16 text-center sm:px-16">
          <h2 className="mx-auto font-marketing-display text-[clamp(22px,3.6vw,44px)] font-bold text-ink">
            Stop typing the same bill message thirty times a month.
          </h2>
          <p className="mt-5 mb-8 text-[16px] text-ink/60">
            Set up your first property in minutes.
          </p>
          <a
            href={appUrl("/auth")}
            className="inline-flex items-center gap-2.5 border-2 border-ink bg-clay px-7 py-4 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)] transition-transform hover:-translate-y-0.5"
          >
            Get started
            <Arrow />
          </a>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
