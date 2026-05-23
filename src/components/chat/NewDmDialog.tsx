import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { openDirectMessage } from "@/lib/chat/use-chat";
import { useFriends } from "@/lib/friends";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

type Profile = { id: string; full_name: string; photo_url: string | null; year: string | null; branch: string | null };

export function NewDmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [allResults, setAllResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const { friends, loading } = useFriends(user?.id);

  const friendResults = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return friends
      .filter((f) => f.other)
      .filter((f) => !ql || f.other!.full_name.toLowerCase().includes(ql));
  }, [friends, q]);

  useEffect(() => {
    if (!open || !user) return;
    const ql = q.trim();
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, photo_url, year, branch")
        .neq("id", user.id)
        .order("full_name", { ascending: true })
        .limit(50);
      if (ql) query = query.ilike("full_name", `%${ql}%`);
      const { data } = await query;
      if (!cancelled) {
        setAllResults((data ?? []) as Profile[]);
        setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q, user]);

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

  function Row({ p }: { p: Profile | NonNullable<ReturnType<typeof Object>> & { id: string; full_name: string; photo_url: string | null; year: string | null; branch: string | null } }) {
    return (
      <button
        onClick={() => start(p.id)}
        className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-muted"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={p.photo_url ?? undefined} />
          <AvatarFallback>{p.full_name?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{p.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {[p.year, p.branch].filter(Boolean).join(" · ") || "Student"}
          </p>
        </div>
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New message</DialogTitle></DialogHeader>
        <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">Everyone</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="max-h-72 space-y-1 overflow-y-auto">
            {searching && <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>}
            {!searching && allResults.map((p) => <Row key={p.id} p={p} />)}
            {!searching && allResults.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
            )}
          </TabsContent>
          <TabsContent value="friends" className="max-h-72 space-y-1 overflow-y-auto">
            {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
            {!loading && friendResults.map((f) => <Row key={f.id} p={f.other as Profile} />)}
            {!loading && friendResults.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {friends.length === 0 ? "No friends yet — use Everyone tab." : "No matches."}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}