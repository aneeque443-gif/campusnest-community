import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { markRoomRead, type ChatMessage, type Reaction, type Room, type Subroom, type Profile } from "@/lib/chat/use-chat";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pin } from "lucide-react";
import { Composer } from "@/components/chat/Composer";
import { MessageItem } from "@/components/chat/MessageItem";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat/$roomId")({
  head: () => ({ meta: [{ title: "Chat room — CampusNest" }] }),
  component: RoomView,
});

function RoomView() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isTeacher, isAdmin, isClassRep } = useRoles();
  const canPin = isTeacher || isAdmin || isClassRep;
  const canAnnounce = isTeacher || isAdmin;

  const [room, setRoom] = useState<Room | null>(null);
  const [subrooms, setSubrooms] = useState<Subroom[]>([]);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Pick<Profile, "id" | "full_name" | "photo_url">>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const profilesRef = useRef(profilesById);
  useEffect(() => {
    profilesRef.current = profilesById;
  }, [profilesById]);

  // Load room + subrooms
  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: subs }] = await Promise.all([
        supabase.from("chat_rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("chat_subrooms").select("*").eq("room_id", roomId).order("position"),
      ]);
      if (!r) {
        toast.error("Room not found or access denied");
        navigate({ to: "/chat" });
        return;
      }
      setRoom(r);
      setSubrooms(subs ?? []);
      setActiveSub(subs?.[0]?.id ?? null);
    })();
  }, [roomId, navigate]);

  // Fetch messages + reactions + sender profiles for the active sub-room.
  async function fetchMessages(roomId: string, subFilter: string | null) {
    let q = supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    if (subFilter) q = q.eq("subroom_id", subFilter);
    const { data: msgs } = await q;
    const list = msgs ?? [];
    setMessages(list);
    if (list.length) {
      const ids = list.map((m) => m.id);
      const senderIds = Array.from(new Set(list.map((m) => m.sender_id)));
      const missing = senderIds.filter((id) => !profilesRef.current[id]);
      const [{ data: rx }, profsRes] = await Promise.all([
        supabase.from("chat_message_reactions").select("*").in("message_id", ids),
        missing.length
          ? supabase.from("profiles").select("id, full_name, photo_url").in("id", missing)
          : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name" | "photo_url">[] }),
      ]);
      setReactions(rx ?? []);
      if (profsRes.data && profsRes.data.length) {
        setProfilesById((prev) => {
          const next = { ...prev };
          profsRes.data!.forEach((p) => (next[p.id] = p));
          return next;
        });
      }
    } else {
      setReactions([]);
    }
  }

  // Initial load + poll every 3 seconds for new messages and reactions.
  useEffect(() => {
    if (!room) return;
    const subFilter = subrooms.length > 0 ? activeSub : null;
    fetchMessages(roomId, subFilter);
    const id = setInterval(() => fetchMessages(roomId, subFilter), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roomId, activeSub, subrooms.length]);

  // Auto-scroll + mark read
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    if (user && messages.length) markRoomRead(roomId, user.id);
  }, [messages, roomId, user]);

  if (!room || !user) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const pinned = messages.filter((m) => m.is_pinned);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/chat" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold">{room.name}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {room.kind === "dm" ? "Direct message" : room.kind.replace("_", " ")}
          </p>
        </div>
      </header>

      {subrooms.length > 0 && (
        <Tabs value={activeSub ?? ""} onValueChange={setActiveSub} className="px-3 pt-2">
          <TabsList className="w-full justify-start overflow-x-auto">
            {subrooms.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {pinned.length > 0 && (
        <div className="mx-3 mt-2 rounded-md border border-accent/30 bg-accent/10 p-2 text-xs">
          <div className="mb-1 flex items-center gap-1 font-medium text-accent">
            <Pin className="h-3 w-3" /> Pinned
          </div>
          {pinned.map((m) => (
            <p key={m.id} className="truncate">
              <span className="font-medium">{profilesById[m.sender_id]?.full_name ?? "Someone"}:</span>{" "}
              {m.content || m.attachment_name}
            </p>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Be the first 👋</p>
        )}
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            sender={profilesById[m.sender_id]}
            replyTarget={m.reply_to ? messages.find((x) => x.id === m.reply_to) ?? null : null}
            replyTargetSender={
              m.reply_to
                ? profilesById[messages.find((x) => x.id === m.reply_to)?.sender_id ?? ""]
                : undefined
            }
            reactions={reactions.filter((r) => r.message_id === m.id)}
            currentUserId={user.id}
            canPin={canPin}
            onReply={() => setReplyTo(m)}
          />
        ))}
      </div>

      <Composer
        roomId={roomId}
        subroomId={activeSub}
        userId={user.id}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        canAnnounce={canAnnounce}
      />
    </div>
  );
}