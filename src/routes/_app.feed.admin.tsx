import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

type Application = {
  id: string;
  applicant_id: string;
  full_name: string;
  year: string;
  reason: string;
  writing_sample: string;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_app/feed/admin")({
  head: () => ({ meta: [{ title: "Reporter Applications — NestFeed" }] }),
  component: FeedAdminPage,
});

function FeedAdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading } = useRoles();
  const [apps, setApps] = useState<Application[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("reporter_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setApps((data ?? []) as Application[]);
  }

  useEffect(() => {
    if (user && isAdmin) load();
  }, [user, isAdmin]);

  async function review(id: string, status: "approved" | "rejected") {
    setBusy(id);
    const { error } = await supabase
      .from("reporter_applications")
      .update({ status, reviewer_id: user?.id })
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "Approved & role granted" : "Rejected");
    await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/feed" />;

  return (
    <div className="space-y-3 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button asChild size="icon" variant="ghost">
          <Link to="/feed">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-bold text-foreground">Reporter Applications</h1>
      </div>
      {apps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No applications yet.
          </CardContent>
        </Card>
      ) : (
        apps.map((a) => (
          <Card key={a.id} className="shadow-[var(--shadow-card)]">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{a.full_name}</p>
                  <p className="text-xs text-muted-foreground">{a.year} · {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <Badge
                  variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}
                >
                  {a.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why</p>
                <p className="whitespace-pre-wrap text-sm text-foreground">{a.reason}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Writing sample</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.writing_sample}</p>
              </div>
              {a.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => review(a.id, "approved")} disabled={busy === a.id}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => review(a.id, "rejected")} disabled={busy === a.id}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}