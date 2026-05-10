import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin-setup")({
  head: () => ({ meta: [{ title: "Admin Setup — CampusNest" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminSetupPage,
});

function AdminSetupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) {
      toast.error("Please log in first");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_admin_setup", { _code: code });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res?.ok) {
        const map: Record<string, string> = {
          already_used: "This setup page has already been used.",
          invalid_code: "Invalid code.",
          not_authenticated: "Please log in first.",
        };
        toast.error(map[res?.error ?? ""] ?? "Setup failed");
        return;
      }
      toast.success("You are now an admin");
      setTimeout(() => navigate({ to: "/admin" }), 600);
    } catch (e: any) {
      toast.error(e.message ?? "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-lg font-bold">Admin Setup</h1>
            <p className="text-xs text-muted-foreground">
              Enter the one-time setup code to grant admin access to your account.
            </p>
          </div>
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          ) : !user ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">You must be logged in.</p>
              <Button asChild className="w-full"><Link to="/login">Log in</Link></Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Setup code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                autoFocus
              />
              <Button className="w-full" disabled={busy || !code.trim()} onClick={submit}>
                {busy ? "Verifying…" : "Claim admin"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}