import brandMark from "@/assets/logo.png";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: number;
  priority?: boolean;
  alt?: string;
};

/** The supplied PGKhata product mark, shared by authenticated and public utility surfaces. */
export function BrandMark({ className, size = 32, priority = false, alt }: BrandMarkProps) {
  return (
    <span
      aria-label={alt ?? "PGKhata logo"}
      role="img"
      className={cn("inline-flex shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={brandMark}
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain"
        decoding="async"
        loading={priority ? "eager" : "lazy"}
      />
    </span>
  );
}
