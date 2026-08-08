import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";

type BrandMarkProps = {
  className?: string;
  size?: number;
  priority?: boolean;
  /** Overrides the saved workspace logo, used by the branding preview. */
  src?: string | null;
  alt?: string;
};

/** The workspace logo mark. Falls back to the themed default mark. */
export function BrandMark({ className, size = 32, priority = false, src, alt }: BrandMarkProps) {
  const { brandLogoUrl, brandName } = useBranding();
  const source = src ?? brandLogoUrl;

  if (!source) {
    return (
      <span
        aria-label={alt ?? `${brandName} PG property management logo`}
        role="img"
        className={cn(
          "grid shrink-0 select-none place-items-center rounded-[26%] bg-primary text-primary-foreground",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* Ledger-stamp mark: three bill line-items and a settled checkmark,
            drawn in currentColor so it follows the app theme (incl. dark mode)
            instead of the fixed manila/stamp-red palette used on marketing pages. */}
        <svg
          viewBox="0 0 24 24"
          width={size * 0.58}
          height={size * 0.58}
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <rect x="4" y="8" width="12" height="2" rx="0.8" fill="currentColor" />
          <rect x="4" y="12" width="9.5" height="2" rx="0.8" fill="currentColor" />
          <rect x="4" y="16" width="7" height="2" rx="0.8" fill="currentColor" />
          <path
            d="M14.5 17.5 17 20l4.5-5.5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <img
      src={source}
      alt={alt ?? `${brandName} PG property management logo`}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      className={cn("shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
