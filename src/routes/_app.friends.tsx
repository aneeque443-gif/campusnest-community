import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  useFriends,
  useFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriendship,
  getFriendshipStatus,
} from "@/lib/friends";
import { openDirectMessage } from "@/lib/chat/use-chat";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, UserPlus, UserCheck, UserX, Clock, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/friends")({
  head: () => ({ meta: [{ title: "Friends — CampusNest" }] }),
  component: FriendsPage,
});

type SearchProfile = {
  id: string;
  full_name: string;
  photo_url: string | null;
  year: string;
  branch: string;
};

function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { friends, refresh: refreshFriends } = useFriends(user?.id);
  const { incoming, outgoing, refresh: refreshRequests } = useFriendRequests(user?.id);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Search students
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, photo_url, year, branch")
        .neq("id", user.id)
        .limit(20);
      if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
      const { data } = await query;
      setResults(data ?? []);

      // Get friendship status for each
      const map: Record<string, string> = {};
      await Promise.all(
        (data ?? []).map(async (p) => {
          const s = await getFriendshipStatus(user.id, p.id);
          map[p.id] = s.status;
        }),
      );
      setStatusMap(map);
    }, 250);
    return () => clearTimeout(t);
  }, [q, user, friends.length, incoming.length, outgoing.length]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.other?.id)), [friends]);

  async function handleSend(otherId: string) {
    if (!user) return;
    setBusy(otherId);
    try {
      await sendFriendRequest(user.id, otherId);
      toast.success("Friend request sent");
      await refreshRequests();
      setStatusMap((m) => ({ ...m, [otherId]: "pending_out" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(null);
    }
  }

  async function handleRespond(id: string, accept: boolean) {
    setBusy(id);
    try {
      await respondToFriendRequest(id, accept);
      toast.success(accept ? "Friend added" : "Request declined");
      await Promise.all([refreshRequests(), refreshFriends()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not respond");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(id: string) {
    setBusy(id);
    try {
      await removeFriendship(id);
      toast.success("Removed");
      await Promise.all([refreshRequests(), refreshFriends()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(null);
    }
  }

  async function handleMessage(otherId: string) {
    if (!user) return;
    try {
      const roomId = await openDirectMessage(user.id, otherId);
      navigate({ to: "/chat/$roomId", params: { roomId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open chat");
    }
  }

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-primary">Friends</h1>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">Friends ({friends.length})</TabsTrigger>
          <TabsTrigger value="requests">
            Requests {incoming.length > 0 && <Badge className="ml-1 bg-accent">{incoming.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="find">Find</TabsTrigger>
        </TabsList>

        {/* Friends list */}
        <TabsContent value="friends" className="space-y-2">
          {friends.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No friends yet. Use the Find tab to add some.
            </p>
          )}
          {friends.map((f) => {
            if (!f.other) return null;
            const p = f.other;
            return (
              <Card key={f.id} className="flex items-center gap-3 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p.photo_url ?? undefined} />
                  <AvatarFallback>{p.full_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.year} · {p.branch}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleMessage(p.id)}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(f.id)}
                  disabled={busy === f.id}
                  title="Remove friend"
                >
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests" className="space-y-4">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Incoming</h2>
            {incoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">No incoming requests.</p>
            ) : (
              <div className="space-y-2">
                {incoming.map((r) => {
                  if (!r.other) return null;
                  const p = r.other;
                  return (
                    <Card key={r.id} className="flex items-center gap-3 p-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={p.photo_url ?? undefined} />
                        <AvatarFallback>{p.full_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium">{p.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.year} · {p.branch}</p>
                      </div>
                      <Button size="sm" onClick={() => handleRespond(r.id, true)} disabled={busy === r.id}>
                        <UserCheck className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRespond(r.id, false)} disabled={busy === r.id}>
                        <UserX className="h-4 w-4" />
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Sent</h2>
            {outgoing.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending requests sent.</p>
            ) : (
              <div className="space-y-2">
                {outgoing.map((r) => {
                  if (!r.other) return null;
                  const p = r.other;
                  return (
                    <Card key={r.id} className="flex items-center gap-3 p-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={p.photo_url ?? undefined} />
                        <AvatarFallback>{p.full_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium">{p.full_name}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> Pending
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleRemove(r.id)} disabled={busy === r.id}>
                        Cancel
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>

        {/* Find people */}
        <TabsContent value="find" className="space-y-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students by name…"
          />
          {results.map((p) => {
            const isFriend = friendIds.has(p.id);
            const status = isFriend ? "accepted" : statusMap[p.id] ?? "none";
            return (
              <Card key={p.id} className="flex items-center gap-3 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p.photo_url ?? undefined} />
                  <AvatarFallback>{p.full_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.year} · {p.branch}</p>
                </div>
                {status === "accepted" && (
                  <Button size="sm" variant="outline" onClick={() => handleMessage(p.id)}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
                {status === "pending_out" && (
                  <Button size="sm" variant="outline" disabled>
                    <Clock className="mr-1 h-3 w-3" /> Sent
                  </Button>
                )}
                {status === "pending_in" && (
                  <Button size="sm" variant="outline" disabled>
                    Awaiting you
                  </Button>
                )}
                {(status === "none" || status === "declined") && (
                  <Button size="sm" onClick={() => handleSend(p.id)} disabled={busy === p.id}>
                    <UserPlus className="mr-1 h-3 w-3" /> Add
                  </Button>
                )}
              </Card>
            );
          })}
          {results.length === 0 && q.trim() && (
            <p className="py-6 text-center text-sm text-muted-foreground">No students found.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}