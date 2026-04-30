import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link, useNavigate } from "@tanstack/react-router";
import { openDirectMessage } from "@/lib/chat/use-chat";
import { useFriends } from "@/lib/friends";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export function NewDmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { friends, loading } = useFriends(user?.id);
  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return friends
      .filter((f) => f.other)
      .filter((f) => !ql || f.other!.full_name.toLowerCase().includes(ql));
  }, [friends, q]);

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
        <DialogHeader><DialogTitle>Message a friend</DialogTitle></DialogHeader>
        <Input placeholder="Search your friends…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && results.map((f) => {
            const p = f.other!;
            return (
              <button key={f.id} onClick={() => start(p.id)} className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-muted">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={p.photo_url ?? undefined} />
                  <AvatarFallback>{p.full_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.year} · {p.branch}</p>
                </div>
              </button>
            );
          })}
          {!loading && results.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {friends.length === 0 ? "You don't have any friends yet." : "No matches in your friends list."}
              </p>
            </div>
          )}
        </div>
        <Link to="/friends" onClick={() => onOpenChange(false)}>
          <Button variant="outline" className="w-full">
            <UserPlus className="mr-2 h-4 w-4" /> Find people to add
          </Button>
        </Link>
      </DialogContent>
    </Dialog>
  );
}