import { useEffect } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import {
  pricingPlans as plans,
  includedOnEveryPlan,
  planComparison,
  pricingFaqs,
} from "@/lib/pricing-plans";
import { onAdminHost } from "@/lib/admin-host";
import { BRAND, appUrl, siteUrl } from "@/lib/site";

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
            price: "499",
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
    num: "01",
    title: "Manual reminders, every month",
    body: "Typing out the same rent and electricity message to thirty different people, one chat at a time.",
  },
  {
    num: "02",
    title: "Payments lost in the noise",
    body: "Screenshots in a chat, cash in an envelope, no single place to see who has actually paid.",
  },
  {
    num: "03",
    title: "Tenant records in a register",
    body: "Address proof, room history, deposits, scattered across a notebook and your phone gallery.",
  },
];

const features = [
  {
    tint: "bg-clay/15",
    title: "Tenants and rooms, organized",
    body: "Name, phone, address proof, room number and size, deposit, every tenant's full record, searchable in seconds.",
    path: "M4 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M10 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm7 4h5",
  },
  {
    tint: "bg-sage-light",
    title: "Bills sent automatically",
    body: "On the 1st, every active tenant gets their rent, electricity and other charges, with email delivery you can rely on.",
    path: "M3 6h18v12H3zM3 7l9 6 9-6",
  },
  {
    tint: "bg-gold/25",
    title: "UPI QR, built into the bill",
    body: "Tenants scan and pay directly from the bill. Paid bills mark themselves, no follow up needed.",
    path: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z",
  },
  {
    tint: "bg-clay/15",
    title: "Reminders that do not need you",
    body: "Overdue bills get a polite automatic nudge, before you even notice they are late.",
    path: "M12 21a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm7-5-2-2v-4a5 5 0 0 0-10 0v4l-2 2v1h14z",
  },
  {
    tint: "bg-sage-light",
    title: "Your data, backed up daily",
    body: "Every tenant record and payment history, backed up automatically, restorable in one click if anything goes wrong.",
    path: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7",
  },
  {
    tint: "bg-gold/25",
    title: "See collections at a glance",
    body: "Expected versus collected, occupancy, overdue tenants, the whole month's picture on one screen.",
    path: "M4 20V10m5 10V4m5 16v-7m5 7V8",
  },
];

const steps = [
  {
    num: "01",
    title: "Add your property, rooms and tenants",
    body: "Room numbers, sizes, rent, and each tenant's details, takes about 15 minutes for a typical PG.",
  },
  {
    num: "02",
    title: "Bills draft themselves on the 1st",
    body: "Rent, electricity and any extra charges are calculated for every tenant, review and approve before sending.",
  },
  {
    num: "03",
    title: "Tenants get the bill, with a QR",
    body: "They scan, pay via UPI, and the bill marks itself paid. No app to download, nothing for them to log into.",
  },
  {
    num: "04",
    title: "You check one dashboard",
    body: "See who has paid, who is overdue, and this month's total collection, from your phone, in under a minute.",
  },
];

function useReveal() {
  useEffect(() => {
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

    const onScroll = () => {
      document.getElementById("site-nav")?.classList.toggle("scrolled", window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      className="h-4 w-4 shrink-0 text-clay"
      aria-hidden="true"
    >
      <path d="m5 13 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LandingPage() {
  useReveal();

  return (
    <div className="marketing min-h-screen overflow-x-hidden bg-cream font-body text-ink">
      <div className="grain" aria-hidden="true" />

      <nav
        id="site-nav"
        className="fixed inset-x-0 top-0 z-50 py-5 transition-all duration-300 [&.scrolled]:border-b [&.scrolled]:border-line [&.scrolled]:bg-cream/85 [&.scrolled]:py-3 [&.scrolled]:backdrop-blur-lg"
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6">
          <span className="flex items-center gap-2 font-display text-2xl font-bold">
            <span className="inline-block h-3 w-3 rotate-45 rounded-[3px] bg-clay" />
            {BRAND}
          </span>
          <div className="hidden items-center gap-9 text-sm font-medium md:flex">
            <a href="#features" className="opacity-75 transition-opacity hover:opacity-100">
              Features
            </a>
            <a href="#how" className="opacity-75 transition-opacity hover:opacity-100">
              How it works
            </a>
            <a href="#pricing" className="opacity-75 transition-opacity hover:opacity-100">
              Pricing
            </a>
            <a
              href={appUrl("/auth")}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:-translate-y-px hover:bg-clay"
            >
              Start free trial
            </a>
          </div>
          <a
            href={appUrl("/auth")}
            className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-cream md:hidden"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden px-6 pt-36 pb-20 sm:pt-40">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-44 -right-40 h-[620px] w-[620px] rounded-full opacity-25 blur-[10px]"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--gold) 0%, var(--clay) 55%, transparent 75%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-clay/10 px-4 py-2 text-[13px] font-semibold tracking-[0.06em] text-clay-dark uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-clay" />
              Built for PG and hostel owners
            </span>
            <h1 className="font-display text-[clamp(42px,5.4vw,74px)] leading-[1.05] font-semibold tracking-[-0.02em]">
              Rent day, without
              <br />
              <em className="text-clay italic">the reminders.</em>
            </h1>
            <p className="mt-7 mb-9 max-w-[460px] text-[19px] leading-relaxed text-ink/70">
              {BRAND} generates every tenant's rent, electricity and other charges on the 1st, then
              sends the bill with a UPI QR and payment link. You just watch the money come in.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={appUrl("/auth")}
                className="inline-flex items-center gap-2.5 rounded-full bg-clay px-7 py-4 text-[15.5px] font-semibold text-paper shadow-[0_14px_30px_-10px_rgba(193,91,62,0.55)] transition-transform hover:-translate-y-0.5"
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
            <dl className="mt-14 flex flex-wrap gap-9">
              {[
                ["0", "logins your tenants need"],
                ["1st", "of every month, automatically"],
                ["2 min", "to add a new tenant"],
              ].map(([b, s]) => (
                <div key={s}>
                  <dt className="font-display text-[28px] font-semibold">{b}</dt>
                  <dd className="text-[13px] text-ink/55">{s}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="float-chip absolute -top-4 -left-3 z-20 flex items-center gap-2.5 rounded-2xl bg-paper px-4 py-3 text-[13.5px] font-semibold shadow-[var(--marketing-shadow)] sm:-left-7">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage-light text-sage">
                <Check />
              </span>
              Bill sent
            </div>
            <div className="relative z-10 rotate-2 rounded-[22px] border border-line bg-paper p-7 shadow-[var(--marketing-shadow)]">
              <div className="flex items-start justify-between border-b border-dashed border-line pb-4">
                <div>
                  <p className="text-[15px] font-semibold">Rahul Verma, Room 204</p>
                  <p className="mt-1 text-[12.5px] text-ink/50">August 2026, Sunrise PG</p>
                </div>
                <span className="rounded-full bg-sage-light px-3 py-1.5 text-[11px] font-bold tracking-wide text-sage uppercase">
                  Pending
                </span>
              </div>
              {[
                ["Room rent", "Rs. 8,500"],
                ["Electricity (42 units)", "Rs. 378"],
                ["Wifi and maintenance", "Rs. 300"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between border-b border-ink/5 py-3 text-[14.5px]"
                >
                  <span className="text-ink/65">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] text-ink/55">Total due, Aug 10</p>
                  <p className="font-display text-[30px] font-semibold">Rs. 9,178</p>
                </div>
                <span className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-ink text-cream">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="float-chip absolute right-0 -bottom-4 z-20 flex items-center gap-2.5 rounded-2xl bg-paper px-4 py-3 text-[13.5px] font-semibold shadow-[var(--marketing-shadow)] sm:-right-8">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/25 text-clay-dark">
                <Check />
              </span>
              Paid via UPI
            </div>
          </div>
        </div>
      </header>

      {/* PAIN */}
      <section className="bg-ink px-6 py-24 text-cream">
        <div className="reveal mx-auto max-w-[1180px]">
          <p className="text-[13px] font-bold tracking-[0.08em] text-gold uppercase">The old way</p>
          <h2 className="mt-4 max-w-[640px] font-display text-[clamp(30px,3.4vw,44px)] leading-[1.08] font-semibold">
            You did not start a PG business to become a bill sending machine.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-cream/10 md:grid-cols-3">
            {painPoints.map((p) => (
              <div key={p.num} className="bg-ink p-9">
                <span className="font-display text-[15px] text-gold italic">{p.num}</span>
                <h3 className="mt-4 mb-2.5 font-display text-[21px] font-normal">{p.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-cream/60">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 py-28">
        <div className="reveal mx-auto max-w-[1180px]">
          <p className="text-[13px] font-bold tracking-[0.08em] text-clay uppercase">
            What {BRAND} does
          </p>
          <h2 className="mt-4 max-w-[640px] font-display text-[clamp(32px,3.6vw,48px)] font-semibold">
            One dashboard. Every bill sent for you.
          </h2>
          <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-ink/60">
            Everything a PG owner touches every month, rebuilt so it takes minutes, not evenings.
          </p>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="rounded-[20px] border border-line bg-paper p-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--marketing-shadow)]"
              >
                <span
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-[13px] ${f.tint}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[22px] w-[22px] text-clay-dark"
                  >
                    <path d={f.path} />
                  </svg>
                </span>
                <h3 className="mb-2.5 font-display text-[19px] font-medium">{f.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-ink/60">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="px-6 pb-28">
        <div className="reveal mx-auto max-w-[1180px]">
          <p className="text-[13px] font-bold tracking-[0.08em] text-clay uppercase">
            How it works
          </p>
          <h2 className="mt-4 max-w-[640px] font-display text-[clamp(32px,3.6vw,48px)] font-semibold">
            Set it up once. It runs every month after.
          </h2>
          <div className="mt-12">
            {steps.map((s, i) => (
              <div
                key={s.num}
                className={`grid items-center gap-6 border-t border-line py-9 sm:grid-cols-[90px_1fr] ${
                  i === steps.length - 1 ? "border-b" : ""
                }`}
              >
                <span className="font-display text-[44px] text-clay/85 italic">{s.num}</span>
                <div>
                  <h3 className="mb-2 font-display text-[21px] font-medium">{s.title}</h3>
                  <p className="max-w-[560px] text-[15px] text-ink/60">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 pb-28">
        <div className="reveal mx-auto max-w-[1180px]">
          <p className="text-[13px] font-bold tracking-[0.08em] text-clay uppercase">Pricing</p>
          <h2 className="mt-4 max-w-[640px] font-display text-[clamp(32px,3.6vw,48px)] font-semibold">
            Priced for what you actually run.
          </h2>
          <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-ink/60">
            No setup fees. No per tenant charges hidden in the fine print. Cancel any time.
          </p>
          <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-3xl border p-9 transition-transform hover:-translate-y-1 ${
                  p.popular
                    ? "border-ink bg-ink text-cream lg:scale-[1.04]"
                    : "border-line bg-paper"
                }`}
              >
                {p.popular ? (
                  <span className="absolute -top-3.5 left-8 rounded-full bg-clay px-3.5 py-1.5 text-[11.5px] font-bold tracking-wide text-paper uppercase">
                    Most chosen
                  </span>
                ) : null}
                <h3 className="text-[16px] font-semibold tracking-wide uppercase opacity-70">
                  {p.name}
                </h3>
                <p className="mt-4 font-display text-[46px] font-semibold">
                  {p.price}
                  <span className="font-body text-[15px] font-normal opacity-60">/month</span>
                </p>
                <p className="mt-1 mb-6 text-[13.5px] opacity-60">{p.sub}</p>
                <ul className="mb-8 grow space-y-0.5">
                  {p.items.map((it) => (
                    <li
                      key={it}
                      className="flex items-center gap-2.5 py-2 text-[14.5px] opacity-90"
                    >
                      <Check />
                      {it}
                    </li>
                  ))}
                </ul>
                <a
                  href={appUrl("/auth")}
                  className={`rounded-full border-[1.5px] py-3.5 text-center text-[14.5px] font-semibold ${
                    p.popular
                      ? "border-clay bg-clay text-paper"
                      : "border-ink transition-colors hover:bg-ink hover:text-cream"
                  }`}
                >
                  Start free trial
                </a>
              </div>
            ))}
          </div>

          {/* Included on every plan */}
          <div className="reveal mt-14 rounded-3xl border border-line bg-paper p-8 sm:p-10">
            <h3 className="font-display text-[22px] font-semibold">Included on every plan</h3>
            <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {includedOnEveryPlan.map((it) => (
                <li key={it} className="flex items-start gap-2.5 text-[14.5px] text-ink/80">
                  <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
                  {it}
                </li>
              ))}
            </ul>
          </div>

          {/* Comparison */}
          <div className="reveal mt-8 overflow-hidden rounded-3xl border border-line bg-paper">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-sage-light/40">
                    <th className="px-6 py-4 text-[13px] font-bold tracking-[0.06em] uppercase opacity-70">
                      Compare plans
                    </th>
                    {plans.map((p) => (
                      <th
                        key={p.name}
                        className="px-6 py-4 text-[13px] font-bold tracking-[0.06em] uppercase opacity-70"
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planComparison.map((row) => (
                    <tr key={row.feature} className="border-b border-line last:border-0">
                      <th scope="row" className="px-6 py-4 text-[14.5px] font-medium text-ink/80">
                        {row.feature}
                      </th>
                      <td className="px-6 py-4 text-[14.5px] text-ink/70">{row.starter}</td>
                      <td className="px-6 py-4 text-[14.5px] text-ink/70">{row.growing}</td>
                      <td className="px-6 py-4 text-[14.5px] text-ink/70">{row.scale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing FAQ */}
          <div className="reveal mt-8 grid gap-6 sm:grid-cols-2">
            {pricingFaqs.map((f) => (
              <div key={f.q} className="rounded-3xl border border-line bg-paper p-7">
                <h3 className="font-display text-[18px] font-semibold">{f.q}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink/65">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6">
        <div className="reveal mx-auto max-w-[1180px] rounded-[32px] bg-sage-light px-8 py-20 text-center sm:px-16">
          <h2 className="mx-auto max-w-[640px] font-display text-[clamp(30px,4vw,48px)] font-semibold">
            Stop typing the same bill message thirty times a month.
          </h2>
          <p className="mt-5 mb-8 text-[17px] text-ink/60">
            Set up your first property free, no card required.
          </p>
          <a
            href={appUrl("/auth")}
            className="inline-flex items-center gap-2.5 rounded-full bg-clay px-7 py-4 text-[15.5px] font-semibold text-paper shadow-[0_14px_30px_-10px_rgba(193,91,62,0.55)] transition-transform hover:-translate-y-0.5"
          >
            Start your free month
            <Arrow />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto max-w-[1180px] px-6 pt-20 pb-10">
        <div className="flex flex-wrap justify-between gap-8 border-b border-line pb-11">
          <div className="max-w-[300px]">
            <span className="flex items-center gap-2 font-display text-2xl font-bold">
              <span className="inline-block h-3 w-3 rotate-45 rounded-[3px] bg-clay" />
              {BRAND}
            </span>
            <p className="mt-3 text-[14.5px] text-ink/60">
              Billing and tenant management for PG and hostel owners across India.
            </p>
          </div>
          <div className="flex gap-16">
            <div>
              <h4 className="mb-4 text-[13px] font-bold tracking-wide uppercase opacity-50">
                Product
              </h4>
              <a href="#features" className="mb-3 block text-[14.5px] opacity-75 hover:opacity-100">
                Features
              </a>
              <a href="#how" className="mb-3 block text-[14.5px] opacity-75 hover:opacity-100">
                How it works
              </a>
              <a href="#pricing" className="mb-3 block text-[14.5px] opacity-75 hover:opacity-100">
                Pricing
              </a>
              <Link
                to="/blog/pg-rent-agreement-template"
                className="mb-3 block text-[14.5px] opacity-75 hover:opacity-100"
              >
                PG rent agreement template
              </Link>
            </div>
            <div>
              <h4 className="mb-4 text-[13px] font-bold tracking-wide uppercase opacity-50">
                Company
              </h4>
              <a
                href={appUrl("/auth")}
                className="mb-3 block text-[14.5px] opacity-75 hover:opacity-100"
              >
                Sign in
              </a>
              <a
                href={appUrl("/dashboard")}
                className="mb-3 block text-[14.5px] opacity-75 hover:opacity-100"
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 pt-6 text-[13px] text-ink/50">
          <span>2026 {BRAND}. Made for PG owners, not tech teams.</span>
          <span>Mumbai, Bengaluru, Delhi NCR</span>
        </div>
      </footer>
    </div>
  );
}
