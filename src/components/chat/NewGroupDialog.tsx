import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { createStudyGroup } from "@/lib/chat/use-chat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export function NewGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; full_name: string; photo_url: string | null }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const t = setTimeout(async () => {
      let query = supabase.from("profiles").select("id, full_name, photo_url").neq("id", user.id).limit(20);
      if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
      const { data } = await query;
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, user]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function create() {
    if (!user || !name.trim() || selected.size === 0) {
      toast.error("Add a name and at least one member");
      return;
    }
    setBusy(true);
    try {
      const roomId = await createStudyGroup(name.trim(), user.id, Array.from(selected));
      onOpenChange(false);
      setName(""); setSelected(new Set()); setQ("");
      navigate({ to: "/chat/$roomId", params: { roomId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New study group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Group name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DSA crew" />
          </div>
          <div className="space-y-1.5">
            <Label>Add members</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded border">
            {results.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 p-2 hover:bg-muted">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <Avatar className="h-8 w-8">
                  <AvatarImage src={p.photo_url ?? undefined} />
                  <AvatarFallback>{p.full_name[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{p.full_name}</span>
              </label>
            ))}
          </div>
          {selected.size > 0 && <p className="text-xs text-muted-foreground">{selected.size} selected</p>}
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create group"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}