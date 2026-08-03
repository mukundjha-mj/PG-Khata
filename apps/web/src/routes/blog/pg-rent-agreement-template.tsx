import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { pricingPlans } from "@/lib/pricing-plans";
import { pgRentAgreementTemplate } from "@/lib/pg-rent-agreement-template";

const PAGE_URL = "https://basera.app/blog/pg-rent-agreement-template";
const TITLE = "PG Rent Agreement Format: Free Template for Owners";
const DESCRIPTION =
  "A clause by clause guide to drafting a PG rent agreement in India, with a free downloadable format covering deposit, electricity, notice period and house rules.";

export const Route = createFileRoute("/blog/pg-rent-agreement-template")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          mainEntityOfPage: PAGE_URL,
          author: { "@type": "Organization", name: "Basera" },
          publisher: { "@type": "Organization", name: "Basera" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://basera.app/",
            },
            { "@type": "ListItem", position: 2, name: "PG rent agreement format", item: PAGE_URL },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is a PG rent agreement the same as a rental lease?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. A PG stay is normally a leave and licence arrangement for a bed or room, not a lease that transfers possession of the property. The agreement should say clearly that it creates a licence to occupy.",
              },
            },
            {
              "@type": "Question",
              name: "Does a PG agreement need to be registered?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Most PG agreements run for eleven months or less and are executed on stamp paper without registration, but stamp duty and registration rules vary by state. Confirm the rule for your state before signing.",
              },
            },
            {
              "@type": "Question",
              name: "How much security deposit can a PG owner take?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "One to two months of the monthly fee is the common practice in most Indian cities. Write the exact amount, the deductions allowed and the refund window into the agreement.",
              },
            },
            {
              "@type": "Question",
              name: "How should electricity be billed in a PG?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Either include it in the monthly fee or charge on sub meter readings at a fixed rate per unit. Record the opening meter reading in the agreement so the first bill can be checked.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: RentAgreementGuide,
});

const clauses = [
  {
    num: "01",
    title: "Parties and KYC details",
    body: "Full name, permanent address, phone, email and government ID of both the owner and the paying guest, plus an emergency contact. This is the record you will need for police verification and for chasing dues later.",
  },
  {
    num: "02",
    title: "Premises: bed, room and sharing",
    body: "Name the bed number, room number and sharing type, not just the building. In a PG you are licensing a bed, so the document should describe exactly that.",
  },
  {
    num: "03",
    title: "Licence, not lease",
    body: "State that the arrangement is a leave and licence to occupy and does not create a tenancy or transfer any interest in the property. This single line is the most important difference between a PG agreement and a rental lease.",
  },
  {
    num: "04",
    title: "Term and renewal",
    body: "Start date, duration and end date. Eleven months is the usual term because it keeps most states outside compulsory registration, with renewal by written consent.",
  },
  {
    num: "05",
    title: "Monthly fee and due date",
    body: "Amount in figures and words, the day of the month it falls due, the payment mode, and the late fee per day after a grace period. A fixed due date is what makes automated billing and reminders possible.",
  },
  {
    num: "06",
    title: "Security deposit and refund window",
    body: "Amount, date paid, what can be deducted, and the number of days within which the balance is refunded after vacating. Vague deposit terms cause more PG disputes than anything else.",
  },
  {
    num: "07",
    title: "Electricity and utilities",
    body: "Either included in the fee or charged per unit on a sub meter. Record the opening meter reading and the rate per unit so the first bill can be checked against the agreement.",
  },
  {
    num: "08",
    title: "Services included",
    body: "Furnishing, meals, housekeeping frequency, laundry, Wi-Fi, water and power backup. Write down what is included so nobody argues about it in month three.",
  },
  {
    num: "09",
    title: "House rules",
    body: "Gate timing, visitors, alcohol and smoking, cooking in rooms, quiet hours, and no subletting the bed. Keep them short enough that a tenant will actually read them.",
  },
  {
    num: "10",
    title: "Damage, loss and inspection",
    body: "The guest pays for damage beyond normal wear and tear, the owner is not liable for personal valuables, and the owner may inspect the room after reasonable notice.",
  },
  {
    num: "11",
    title: "Notice period and vacating",
    body: "Notice in days from either side, return of keys and access cards, and clearance of all dues including the final electricity bill before the deposit is refunded.",
  },
  {
    num: "12",
    title: "Termination, jurisdiction and inventory",
    body: "Grounds for immediate termination, the city whose courts have jurisdiction, and an annexure listing the furniture handed over with its condition. Sign with two witnesses.",
  },
];

const mistakes = [
  {
    title: "Calling it a rent agreement in the body",
    body: "If the document reads like a lease, a dispute can be argued as a tenancy. Use licensor and licensee language throughout.",
  },
  {
    title: "No opening meter reading",
    body: "Without a recorded starting reading there is no honest way to raise the first electricity bill, and every later bill is questioned.",
  },
  {
    title: "Deposit terms with no timeline",
    body: "A refund promise without a day count is unenforceable in practice. Put a number of days in writing.",
  },
  {
    title: "House rules only spoken at check-in",
    body: "Rules that never made it into the signed copy are the first thing a tenant disputes when you enforce them.",
  },
];

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
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function downloadTemplate() {
  const blob = new Blob([pgRentAgreementTemplate], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pg-rent-agreement-template.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function RentAgreementGuide() {
  useReveal();

  return (
    <div className="basera min-h-screen overflow-x-hidden bg-cream font-body text-ink">
      <div className="grain" aria-hidden="true" />

      <nav className="border-b border-line bg-cream/85 py-4 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold">
            <span className="inline-block h-3 w-3 rotate-45 rounded-[3px] bg-clay" />
            Basera
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:-translate-y-px hover:bg-clay"
          >
            Start free trial
          </Link>
        </div>
      </nav>

      <main>
        <article>
          <header className="px-6 pt-16 pb-10">
            <div className="mx-auto max-w-[760px]">
              <nav aria-label="Breadcrumb" className="text-[13px] text-ink/55">
                <Link to="/" className="hover:text-clay">
                  Home
                </Link>
                <span className="px-2">/</span>
                <span>Guides</span>
              </nav>
              <p className="mt-6 text-[13px] font-bold tracking-[0.08em] text-clay uppercase">
                Legal compliance for PG and hostel owners
              </p>
              <h1 className="mt-4 font-display text-[clamp(32px,4.4vw,54px)] leading-[1.08] font-semibold">
                How to draft a PG rent agreement in India
              </h1>
              <p className="mt-5 text-[18px] leading-relaxed text-ink/65">
                Every clause a paying guest agreement needs, why it matters when a tenant disputes a
                deposit or an electricity bill, and a free format you can fill in today.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-clay px-6 py-3.5 text-[15px] font-semibold text-paper shadow-[0_14px_30px_-10px_rgba(193,91,62,0.55)] transition-transform hover:-translate-y-0.5"
                >
                  Download the free template
                </button>
                <a
                  href="#template"
                  className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-semibold transition-colors hover:bg-ink hover:text-cream"
                >
                  Read the full format
                </a>
              </div>
            </div>
          </header>

          <section className="px-6 pb-14">
            <div className="reveal mx-auto max-w-[760px] rounded-3xl border border-line bg-paper p-8">
              <h2 className="font-display text-[26px] font-semibold">
                A PG agreement is a licence, not a lease
              </h2>
              <p className="mt-4 text-[16.5px] leading-relaxed text-ink/70">
                A rental lease hands over possession of a property. A paying guest stay does not:
                the guest occupies one bed in a room you continue to control, with services like
                meals, housekeeping and electricity bundled around it. That difference is why a PG
                agreement is written as a leave and licence, usually for eleven months, and why
                copying a flat rental format from the internet leaves you exposed.
              </p>
              <p className="mt-4 text-[16.5px] leading-relaxed text-ink/70">
                Stamp duty, registration thresholds and police verification rules differ by state.
                The structure below holds everywhere in India; the amounts, stamp value and
                jurisdiction line are what you adjust locally.
              </p>
            </div>
          </section>

          <section className="px-6 pb-16">
            <div className="reveal mx-auto max-w-[1180px]">
              <h2 className="font-display text-[clamp(28px,3.2vw,42px)] font-semibold">
                The twelve clauses your agreement needs
              </h2>
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {clauses.map((c) => (
                  <div
                    key={c.num}
                    className="rounded-3xl border border-line bg-paper p-7 transition-transform hover:-translate-y-1"
                  >
                    <span className="font-display text-[15px] font-bold text-clay">{c.num}</span>
                    <h3 className="mt-2 font-display text-[20px] font-semibold">{c.title}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-ink/65">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-6 pb-16">
            <div className="reveal mx-auto max-w-[1180px] rounded-[32px] bg-sage-light px-8 py-14 sm:px-14">
              <h2 className="font-display text-[clamp(26px,3vw,38px)] font-semibold">
                Four mistakes that cost owners money
              </h2>
              <div className="mt-9 grid gap-6 sm:grid-cols-2">
                {mistakes.map((m) => (
                  <div key={m.title}>
                    <h3 className="font-display text-[19px] font-semibold">{m.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink/65">{m.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="template" className="px-6 pb-16">
            <div className="reveal mx-auto max-w-[900px]">
              <h2 className="font-display text-[clamp(28px,3.2vw,42px)] font-semibold">
                Free PG rent agreement format
              </h2>
              <p className="mt-4 max-w-[620px] text-[16.5px] leading-relaxed text-ink/65">
                Fill in the blanks, print it on stamp paper of the value your state requires, and
                sign it with two witnesses. Keep a scanned copy against the tenant record.
              </p>
              <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-paper">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
                  <span className="text-[13px] font-bold tracking-wide uppercase opacity-60">
                    pg-rent-agreement-template.txt
                  </span>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink px-5 text-[14px] font-semibold transition-colors hover:bg-ink hover:text-cream"
                  >
                    Download
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto px-6 py-6 text-[13px] leading-relaxed whitespace-pre-wrap text-ink/75">
                  {pgRentAgreementTemplate}
                </pre>
              </div>
              <p className="mt-4 text-[13.5px] text-ink/55">
                This template is a general starting point, not legal advice. Have the final draft
                checked by a lawyer in your state.
              </p>
            </div>
          </section>

          <section className="px-6 pb-20">
            <div className="reveal mx-auto max-w-[760px]">
              <h2 className="font-display text-[clamp(26px,3vw,38px)] font-semibold">
                Common questions
              </h2>
              <dl className="mt-8 space-y-6">
                {[
                  [
                    "Does a PG agreement need to be registered?",
                    "Most run for eleven months or less and are executed on stamp paper without registration, but stamp duty and registration thresholds vary by state. Confirm your state rule before signing.",
                  ],
                  [
                    "How much security deposit is normal?",
                    "One to two months of the monthly fee in most Indian cities. Write the exact amount, the permitted deductions and the refund window into clause 4.",
                  ],
                  [
                    "Can the monthly fee be raised mid term?",
                    "Not unless the agreement says so. Add a renewal clause with the escalation percentage if you plan to revise at renewal.",
                  ],
                  [
                    "What notice period should I use?",
                    "Thirty days from either side is standard and gives you time to fill the bed. Anything shorter tends to leave rooms empty mid month.",
                  ],
                ].map(([q, a]) => (
                  <div key={q} className="rounded-3xl border border-line bg-paper p-7">
                    <dt className="font-display text-[19px] font-semibold">{q}</dt>
                    <dd className="mt-2 text-[15.5px] leading-relaxed text-ink/65">{a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="px-6 pb-16">
            <div className="reveal mx-auto max-w-[760px]">
              <h2 className="font-display text-[clamp(26px,3vw,38px)] font-semibold">
                After the agreement is signed
              </h2>
              <p className="mt-4 text-[16.5px] leading-relaxed text-ink/70">
                The agreement fixes the numbers: monthly fee, due date, deposit, electricity rate
                and opening meter reading. Basera then runs them every month. Store the tenant
                record with the ID proof, set the room and rent, and on the 1st every active tenant
                gets a bill with rent, electricity on meter readings and any other charges, with a
                UPI QR inside it. Paid bills mark themselves and overdue ones get reminders.
              </p>
            </div>
          </section>
        </article>

        <section id="pricing" className="px-6 pb-24">
          <div className="reveal mx-auto max-w-[1180px]">
            <p className="text-[13px] font-bold tracking-[0.08em] text-clay uppercase">Pricing</p>
            <h2 className="mt-4 max-w-[640px] font-display text-[clamp(32px,3.6vw,48px)] font-semibold">
              Priced for what you actually run.
            </h2>
            <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-ink/60">
              No setup fees. No per tenant charges hidden in the fine print. Cancel any time.
            </p>
            <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
              {pricingPlans.map((p) => (
                <div
                  key={p.name}
                  className={`relative flex flex-col rounded-3xl border p-9 transition-transform hover:-translate-y-1 ${
                    p.popular ? "border-ink bg-ink text-cream lg:scale-[1.04]" : "border-line bg-paper"
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
                  <Link
                    to="/auth"
                    className={`rounded-full border-[1.5px] py-3.5 text-center text-[14.5px] font-semibold ${
                      p.popular
                        ? "border-clay bg-clay text-paper"
                        : "border-ink transition-colors hover:bg-ink hover:text-cream"
                    }`}
                  >
                    Start free trial
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1180px] px-6 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[13px] text-ink/50">
          <span>2026 Basera. Made for PG owners, not tech teams.</span>
          <Link to="/" className="hover:text-clay">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
