import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FriendRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export type FriendWithProfile = FriendRow & {
  other: { id: string; full_name: string; photo_url: string | null; year: string; branch: string } | null;
};

/** Send a friend request. Idempotent — re-sending after a decline reopens it. */
export async function sendFriendRequest(meId: string, otherId: string) {
  if (meId === otherId) throw new Error("Cannot friend yourself");

  // Check existing in either direction
  const { data: existing } = await supabase
    .from("friend_requests")
    .select("*")
    .or(
      `and(requester_id.eq.${meId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${meId})`,
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return { ok: true, status: "accepted" as const };
    if (existing.status === "pending") return { ok: true, status: "pending" as const };
    // declined → reopen by updating to pending (only requester can resend their own)
    if (existing.requester_id === meId) {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "pending" })
        .eq("id", existing.id);
      if (error) throw error;
      return { ok: true, status: "pending" as const };
    }
    // other declined us; create new in our direction
  }

  const { error } = await supabase
    .from("friend_requests")
    .insert({ requester_id: meId, addressee_id: otherId, status: "pending" });
  if (error) throw error;
  return { ok: true, status: "pending" as const };
}

export async function respondToFriendRequest(id: string, accept: boolean) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  if (error) throw error;
}

export async function removeFriendship(id: string) {
  const { error } = await supabase.from("friend_requests").delete().eq("id", id);
  if (error) throw error;
}

/** Hook: list of accepted friends with their profile. */
export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    const rows = (data ?? []) as FriendRow[];
    const otherIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
    let profiles = new Map<string, FriendWithProfile["other"]>();
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, year, branch")
        .in("id", otherIds);
      profs?.forEach((p) => profiles.set(p.id, p));
    }
    setFriends(
      rows.map((r) => {
        const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
        return { ...r, other: profiles.get(otherId) ?? null };
      }),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { friends, loading, refresh };
}

/** Hook: pending requests split into incoming and outgoing. */
export function useFriendRequests(userId: string | undefined) {
  const [incoming, setIncoming] = useState<FriendWithProfile[]>([]);
  const [outgoing, setOutgoing] = useState<FriendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("status", "pending")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    const rows = (data ?? []) as FriendRow[];
    const otherIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
    let profiles = new Map<string, FriendWithProfile["other"]>();
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, year, branch")
        .in("id", otherIds);
      profs?.forEach((p) => profiles.set(p.id, p));
    }
    const map = (r: FriendRow): FriendWithProfile => {
      const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
      return { ...r, other: profiles.get(otherId) ?? null };
    };
    setIncoming(rows.filter((r) => r.addressee_id === userId).map(map));
    setOutgoing(rows.filter((r) => r.requester_id === userId).map(map));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { incoming, outgoing, loading, refresh };
}

/** Get pairwise relationship status between me and other. */
export async function getFriendshipStatus(
  meId: string,
  otherId: string,
): Promise<{ status: "none" | "pending_out" | "pending_in" | "accepted" | "declined"; id?: string }> {
  if (meId === otherId) return { status: "none" };
  const { data } = await supabase
    .from("friend_requests")
    .select("*")
    .or(
      `and(requester_id.eq.${meId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${meId})`,
    )
    .maybeSingle();
  if (!data) return { status: "none" };
  if (data.status === "accepted") return { status: "accepted", id: data.id };
  if (data.status === "declined") return { status: "declined", id: data.id };
  return {
    status: data.requester_id === meId ? "pending_out" : "pending_in",
    id: data.id,
  };
}