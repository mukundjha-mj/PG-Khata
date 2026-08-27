import { Link } from "@tanstack/react-router";

import logoMark from "@/assets/logo.png";
import { BRAND, appUrl } from "@/lib/site";

const linkClass = "mb-3 block text-[14.5px] text-ink/70 hover:text-ink";

/** Shared marketing footer reused across every public page. */
export function MarketingFooter({ maxWidth = "1180px" }: { maxWidth?: string }) {
  return (
    <footer className="mx-auto px-6 pt-16 pb-10" style={{ maxWidth }}>
      <div className="flex flex-wrap justify-between gap-8 border-t-2 border-ink pt-8">
        <div className="max-w-[300px]">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
            <img src={logoMark} alt="" className="h-8 w-8 object-contain" />
            <span>{BRAND}</span>
          </div>
          <p className="mt-3 text-[14.5px] text-ink/60">
            Billing and tenant management for PG and hostel owners across India.
          </p>
        </div>
        <div className="flex gap-16">
          <div>
            <h3 className="mb-4 font-marketing-mono text-[12px] font-bold tracking-wide text-ink/50 uppercase">
              Product
            </h3>
            <a href="/#features" className={linkClass}>
              Features
            </a>
            <a href="/#how" className={linkClass}>
              How it works
            </a>
          </div>
          <div>
            <h3 className="mb-4 font-marketing-mono text-[12px] font-bold tracking-wide text-ink/50 uppercase">
              Company
            </h3>
            <a href={appUrl("/auth")} className={linkClass}>
              Sign in
            </a>
            <a href={appUrl("/dashboard")} className={linkClass}>
              Dashboard
            </a>
            <Link to="/contact-us" className={linkClass}>
              Contact us
            </Link>
          </div>
          <div>
            <h3 className="mb-4 font-marketing-mono text-[12px] font-bold tracking-wide text-ink/50 uppercase">
              Legal
            </h3>
            <Link to="/terms" className={linkClass}>
              Terms and Conditions
            </Link>
            <Link to="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            <Link to="/shipping-policy" className={linkClass}>
              Shipping Policy
            </Link>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-3 pt-6 font-marketing-mono text-[12px] text-ink/65">
        <span>2026 {BRAND}. Registered in Noida, Uttar Pradesh, India.</span>
      </div>
    </footer>
  );
}
