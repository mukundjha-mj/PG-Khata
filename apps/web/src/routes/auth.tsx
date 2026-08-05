import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
// marketing visitors who never sign in.
const getSupabase = async () => (await import("@/integrations/supabase/client")).supabase;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Sign in - ${BRAND}` },
      {
        name: "description",
        content:
          "Secure sign-in for the PG owner's management console: tenants, rooms, rent and electricity billing.",
      },
      { property: "og:title", content: `Sign in - ${BRAND}` },
      {
        property: "og:description",
        content: "Secure sign-in for the PG management and billing console.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSupabase().then((supabase) =>
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) navigate({ to: "/dashboard", replace: true });
      }),
    );
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const supabase = await getSupabase();
      if (mode === "setup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // The app host serves the marketing landing page at `/`, so
            // redirecting to the bare origin drops a freshly confirmed owner on
            // the pricing page next to a "Sign in" button — while they are in
            // fact signed in. Send them where they were trying to go.
            //
            // Supabase only honours this if the origin is in the project's
            // Redirect URLs allowlist; otherwise it falls back to Site URL.
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { name },
          },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          // Expected whenever email confirmation is on: the account exists but
          // has no session yet.
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }
        toast.success("Account created");
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
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
          <div className="space-y-1">
            <h1 className="page-title text-foreground">{BRAND}</h1>
            <p className="text-sm text-muted-foreground">
              The workspace for tenants, rooms and rent billing
            </p>
          </div>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "setup" ? "Create your account" : "Sign in"}
            </CardTitle>
            <CardDescription>
              {mode === "setup"
                ? "Start managing your PG. Your properties and tenants stay private to you."
                : "Welcome back."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "setup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Owner name"
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "setup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Spinner className="mr-2 h-4 w-4" />}
                {mode === "setup" ? "Create account" : "Sign in"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "setup" ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "setup" ? "signin" : "setup")}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {mode === "setup" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
