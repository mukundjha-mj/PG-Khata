import { useEffect, useState } from "react";
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
import { PhoneField } from "@/components/phone-field";
import { isValidEmailFormat, isValidIndianMobileDigits } from "@/lib/contact-validation";
import { BRAND } from "@/lib/site";

export const Route = createFileRoute("/complaint/$token")({
  head: () => ({
    meta: [{ title: `Report an issue - ${BRAND}` }, { name: "robots", content: "noindex" }],
  }),
  component: ComplaintPage,
});

type LinkState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "ready"; propertyName: string };

type Draft = {
  tenant_name: string;
  room_number: string;
  phone: string;
  email: string;
  note: string;
};

const emptyDraft: Draft = { tenant_name: "", room_number: "", phone: "", email: "", note: "" };

function ComplaintPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<LinkState>({ status: "loading" });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/hooks/complaint-submit?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json()) as { propertyName?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !body.propertyName) {
          setState({ status: "invalid", message: body.error ?? "This link is not valid." });
          return;
        }
        setState({ status: "ready", propertyName: body.propertyName });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "invalid", message: "Could not load this link." });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit() {
    if (!draft.tenant_name.trim() || !draft.room_number.trim() || !draft.note.trim()) {
      setSubmitError("Name, room number and a description are required.");
      return;
    }
    if (!isValidIndianMobileDigits(draft.phone)) {
      setSubmitError("Enter a valid 10-digit WhatsApp number.");
      return;
    }
    if (draft.email.trim() && !isValidEmailFormat(draft.email)) {
      setSubmitError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/public/hooks/complaint-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...draft, phone: `+91${draft.phone}` }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setSubmitError(body.error ?? "Could not submit your complaint. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setSubmitError("Could not submit your complaint. Check your connection and try again.");
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
              <p className="text-lg font-medium">Complaint submitted</p>
              <p className="text-sm text-muted-foreground">
                The manager at {state.propertyName} has been notified.
              </p>
            </CardContent>
          </Card>
        )}

        {state.status === "ready" && !done && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Report an issue at {state.propertyName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Let the property manager know what's wrong.
              </p>
            </div>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-name">Your name</Label>
                    <Input
                      id="c-name"
                      value={draft.tenant_name}
                      onChange={(e) => setDraft({ ...draft, tenant_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-room">Room number</Label>
                    <Input
                      id="c-room"
                      value={draft.room_number}
                      onChange={(e) => setDraft({ ...draft, room_number: e.target.value })}
                    />
                  </div>
                  <PhoneField
                    id="c-phone"
                    label="Phone"
                    value={draft.phone}
                    onChange={(v) => setDraft({ ...draft, phone: v })}
                    hint="This should be your WhatsApp number."
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="c-email">Email (optional)</Label>
                    <Input
                      id="c-email"
                      type="email"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-note">What's the issue?</Label>
                  <Textarea
                    id="c-note"
                    rows={4}
                    value={draft.note}
                    onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  />
                </div>

                {submitError && <p className="text-sm text-destructive">{submitError}</p>}

                <Button className="w-full" onClick={submit} disabled={submitting}>
                  {submitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  Submit complaint
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
