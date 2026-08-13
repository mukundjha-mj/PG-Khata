import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Spinner } from "@/components/animated-icon";
import { BrandMark } from "@/components/brand-mark";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidEmailFormat } from "@/lib/contact-validation";
import { authRedirect, BRAND } from "@/lib/site";

// The generated route tree imports every route module eagerly, so a static
// import would put the Supabase client in the shared entry chunk and ship it to
// marketing visitors who never sign in.
const getSupabase = async () => (await import("@/integrations/supabase/client")).supabase;

type Mode = "signin" | "setup" | "reset";

const COPY: Record<Mode, { title: string; description: string; submit: string }> = {
  signin: { title: "Sign in", description: "Welcome back.", submit: "Sign in" },
  setup: {
    title: "Create your account",
    description: "Start managing your PG. Your properties and tenants stay private to you.",
    submit: "Create account",
  },
  reset: {
    title: "Reset your password",
    description: "Enter your email and we will send you a link to set a new one.",
    submit: "Send reset link",
  },
};

/**
 * Google's brand mark, inlined.
 *
 * `@iconify/react` is available, but this app feeds it bundled collections via
 * `addCollection` — an icon name it does not hold is fetched from Iconify's API
 * at runtime. That would put a third-party request on the sign-in path, and it
 * would fail quietly wherever that host is blocked, leaving a button with no
 * logo. Four paths inline cost less than the failure mode.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 16.0455 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 1.9545.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </svg>
  );
}

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
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSupabase().then((supabase) =>
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) navigate({ to: "/dashboard", replace: true });
      }),
    );
  }, [navigate]);

  async function handleGoogle() {
    setBusy(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirect(window.location.origin, "/dashboard") },
      });
      if (error) throw error;
      // The browser is now navigating to Google, so `busy` is deliberately left
      // set — clearing it would flash an enabled button during the hand-off.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Google sign-in");
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmailFormat(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const supabase = await getSupabase();

      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirect(window.location.origin, "/reset-password"),
        });
        // Rate limiting is worth showing: it says nothing about whether the
        // address is registered, and hiding it would leave an owner waiting for
        // a mail that was never sent. Any other error is swallowed into the
        // neutral message below, because "no such user" would turn this form
        // into an account-enumeration oracle.
        if (error?.status === 429) throw error;
        if (error) console.error("[auth] password reset request failed", error);
        toast.success("If that email has an account, a reset link is on its way.");
        setMode("signin");
        return;
      }

      if (mode === "setup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // The app host serves the marketing landing page at `/`, so
            // redirecting to the bare origin drops a freshly confirmed owner on
            // the pricing page next to a "Sign in" button — while they are in
            // fact signed in. Send them where they were trying to go.
            emailRedirectTo: authRedirect(window.location.origin, "/dashboard"),
            data: { name },
          },
        });
        if (error) throw error;
        // Supabase deliberately returns a success-shaped response when the
        // address already has an account, so from here a real signup and a
        // collision are indistinguishable. Anything below that branches on
        // which one happened hands this form back the enumeration oracle the
        // reset branch above is careful to avoid.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          // Three situations reach this line and only the first created
          // anything: confirmation is pending on a new account; the address
          // already has a password and it is not this one; the address is
          // Google-only and has no password at all. One message has to hold in
          // all three. `signin` mode carries both escape hatches — the Google
          // button and "Forgot password?", which sets a password on an account
          // that has none.
          toast.success("Check your email to continue, or sign in if you already have an account.");
          setMode("signin");
          return;
        }
        // Only reachable with email confirmation off, so "account created"
        // would be a guess about a dashboard setting; this is true either way.
        toast.success("You're signed in.");
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

  const copy = COPY[mode];

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
            <CardTitle className="text-base">{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode !== "reset" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogle}
                  disabled={busy}
                >
                  <GoogleMark className="mr-2 h-4 w-4" />
                  Continue with Google
                </Button>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

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
              {mode !== "reset" && (
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("reset")}
                        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
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
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Spinner className="mr-2 h-4 w-4" />}
                {copy.submit}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "reset" ? (
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Back to sign in
                </button>
              ) : (
                <>
                  {mode === "setup" ? "Already have an account?" : "New here?"}{" "}
                  <button
                    type="button"
                    onClick={() => setMode(mode === "setup" ? "signin" : "setup")}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {mode === "setup" ? "Sign in" : "Create an account"}
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
