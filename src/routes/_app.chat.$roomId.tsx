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

  // Load messages + reactions for current sub-room
  useEffect(() => {
    if (!room) return;
    const subFilter = subrooms.length > 0 ? activeSub : null;
    (async () => {
      let q = supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (subFilter) q = q.eq("subroom_id", subFilter);
      const { data: msgs } = await q;
      setMessages(msgs ?? []);

      if (msgs && msgs.length) {
        const ids = msgs.map((m) => m.id);
        const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
        const [{ data: rx }, { data: profs }] = await Promise.all([
          supabase.from("chat_message_reactions").select("*").in("message_id", ids),
          supabase.from("profiles").select("id, full_name, photo_url").in("id", senderIds),
        ]);
        setReactions(rx ?? []);
        const map: Record<string, Pick<Profile, "id" | "full_name" | "photo_url">> = {};
        profs?.forEach((p) => (map[p.id] = p));
        setProfilesById(map);
      } else {
        setReactions([]);
      }
    })();
  }, [room, roomId, activeSub, subrooms.length]);

  // Realtime updates
  useEffect(() => {
    if (!room || !user) return;
    const ch = supabase
      .channel(`room-${roomId}-${activeSub ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage | undefined;
          const oldMsg = payload.old as ChatMessage | undefined;
          const matchesSub = (m?: ChatMessage) =>
            !m || subrooms.length === 0 || m.subroom_id === activeSub;
          if (payload.eventType === "INSERT" && newMsg && matchesSub(newMsg)) {
            setMessages((prev) => [...prev, newMsg]);
            if (!profilesById[newMsg.sender_id]) {
              const { data: p } = await supabase
                .from("profiles")
                .select("id, full_name, photo_url")
                .eq("id", newMsg.sender_id)
                .maybeSingle();
              if (p) setProfilesById((x) => ({ ...x, [p.id]: p }));
            }
          } else if (payload.eventType === "UPDATE" && newMsg) {
            setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? newMsg : m)));
          } else if (payload.eventType === "DELETE" && oldMsg) {
            setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_message_reactions" },
        (payload) => {
          if (payload.eventType === "INSERT") setReactions((x) => [...x, payload.new as Reaction]);
          else if (payload.eventType === "DELETE")
            setReactions((x) => x.filter((r) => r.id !== (payload.old as Reaction).id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [room, roomId, activeSub, subrooms.length, user, profilesById]);

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