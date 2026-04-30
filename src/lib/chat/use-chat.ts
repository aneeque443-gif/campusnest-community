import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Room = Database["public"]["Tables"]["chat_rooms"]["Row"];
export type Subroom = Database["public"]["Tables"]["chat_subrooms"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
export type Reaction = Database["public"]["Tables"]["chat_message_reactions"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type RoomWithMeta = Room & {
  unread: number;
  lastMessageAt: string | null;
  preview: string | null;
  otherUser?: Pick<Profile, "id" | "full_name" | "photo_url"> | null;
};

/** List rooms the user can see (class+open always; study_group/dm only if member). */
export function useUserRooms(userId: string | undefined) {
  const [rooms, setRooms] = useState<RoomWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    // RLS already filters: select all rooms the user can see.
    const { data: roomData } = await supabase
      .from("chat_rooms")
      .select("*")
      .order("created_at", { ascending: true });
    if (!roomData) return;

    const roomIds = roomData.map((r) => r.id);
    const [{ data: members }, { data: lastMsgs }] = await Promise.all([
      supabase
        .from("chat_room_members")
        .select("room_id, last_read_at, user_id")
        .in("room_id", roomIds),
      supabase
        .from("chat_messages")
        .select("room_id, content, created_at, attachment_name")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false }),
    ]);

    const myRead = new Map<string, string>();
    members?.filter((m) => m.user_id === userId).forEach((m) => myRead.set(m.room_id, m.last_read_at));

    const lastByRoom = new Map<string, { content: string; created_at: string; attachment_name: string | null }>();
    lastMsgs?.forEach((m) => {
      if (!lastByRoom.has(m.room_id)) lastByRoom.set(m.room_id, m);
    });

    // Unread counts per room
    const unreadByRoom = new Map<string, number>();
    for (const r of roomData) {
      const lastRead = myRead.get(r.id);
      const count = lastMsgs?.filter(
        (m) => m.room_id === r.id && (!lastRead || m.created_at > lastRead),
      ).length ?? 0;
      unreadByRoom.set(r.id, count);
    }

    // For DMs, find the other user
    const dmRooms = roomData.filter((r) => r.kind === "dm");
    let otherProfileMap = new Map<string, Pick<Profile, "id" | "full_name" | "photo_url">>();
    if (dmRooms.length) {
      const otherIds = members
        ?.filter((m) => dmRooms.some((d) => d.id === m.room_id) && m.user_id !== userId)
        .map((m) => m.user_id) ?? [];
      if (otherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", otherIds);
        profs?.forEach((p) => otherProfileMap.set(p.id, p));
      }
    }
    const dmOther = new Map<string, Pick<Profile, "id" | "full_name" | "photo_url">>();
    for (const dm of dmRooms) {
      const otherMember = members?.find((m) => m.room_id === dm.id && m.user_id !== userId);
      if (otherMember) {
        const p = otherProfileMap.get(otherMember.user_id);
        if (p) dmOther.set(dm.id, p);
      }
    }

    setRooms(
      roomData.map((r) => {
        const last = lastByRoom.get(r.id);
        return {
          ...r,
          unread: unreadByRoom.get(r.id) ?? 0,
          lastMessageAt: last?.created_at ?? null,
          preview: last?.content || (last?.attachment_name ? `📎 ${last.attachment_name}` : null),
          otherUser: dmOther.get(r.id) ?? null,
        };
      }),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 3 seconds for new rooms / unread counts / previews.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => refreshRef.current(), 3000);
    return () => clearInterval(id);
  }, [userId]);

  return { rooms, loading, refresh };
}

/** Total unread across all rooms. */
export function useTotalUnread(userId: string | undefined) {
  const { rooms } = useUserRooms(userId);
  return rooms.reduce((sum, r) => sum + r.unread, 0);
}

/** Mark a room as read up to now. */
export async function markRoomRead(roomId: string, userId: string) {
  // Upsert-like behavior: try update; if no row, insert membership (for class/open rooms users may not be members yet).
  const { error: updErr, count } = await supabase
    .from("chat_room_members")
    .update({ last_read_at: new Date().toISOString() }, { count: "exact" })
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (!updErr && (count ?? 0) > 0) return;
  await supabase.from("chat_room_members").insert({ room_id: roomId, user_id: userId });
}

/** Open or create a DM room+thread with another user. Returns room id. */
export async function openDirectMessage(myId: string, otherId: string): Promise<string> {
  if (myId === otherId) throw new Error("Cannot DM yourself");
  // Require an accepted friendship before allowing DM creation
  const { data: friend } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`,
    )
    .maybeSingle();
  if (!friend) throw new Error("You must be friends to message this person");
  const [a, b] = [myId, otherId].sort();
  const { data: existing } = await supabase
    .from("direct_message_threads")
    .select("room_id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing?.room_id) return existing.room_id;

  // Look up other profile for room name
  const { data: other } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", otherId)
    .maybeSingle();
  const { data: room, error: roomErr } = await supabase
    .from("chat_rooms")
    .insert({ kind: "dm", name: other?.full_name ?? "Direct Message", created_by: myId })
    .select("id")
    .single();
  if (roomErr || !room) throw roomErr ?? new Error("Could not create DM room");
  await supabase.from("direct_message_threads").insert({ room_id: room.id, user_a: a, user_b: b });
  await supabase.from("chat_room_members").insert([
    { room_id: room.id, user_id: a },
    { room_id: room.id, user_id: b },
  ]);
  return room.id;
}

/** Create a study group with a list of members (excluding creator who is auto-added). */
export async function createStudyGroup(name: string, creatorId: string, memberIds: string[]) {
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .insert({ kind: "study_group", name, created_by: creatorId })
    .select("id")
    .single();
  if (error || !room) throw error ?? new Error("Could not create group");
  const all = Array.from(new Set([creatorId, ...memberIds]));
  await supabase.from("chat_room_members").insert(all.map((uid) => ({ room_id: room.id, user_id: uid })));
  return room.id;
}