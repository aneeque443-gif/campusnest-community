import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell } from "lucide-react";

type Notif = { id: string; kind: string; title: string; body: string; link: string | null; is_read: boolean; created_at: string };

export const Route = createFileRoute("/_app/library/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Library" }] }),
  component: NotifPage,
});

function NotifPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("library_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as Notif[]);
    if ((data ?? []).some((n: any) => !n.is_read)) {
      await supabase
        .from("library_notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    }
  }
  useEffect(() => { load(); }, [user]);

  return (
    <div className="space-y-3 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button asChild size="icon" variant="ghost"><Link to="/library"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-lg font-bold text-foreground">Library notifications</h1>
      </div>
      {items.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">No notifications.</CardContent></Card>
      ) : items.map((n) => (
        <Card key={n.id} className="shadow-[var(--shadow-card)]">
          <CardContent className="flex items-start gap-3 p-3">
            <Bell className="mt-0.5 h-4 w-4 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}