import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Spinner } from "@/components/animated-icon";
import { BrandMark } from "@/components/brand-mark";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/site";

// The generated route tree imports every route module eagerly, so a static
// import would put the Supabase client in the shared entry chunk and ship it to
// marketing visitors who never reach this page.
const getSupabase = async () => (await import("@/integrations/supabase/client")).supabase;

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: `Set a new password - ${BRAND}` }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

/**
 * Where Supabase sends an owner after they click the emailed recovery link.
 *
 * This is deliberately a top-level route rather than one under `_authenticated`.
 * The recovery link establishes a real session, so an authenticated route would
 * simply let them into the app and never ask for a new password — leaving the
 * forgotten one in place.
 */
function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  // Starts as "checking" so the server render and the first paint agree. The
  // token arrives in the URL fragment, which is client-only, so deciding the
  // state up front would flash "link is not valid" at every owner who followed
  // a perfectly good link.
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    // Read the fragment before touching the client: on success Supabase strips
    // it, and on failure it carries the reason the link did not work.
    const fragment = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
    const fragmentError = new URLSearchParams(fragment).get("error_description");

    let cancelled = false;
    void getSupabase()
      .then((supabase) => supabase.auth.getSession())
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) {
          setState("ready");
          return;
        }
        setState("invalid");
        setReason(fragmentError);
      })
      .catch(() => {
        if (cancelled) return;
        setState("invalid");
        setReason(fragmentError);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Both passwords must match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="grid-backdrop pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_55%_at_50%_35%,black,transparent)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <BrandMark size={44} priority className="rounded-xl" />
          <h1 className="page-title text-foreground">{BRAND}</h1>
        </div>

        <Card className="border-border/80 shadow-sm">
          {state === "checking" && (
            <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Checking your link
            </CardContent>
          )}

          {state === "invalid" && (
            <>
              <CardHeader>
                <CardTitle className="text-base">This link is no longer valid</CardTitle>
                <CardDescription>
                  {reason ??
                    "Reset links expire, and each one can only be used once. Request a fresh link and it will work."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to="/auth">Back to sign in</Link>
                </Button>
              </CardContent>
            </>
          )}

          {state === "ready" && (
            <>
              <CardHeader>
                <CardTitle className="text-base">Set a new password</CardTitle>
                <CardDescription>
                  Choose something you have not used here before. You will stay signed in on this
                  device.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm">Confirm new password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Spinner className="mr-2 h-4 w-4" />}
                    Update password
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
