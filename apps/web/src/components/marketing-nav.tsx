import { useState } from "react";
import { Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import logoMark from "@/assets/logo.png";
import { BRAND, appUrl } from "@/lib/site";

type NavLink = { href: string; label: string };

const DEFAULT_LINKS: NavLink[] = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
];

/** Shared marketing nav with a Sheet-based mobile menu. */
export function MarketingNav({ links = DEFAULT_LINKS }: { links?: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        id="site-nav"
        className="fixed inset-x-0 top-0 z-50 border-b border-line bg-cream/95 py-4 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink"
          >
            <img src={logoMark} alt="" className="h-8 w-8 object-contain" />
            <span>{BRAND}</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="text-ink/70 hover:text-ink">
                {link.label}
              </a>
            ))}
            <a
              href={appUrl("/auth")}
              className="border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-clay hover:bg-clay"
            >
              Start billing for free
            </a>
          </div>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center border border-line text-ink md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="bg-cream text-ink">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold text-ink">
            <img src={logoMark} alt="" className="h-7 w-7 object-contain" />
            <span>{BRAND}</span>
          </SheetTitle>
          <nav className="mt-6 flex flex-col gap-1 text-base font-medium">
            {links.map((link) => (
              <SheetClose key={link.href} asChild>
                <a href={link.href} className="border-b border-line px-2 py-3">
                  {link.label}
                </a>
              </SheetClose>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={appUrl("/auth")}
              className="border border-ink bg-clay px-5 py-3 text-center text-sm font-semibold text-paper"
            >
              Start billing for free
            </a>
            <a
              href={appUrl("/auth")}
              className="border border-ink px-5 py-3 text-center text-sm font-semibold"
            >
              Sign in
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
