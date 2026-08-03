import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminExists as checkAdminExists } from "@/lib/admin-setup.functions";
import { Spinner } from "@/components/animated-icon";
import { BrandMark } from "@/components/brand-mark";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Sign In - PG Manager" },
      {
        name: "description",
        content:
          "Secure sign-in for the PG owner's management console: tenants, rooms, rent and electricity billing.",
      },
      { property: "og:title", content: "Admin Sign In - PG Manager" },
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

  const { data: adminExists, isLoading: checking } = useQuery({
    queryKey: ["admin-exists"],
    queryFn: async () => {
      const result = await checkAdminExists();
      return result.exists;
    },
  });

  useEffect(() => {
    if (adminExists === false) setMode("setup");
  }, [adminExists]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "setup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          toast.success("Admin account created. Check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }
        toast.success("Admin account created");
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
            <h1 className="page-title text-foreground">PG Manager - Owner Sign In</h1>
            <p className="text-sm text-muted-foreground">
              The workspace for tenants, rooms and rent billing
            </p>
          </div>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "setup" ? "Create the admin account" : "Sign in"}
            </CardTitle>
            <CardDescription>
              {mode === "setup"
                ? "This is a one-time setup. Sign-up closes once this account exists."
                : "Only the PG owner can access this console."}
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
              <Button type="submit" className="w-full" disabled={busy || checking}>
                {busy && <Spinner className="mr-2 h-4 w-4" />}
                {mode === "setup" ? "Create admin account" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
