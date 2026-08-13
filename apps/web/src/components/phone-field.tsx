import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  /** Bare digits only (no country code) - the fixed +91 prefix is rendered separately. */
  value: string;
  onChange: (digits: string) => void;
  hint?: string;
};

/**
 * Ten-digit Indian mobile number entry with a fixed, non-editable +91 prefix.
 * Used on the public signup/complaint forms, which only ever collect Indian
 * WhatsApp numbers - the owner-facing tenant form stays free-text since it
 * may hold numbers in other formats already on file.
 */
export function PhoneField({ id, label, value, onChange, hint }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span className="flex h-11 shrink-0 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground sm:h-9">
          +91
        </span>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="9000000000"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
