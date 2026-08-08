import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { pgRentAgreementTemplate } from "@/lib/pg-rent-agreement-template";
import { BRAND, appUrl, siteUrl } from "@/lib/site";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const PAGE_URL = siteUrl("/blog/pg-rent-agreement-template");
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
          author: { "@type": "Organization", name: BRAND },
          publisher: { "@type": "Organization", name: BRAND },
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
              item: siteUrl("/"),
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

function useReveal() {
  useEffect(() => {
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
    <div className="marketing min-h-screen overflow-x-hidden bg-cream font-marketing-body text-ink">
      <MarketingNav />

      <main>
        <article>
          <header className="px-6 pt-32 pb-10">
            <div className="mx-auto max-w-[760px]">
              <nav aria-label="Breadcrumb" className="font-marketing-mono text-[12px] text-ink/55">
                <Link to="/" className="hover:text-clay">
                  Home
                </Link>
                <span className="px-2">/</span>
                <span>Guides</span>
              </nav>
              <span className="mt-6 block font-marketing-mono text-[13px] font-semibold tracking-[0.06em] text-clay">
                Ref. Legal compliance
              </span>
              <h1 className="mt-3 font-marketing-display text-[clamp(30px,4.2vw,50px)] leading-[1.1] font-bold text-ink">
                How to draft a PG rent agreement in India
              </h1>
              <p className="mt-5 text-[17px] leading-relaxed text-ink/65">
                Every clause a paying guest agreement needs, why it matters when a tenant disputes a
                deposit or an electricity bill, and a free format you can fill in today.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex min-h-11 items-center gap-2.5 border-2 border-ink bg-clay px-6 py-3.5 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)]"
                >
                  Download the free template
                </button>
                <a
                  href="#template"
                  className="inline-flex min-h-11 items-center border-2 border-ink px-6 py-3.5 text-[15px] font-semibold transition-colors hover:bg-ink hover:text-cream"
                >
                  Read the full format
                </a>
              </div>
            </div>
          </header>

          <section className="px-6 pb-14">
            <div className="reveal field-box mx-auto max-w-[760px] p-8" data-label="Key point">
              <h2 className="font-marketing-display text-[24px] font-bold text-ink">
                A PG agreement is a licence, not a lease
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-ink/70">
                A rental lease hands over possession of a property. A paying guest stay does not:
                the guest occupies one bed in a room you continue to control, with services like
                meals, housekeeping and electricity bundled around it. That difference is why a PG
                agreement is written as a leave and licence, usually for eleven months, and why
                copying a flat rental format from the internet leaves you exposed.
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-ink/70">
                Stamp duty, registration thresholds and police verification rules differ by state.
                The structure below holds everywhere in India; the amounts, stamp value and
                jurisdiction line are what you adjust locally.
              </p>
            </div>
          </section>

          <section className="px-6 pb-16">
            <div className="reveal mx-auto max-w-[1180px]">
              <h2 className="font-marketing-display text-[clamp(26px,3vw,40px)] font-bold text-ink">
                The twelve clauses your agreement needs
              </h2>
              <div className="mt-10 border-t-2 border-ink">
                {clauses.map((c) => (
                  <div
                    key={c.num}
                    className="grid gap-4 border-b border-line py-6 sm:grid-cols-[90px_1fr]"
                  >
                    <span className="field-box px-3 py-2 text-center font-marketing-mono text-[13px] font-bold text-ink">
                      {c.num}
                    </span>
                    <div>
                      <h3 className="font-marketing-display text-[17px] font-bold text-ink">
                        {c.title}
                      </h3>
                      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink/65">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-6 pb-16">
            <div className="reveal mx-auto max-w-[1180px] border-2 border-ink bg-sage-light px-8 py-12 sm:px-14">
              <h2 className="font-marketing-display text-[clamp(24px,2.8vw,34px)] font-bold text-ink">
                Four mistakes that cost owners money
              </h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {mistakes.map((m) => (
                  <div key={m.title}>
                    <h3 className="font-marketing-display text-[17px] font-bold text-ink">
                      {m.title}
                    </h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink/65">{m.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="template" className="px-6 pb-16">
            <div className="reveal mx-auto max-w-[900px]">
              <h2 className="font-marketing-display text-[clamp(26px,3vw,40px)] font-bold text-ink">
                Free PG rent agreement format
              </h2>
              <p className="mt-4 max-w-[620px] text-[16px] leading-relaxed text-ink/65">
                Fill in the blanks, print it on stamp paper of the value your state requires, and
                sign it with two witnesses. Keep a scanned copy against the tenant record.
              </p>
              <div className="perforated mt-8 overflow-hidden border-2 border-ink bg-paper">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-6 py-4">
                  <span className="font-marketing-mono text-[12px] font-bold tracking-wide text-ink/60 uppercase">
                    pg-rent-agreement-template.txt
                  </span>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex min-h-10 items-center border-2 border-ink px-5 text-[13.5px] font-semibold transition-colors hover:bg-ink hover:text-cream"
                  >
                    Download
                  </button>
                </div>
                <pre className="max-h-[520px] overflow-auto px-6 py-6 font-marketing-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink/75">
                  {pgRentAgreementTemplate}
                </pre>
              </div>
              <p className="mt-4 text-[13px] text-ink/55">
                This template is a general starting point, not legal advice. Have the final draft
                checked by a lawyer in your state.
              </p>
            </div>
          </section>

          <section className="px-6 pb-20">
            <div className="reveal mx-auto max-w-[760px]">
              <h2 className="font-marketing-display text-[clamp(24px,2.8vw,34px)] font-bold text-ink">
                Common questions
              </h2>
              <dl className="mt-8 border-t-2 border-ink">
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
                  <div key={q} className="border-b border-line py-6">
                    <dt className="font-marketing-display text-[17px] font-bold text-ink">{q}</dt>
                    <dd className="mt-2 text-[14.5px] leading-relaxed text-ink/65">{a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="px-6 pb-20">
            <div className="reveal mx-auto max-w-[760px]">
              <h2 className="font-marketing-display text-[clamp(24px,2.8vw,34px)] font-bold text-ink">
                After the agreement is signed
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-ink/70">
                The agreement fixes the numbers: monthly fee, due date, deposit, electricity rate
                and opening meter reading. {BRAND} then runs them every month. Store the tenant
                record with the ID proof, set the room and rent, and on the 1st every active tenant
                gets a bill with rent, electricity on meter readings and any other charges, with a
                UPI QR inside it. Paid bills mark themselves and overdue ones get reminders.
              </p>
              <a
                href={appUrl("/auth")}
                className="mt-6 inline-flex items-center gap-2.5 border-2 border-ink bg-clay px-7 py-4 text-[15px] font-semibold text-paper shadow-[var(--marketing-shadow)]"
              >
                Start your free month
              </a>
              <p className="mt-3 text-[13px] text-ink/55">
                See full pricing on the <Link to="/" hash="pricing" className="underline">
                  home page
                </Link>
                .
              </p>
            </div>
          </section>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
