import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/animated-icon";
import { Combobox } from "@/components/ui/combobox";
import { PhoneField } from "@/components/phone-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isValidEmailFormat, isValidIndianMobileDigits } from "@/lib/contact-validation";
import { ADDRESS_PROOF_TYPES } from "@/lib/pg";
import { BRAND } from "@/lib/site";

export const Route = createFileRoute("/signup/$token")({
  head: () => ({
    meta: [{ title: `Tenant signup - ${BRAND}` }, { name: "robots", content: "noindex" }],
  }),
  component: SignupPage,
});

type VacantRoom = {
  id: string;
  room_number: string;
};

type LinkState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "ready"; propertyName: string; vacantRooms: VacantRoom[] };

// Mirrors the owner's "Add tenant" form (tenants.tsx) minus the fields only an
// owner should set: status, vacated date, security deposit, rent override,
// notes, and file uploads (address proof photo needs an authenticated upload
// path - see tenant-signup.server.ts for the reasoning).
//
// Phone fields hold bare 10-digit numbers (no "+91") - PhoneField renders the
// fixed prefix and the server re-derives the full WhatsApp number from these
// digits, so a direct API call can't smuggle in a non-Indian or malformed one.
type Draft = {
  full_name: string;
  phone: string;
  alternate_phone: string;
  email: string;
  joining_date: string;
  permanent_address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address_proof_type: string;
};

const emptyDraft: Draft = {
  full_name: "",
  phone: "",
  alternate_phone: "",
  email: "",
  // Left blank rather than defaulting to today: this form is also used by
  // tenants who already live here (e.g. an owner migrating onto the
  // platform), so a silent "today" would misrecord when they actually moved
  // in.
  joining_date: "",
  permanent_address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  address_proof_type: "",
};

function SignupPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<LinkState>({ status: "loading" });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/hooks/tenant-signup?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          propertyName?: string;
          vacantRooms?: VacantRoom[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.propertyName) {
          setState({ status: "invalid", message: body.error ?? "This link is not valid." });
          return;
        }
        setState({
          status: "ready",
          propertyName: body.propertyName,
          vacantRooms: body.vacantRooms ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "invalid", message: "Could not load this link." });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const roomOptions = useMemo(
    () =>
      state.status === "ready"
        ? state.vacantRooms.map((r) => ({ value: r.id, label: `Room ${r.room_number}` }))
        : [],
    [state],
  );

  async function submit() {
    if (!roomId) {
      setSubmitError("Pick a room first.");
      return;
    }
    if (!draft.full_name.trim()) {
      setSubmitError("Name is required.");
      return;
    }
    if (!isValidIndianMobileDigits(draft.phone)) {
      setSubmitError("Enter a valid 10-digit WhatsApp number.");
      return;
    }
    if (draft.alternate_phone && !isValidIndianMobileDigits(draft.alternate_phone)) {
      setSubmitError("Alternate phone must be a valid 10-digit number.");
      return;
    }
    if (
      draft.emergency_contact_phone &&
      !isValidIndianMobileDigits(draft.emergency_contact_phone)
    ) {
      setSubmitError("Emergency phone must be a valid 10-digit number.");
      return;
    }
    if (draft.email.trim() && !isValidEmailFormat(draft.email)) {
      setSubmitError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/public/hooks/tenant-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          roomId,
          ...draft,
          phone: `+91${draft.phone}`,
          alternate_phone: draft.alternate_phone ? `+91${draft.alternate_phone}` : "",
          emergency_contact_phone: draft.emergency_contact_phone
            ? `+91${draft.emergency_contact_phone}`
            : "",
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setSubmitError(body.error ?? "Could not complete signup. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setSubmitError("Could not complete signup. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <BrandMark size={28} />
        <span className="text-sm font-medium tracking-tight text-foreground">{BRAND}</span>
      </div>

      <div className="w-full max-w-lg">
        {state.status === "loading" && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40" />
          </div>
        )}

        {state.status === "invalid" && (
          <Card>
            <CardHeader>
              <CardTitle>Link not available</CardTitle>
              <CardDescription>{state.message}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {state.status === "ready" && done && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-lg font-medium">You're all set</p>
              <p className="text-sm text-muted-foreground">
                Your details have been recorded at {state.propertyName}. The property manager has
                been notified.
              </p>
            </CardContent>
          </Card>
        )}

        {state.status === "ready" && !done && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {state.propertyName} - tenant details
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Whether you're moving in or already staying here, pick your room and fill in your
                details below.
              </p>
            </div>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-1.5">
                  <Label htmlFor="s-room">Your room</Label>
                  {roomOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No vacant rooms right now. Contact the property manager directly.
                    </p>
                  ) : (
                    <Combobox
                      triggerId="s-room"
                      options={roomOptions}
                      value={roomId}
                      onChange={setRoomId}
                      placeholder="Select your room"
                      searchPlaceholder="Search rooms…"
                      emptyText="No room found."
                    />
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-name">Full name</Label>
                    <Input
                      id="s-name"
                      value={draft.full_name}
                      onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                    />
                  </div>
                  <PhoneField
                    id="s-phone"
                    label="Phone"
                    value={draft.phone}
                    onChange={(v) => setDraft({ ...draft, phone: v })}
                    hint="This should be your WhatsApp number."
                  />
                  <PhoneField
                    id="s-alt"
                    label="Alternate phone"
                    value={draft.alternate_phone}
                    onChange={(v) => setDraft({ ...draft, alternate_phone: v })}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="s-email">Email</Label>
                    <Input
                      id="s-email"
                      type="email"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-join">Joining date</Label>
                    <Input
                      id="s-join"
                      type="date"
                      value={draft.joining_date}
                      onChange={(e) => setDraft({ ...draft, joining_date: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      If you already live here, enter the date you actually moved in.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="s-address">Permanent address</Label>
                  <Textarea
                    id="s-address"
                    rows={2}
                    value={draft.permanent_address}
                    onChange={(e) => setDraft({ ...draft, permanent_address: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-ec-name">Emergency contact</Label>
                    <Input
                      id="s-ec-name"
                      value={draft.emergency_contact_name}
                      onChange={(e) =>
                        setDraft({ ...draft, emergency_contact_name: e.target.value })
                      }
                    />
                  </div>
                  <PhoneField
                    id="s-ec-phone"
                    label="Emergency phone"
                    value={draft.emergency_contact_phone}
                    onChange={(v) => setDraft({ ...draft, emergency_contact_phone: v })}
                  />
                  <div className="space-y-1.5">
                    <Label>Address proof type</Label>
                    <Select
                      value={draft.address_proof_type}
                      onValueChange={(v) => setDraft({ ...draft, address_proof_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select proof" />
                      </SelectTrigger>
                      <SelectContent>
                        {ADDRESS_PROOF_TYPES.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {submitError && <p className="text-sm text-destructive">{submitError}</p>}

                <Button className="w-full" onClick={submit} disabled={submitting}>
                  {submitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  Submit
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
