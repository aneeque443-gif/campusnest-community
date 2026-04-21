import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { openDirectMessage } from "@/lib/chat/use-chat";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export function NewDmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; full_name: string; photo_url: string | null; year: string; branch: string }>>([]);

  useEffect(() => {
    if (!open || !user) return;
    const t = setTimeout(async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, photo_url, year, branch")
        .neq("id", user.id)
        .limit(20);
      if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
      const { data } = await query;
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, user]);

  async function start(otherId: string) {
    if (!user) return;
    try {
      const roomId = await openDirectMessage(user.id, otherId);
      onOpenChange(false);
      navigate({ to: "/chat/$roomId", params: { roomId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start DM");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New direct message</DialogTitle></DialogHeader>
        <Input placeholder="Search students by name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {results.map((p) => (
            <button key={p.id} onClick={() => start(p.id)} className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-muted">
              <Avatar className="h-9 w-9">
                <AvatarImage src={p.photo_url ?? undefined} />
                <AvatarFallback>{p.full_name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.year} · {p.branch}</p>
              </div>
            </button>
          ))}
          {results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No students found</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}