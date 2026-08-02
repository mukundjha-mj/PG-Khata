import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { notePlatformLogin, getPlatformLockout } from "@/lib/platform-auth.functions";

/** Sign-in form for the platform console, with failed-attempt throttling. */
export function PlatformSignIn() {
  const queryClient = useQueryClient();
  const note = useServerFn(notePlatformLogin);
  const lockoutFn = useServerFn(getPlatformLockout);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/console" },
        });
        if (error) throw error;
        return { signedUp: !data.session };
      }
      const pre = await lockoutFn({ data: { email } });
      if (pre.locked) {
        setLocked(true);
        throw new Error(
          `Too many failed attempts. Try again in ${pre.retryAfterMinutes} minutes.`,
        );
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      const state = await note({ data: { email, succeeded: !error } });
      setLocked(state.locked);
      if (error) {
        const left = Math.max(0, 5 - state.failures);
        throw new Error(
          left > 0 ? `${error.message} (${left} attempts left)` : "Account temporarily locked.",
        );
      }
      return { signedUp: false };
    },
    onSuccess: async (res) => {
      if (res.signedUp) {
        toast.success("Account created. Confirm via email, then sign in.");
        setMode("signin");
        return;
      }
      queryClient.clear();
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {mode === "signin" ? "Platform sign in" : "Create platform account"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Restricted to the Basera platform team. PG owners sign in on the main site.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              submit.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="console-email">Email</Label>
              <Input
                id="console-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 md:h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="console-password">Password</Label>
              <Input
                id="console-password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 md:h-9"
              />
            </div>
            <Button type="submit" className="h-11 w-full md:h-10" disabled={busy || locked}>
              {busy ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            {locked ? (
              <p className="text-center text-sm text-destructive">
                Too many failed attempts. Try again shortly.
              </p>
            ) : null}
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "First time here? Create the platform account"
                : "Already have an account? Sign in"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Enrol a TOTP factor. Required before a platform account can be used. */
export function TotpEnroll({ onDone }: { onDone: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const existing = await supabase.auth.mfa.listFactors();
      const stale = (existing.data?.totp ?? []).find((f) => (f as { status: string }).status !== "verified");
      if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Basera console ${Date.now()}`,
      });
      if (!active) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setBusy(false);
      toast.error(challenge.error.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication enabled.");
    onDone();
  }

  return (
    <Gate title="Set up two-factor authentication" icon={<KeyRound className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        Scan this code with Google Authenticator, 1Password, or any TOTP app, then enter the
        6-digit code. Platform access is blocked until this is done.
      </p>
      {qr ? (
        <img src={qr} alt="TOTP enrolment QR code" className="mx-auto h-44 w-44 rounded bg-white p-2" />
      ) : null}
      {secret ? (
        <p className="break-all text-center text-xs text-muted-foreground">Manual key: {secret}</p>
      ) : null}
      <form className="space-y-3" onSubmit={verify}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-11 text-center tracking-[0.4em] md:h-10"
        />
        <Button type="submit" className="h-11 w-full md:h-10" disabled={busy || !factorId}>
          {busy ? "Verifying..." : "Enable two-factor"}
        </Button>
      </form>
    </Gate>
  );
}

/** Second-factor challenge for an already enrolled platform account. */
export function TotpChallenge({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const factors = await supabase.auth.mfa.listFactors();
    const factor = (factors.data?.totp ?? []).find((f) => (f as { status: string }).status === "verified");
    if (!factor) {
      setBusy(false);
      toast.error("No authenticator found for this account.");
      return;
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error) {
      setBusy(false);
      toast.error(challenge.error.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDone();
  }

  return (
    <Gate title="Two-factor verification" icon={<KeyRound className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app.
      </p>
      <form className="space-y-3" onSubmit={verify}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-11 text-center tracking-[0.4em] md:h-10"
        />
        <Button type="submit" className="h-11 w-full md:h-10" disabled={busy}>
          {busy ? "Verifying..." : "Verify"}
        </Button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </form>
    </Gate>
  );
}

function Gate({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
