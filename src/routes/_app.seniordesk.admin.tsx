import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";

type Invite = {
  id: string;
  enrollment_id: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_app/seniordesk/admin")({
  head: () => ({ meta: [{ title: "Admin — SeniorDesk" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading } = useRoles();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [enrollment, setEnrollment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("senior_invites")
      .select("*")
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const invite = async () => {
    if (!user || !enrollment.trim()) return;
    setBusy(true);
    // Check if user already has profile with this enrollment — grant role immediately
    const eid = enrollment.trim();
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("enrollment_id", eid)
      .maybeSingle();
    const { error } = await supabase.from("senior_invites").insert({
      enrollment_id: eid,
      invited_by: user.id,
      claimed_by: prof?.id ?? null,
      claimed_at: prof ? new Date().toISOString() : null,
    });
    if (!error && prof) {
      await supabase
        .from("user_roles")
        .insert({ user_id: prof.id, role: "senior_mentor" });
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(prof ? "Senior role granted" : "Invite created");
    setEnrollment("");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("senior_invites").delete().eq("id", id);
    load();
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!isAdmin)
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Admin access required.
      </div>
    );

  return (
    <div className="px-4 py-4">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/seniordesk" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Senior Mentor Invites</h1>
      </header>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div>
            <Label>Enrollment ID</Label>
            <Input
              value={enrollment}
              onChange={(e) => setEnrollment(e.target.value)}
              placeholder="e.g. EN2021IT0123"
            />
          </div>
          <Button onClick={invite} disabled={busy || !enrollment.trim()} className="w-full">
            {busy ? "Inviting..." : "Invite as Senior Mentor"}
          </Button>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Invites</h2>
      {invites.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No invites yet</p>
      ) : (
        <div className="space-y-2">
          {invites.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="font-mono text-sm">{i.enrollment_id}</p>
                  <Badge variant={i.claimed_by ? "default" : "outline"} className="mt-1 text-xs">
                    {i.claimed_by ? "Claimed" : "Pending"}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(i.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}