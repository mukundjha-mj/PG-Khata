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
        <svg
          viewBox="0 0 24 24"
          width={size * 0.58}
          height={size * 0.58}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Zm0 5.2L7.7 12l4.3 4.3L16.3 12 12 7.7Z" />
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
