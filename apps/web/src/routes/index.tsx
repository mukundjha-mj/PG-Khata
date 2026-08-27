import { useEffect } from "react";
import type { ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { onAdminHost } from "@/lib/admin-host";
import fullLogo from "@/assets/full logo.png";
import { BRAND, appUrl, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const FAQS = [
  {
    question: "How does PGKhata automate PG rent collection?",
    answer:
      "On the 1st of every month, PGKhata drafts rent, electricity, and other charges for each active tenant. You review and approve the bills, then tenants receive a UPI payment link and you can track payment status in one dashboard.",
  },
  {
    question: "Is PGKhata free for PG owners?",
    answer:
      "During the current rollout, PGKhata's property, room, tenant, billing, reporting, and document tools are available without a paid plan. A monthly WhatsApp delivery allowance is included while the rollout is active.",
  },
  {
    question: "Do tenants need to install an app?",
    answer:
      "No. Tenants can open their bill, use its UPI payment link, and pay without downloading an app or creating an account.",
  },
] as const;

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (onAdminHost()) throw redirect({ to: "/console" });
  },
  head: () => ({
    meta: [
      { title: `${BRAND} | PG Billing & Rent Collection on Autopilot` },
      {
        name: "description",
        content:
          "PGKhata helps PG and hostel owners in India draft bills, send UPI payment links, track payments, and manage tenant records without chasing tenants every month.",
      },
      { property: "og:title", content: `${BRAND}: PG billing on autopilot.` },
      {
        property: "og:description",
        content:
          "Generate rent and electricity bills, send UPI payment links, and track payments automatically, without chasing tenants every month.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${BRAND} | PG Billing on Autopilot` },
      {
        name: "twitter:description",
        content:
          "Generate bills, send UPI payment links, and track payments for your PG from one dashboard.",
      },
      { property: "og:image", content: siteUrl(fullLogo) },
      { property: "og:image:alt", content: `${BRAND} logo` },
      { name: "twitter:image", content: siteUrl(fullLogo) },
      { name: "twitter:image:alt", content: `${BRAND} logo` },
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
          image: siteUrl(fullLogo),
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          areaServed: {
            "@type": "Country",
            name: "India",
          },
          description:
            "PG billing, UPI rent collection, and tenant management software for PG and hostel owners in India.",
          featureList: [
            "Monthly rent and electricity bill drafting",
            "UPI payment links and payment tracking",
            "Tenant, room, and property records",
            "Automatic overdue payment reminders",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        }),
      },
    ],
  }),
  component: LandingPage,
});

const painPoints = [
  {
    entry: "01",
    title: "Typing 30 WhatsApp messages",
    body: "Calculating electricity and writing individual rent messages for every room, one chat at a time.",
  },
  {
    entry: "02",
    title: "Hunting for payment proof",
    body: "Screenshots in chats, cash envelopes, and bank statements with no single view of who has paid.",
  },
  {
    entry: "03",
    title: "Scattered records",
    body: "Deposits in a register and address proofs buried in your phone gallery.",
  },
];

const features = [
  {
    title: "Tenants and rooms, organized",
    body: "Name, phone, address proof, room number, rent, and deposit. Every tenant record is searchable in seconds.",
  },
  {
    title: "Bills sent automatically",
    body: "On the 1st, every active tenant gets rent, electricity, and other charges. Review, approve, and send.",
  },
  {
    title: "A UPI pay link, built right in",
    body: "Tenants tap and pay from the bill. Paid bills mark themselves, so you do not chase screenshots.",
  },
  {
    title: "Reminders that do not need you",
    body: "Overdue bills get a polite automatic nudge before you even notice they are late.",
  },
  {
    title: "Your data, backed up daily",
    body: "Every tenant record and payment history is backed up automatically and restorable in one click.",
  },
  {
    title: "See collections at a glance",
    body: "Expected versus collected, occupancy, and overdue tenants. See the whole month on one screen.",
  },
];

const steps = [
  {
    step: "01",
    title: "Onboard your PG in minutes",
    body: "Add your property, rooms, base rent, and tenant details. A typical PG is set up in under 15 minutes, and you only do it once.",
  },
  {
    step: "02",
    title: "Review auto-generated bills",
    body: "On the 1st, PGKhata drafts every tenant's rent, electricity, and extra charges. Review, approve, and send.",
  },
  {
    step: "03",
    title: "Tenants pay via direct link",
    body: "Every bill includes a UPI pay link. Tenants tap and pay. No app to download or account to create.",
  },
  {
    step: "04",
    title: "Track it all on one screen",
    body: "See who has paid, who is overdue, and your monthly collection from your phone in under a minute.",
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
    <>
      <span className="font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
        {children}
      </span>
      <br />
    </>
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
              PG billing on autopilot.
            </h1>
            <p className="mt-6 mb-8 max-w-[460px] text-[18px] leading-relaxed text-ink/70">
              Generate rent and electricity bills, send UPI payment links, and track payments
              automatically, without chasing tenants every month.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={appUrl("/auth")}
                className="inline-flex items-center gap-2.5 border-2 border-ink bg-clay px-7 py-4 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)] transition-transform hover:-translate-y-0.5"
              >
                Start billing for free
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
            Stop chasing bills.
          </h2>
          <ul className="mt-12 grid list-none gap-px overflow-hidden border border-cream/15 p-0 md:grid-cols-3">
            {painPoints.map((point) => (
              <li
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
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="px-6 py-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="font-marketing-display text-[clamp(24px,3.4vw,44px)] font-bold text-ink">
            <RefTag>Ref. Statement</RefTag>
            Every bill, handled.
          </h2>
          <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink/60">
            Everything a PG owner does every month, rebuilt to take minutes instead of evenings.
          </p>
          <ul className="mt-10 list-none border-t-2 border-ink p-0">
            {features.map((feature, index) => (
              <li
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
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how" className="px-6 pb-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="font-marketing-display text-[clamp(22px,3.4vw,44px)] font-bold text-ink">
            <RefTag>Ref. Procedure</RefTag>
            Set it once. Run it monthly.
          </h2>
          <ol className="mt-10 list-none border-t-2 border-ink p-0">
            {steps.map((step) => (
              <li
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
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="reveal mx-auto max-w-[1180px] border-2 border-ink bg-paper p-8 sm:p-10">
          <h2 className="font-marketing-display text-[clamp(22px,3.2vw,38px)] font-bold text-ink">
            <RefTag>Ref. Access</RefTag>Start managing your PG for free today.
          </h2>
          <p className="mt-4 max-w-[680px] text-[16px] leading-relaxed text-ink/65">
            Everything you need to run your property is currently available at zero cost. During our
            rollout, property, room, tenant, billing, reporting, and document tools need no paid
            plan. A monthly WhatsApp delivery allowance is included while PGKhata manages messaging
            responsibly.
          </p>
        </div>
      </section>

      <section id="faq" className="px-6 pb-24">
        <div className="reveal mx-auto max-w-[1180px]">
          <h2 className="font-marketing-display text-[clamp(22px,3.2vw,38px)] font-bold text-ink">
            Questions, answered.
          </h2>
          <div className="mt-10 divide-y-2 divide-ink border-y-2 border-ink">
            {FAQS.map((faq) => (
              <article
                key={faq.question}
                className="py-7 sm:grid sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-10"
              >
                <h3 className="font-marketing-display text-[19px] font-bold text-ink">
                  {faq.question}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/65 sm:mt-0">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6">
        <div className="reveal mx-auto max-w-[1180px] border-2 border-ink bg-sage-light px-8 py-16 text-center sm:px-16">
          <h2 className="mx-auto font-marketing-display text-[clamp(22px,3.6vw,44px)] font-bold text-ink">
            Stop typing the same bill message thirty times a month.
          </h2>
          <p className="mt-5 mb-8 text-[16px] text-ink/60">
            Set up your first property, add your tenants, and automate your entire billing process
            today.
          </p>
          <a
            href={appUrl("/auth")}
            className="inline-flex items-center gap-2.5 border-2 border-ink bg-clay px-7 py-4 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)] transition-transform hover:-translate-y-0.5"
          >
            Start billing for free
            <Arrow />
          </a>
          <p className="mt-4 text-[13px] text-ink/60">
            Takes less than 15 minutes to set up. Free during our early rollout.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
