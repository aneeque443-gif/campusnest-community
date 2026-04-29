import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Pin, PinOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Notice = {
  id: string; title: string; category: string; urgency: string;
  is_pinned: boolean; created_at: string;
  target_year: string | null; target_branch: string | null;
};

export const Route = createFileRoute("/_app/notices/admin")({
  head: () => ({ meta: [{ title: "Notices Admin — CampusNest" }] }),
  component: NoticesAdmin,
});

function NoticesAdmin() {
  const { isAdmin, loading } = useRoles();
  const [list, setList] = useState<Notice[]>([]);

  async function load() {
    const { data } = await supabase
      .from("notices")
      .select("id, title, category, urgency, is_pinned, created_at, target_year, target_branch")
      .order("created_at", { ascending: false }).limit(200);
    setList((data ?? []) as Notice[]);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <div className="p-6 text-sm">Loading…</div>;
  if (!isAdmin) return <Navigate to="/notices" />;

  async function togglePin(n: Notice) {
    const { error } = await supabase.from("notices").update({ is_pinned: !n.is_pinned }).eq("id", n.id);
    if (error) toast.error(error.message); else load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this notice?")) return;
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link to="/notices"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold text-primary">Notices Admin</h1>
      </header>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">All notices</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : list.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
              <div className="min-w-0 text-xs">
                <p className="truncate font-semibold text-foreground">{n.title}</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                  {n.urgency === "Urgent" && <Badge variant="destructive" className="text-[10px]">Urgent</Badge>}
                  <Badge variant="outline" className="text-[10px]">
                    {n.target_year && n.target_branch ? `${n.target_year} · ${n.target_branch}` : "All"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "PP")}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => togglePin(n)} title={n.is_pinned ? "Unpin" : "Pin"}>
                  {n.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}