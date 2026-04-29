import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type DailyQuest = {
  id: string;
  quest_key: string;
  title: string;
  target: number;
  progress: number;
  xp_reward: number;
  completed: boolean;
  bonus_awarded: boolean;
};

export type LeaderboardRow = {
  user_id: string;
  full_name: string;
  photo_url: string | null;
  year: string;
  branch: string;
  level: string;
  week_xp: number;
};

export type Badge = {
  key: string;
  label: string;
  description: string;
  emoji: string;
};

export const ALL_BADGES: Badge[] = [
  { key: "first_post", label: "First Post", description: "Uploaded first note", emoji: "📝" },
  { key: "note_sharer", label: "Note Sharer", description: "Uploaded 10+ notes", emoji: "📚" },
  { key: "knowledge_king", label: "Knowledge King", description: "Uploaded 25+ notes", emoji: "👑" },
  { key: "helpful_senior", label: "Helpful Senior", description: "Answered 20+ SeniorDesk questions", emoji: "🧑‍🏫" },
  { key: "top_gigger", label: "Top Gigger", description: "Completed 5 gigs with 5★", emoji: "💼" },
  { key: "reporter", label: "Reporter", description: "Published 3+ articles", emoji: "📰" },
  { key: "community_star", label: "Community Star", description: "100+ upvotes received", emoji: "⭐" },
  { key: "bookworm", label: "Bookworm", description: "Borrowed/reviewed 5+ books", emoji: "🐛" },
  { key: "streak_master", label: "Streak Master", description: "7-day quest streak", emoji: "🔥" },
  { key: "social_butterfly", label: "Social Butterfly", description: "DM'd 10+ students", emoji: "🦋" },
];

export function levelFromXp(xp: number): string {
  if (xp >= 700) return "Legend";
  if (xp >= 300) return "Scholar";
  if (xp >= 100) return "Active";
  return "Beginner";
}

export function levelColor(level: string): string {
  switch (level) {
    case "Legend": return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "Scholar": return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "Active": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default: return "bg-muted text-muted-foreground";
  }
}

export function useDailyQuests() {
  const { user } = useAuth();
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) {
      setQuests([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await supabase.rpc("ensure_my_quests");
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_quests")
        .select("id, quest_key, title, target, progress, xp_reward, completed, bonus_awarded")
        .eq("user_id", user.id)
        .eq("quest_date", today)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setQuests((data ?? []) as DailyQuest[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, tick]);

  // Poll every 30s so UI reflects new server-side progress
  useEffect(() => {
    if (!user) return;
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, [user]);

  return { quests, loading, refresh: () => setTick((t) => t + 1) };
}

export function useWeeklyLeaderboard(scope: "class" | "college", year?: string, branch?: string) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("weekly_leaderboard")
        .select("user_id, full_name, photo_url, year, branch, level, week_xp")
        .order("week_xp", { ascending: false })
        .limit(10);
      if (scope === "class" && year && branch) {
        q = q.eq("year", year).eq("branch", branch);
      }
      const { data } = await q;
      if (!cancelled) {
        setRows((data ?? []) as LeaderboardRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, year, branch]);

  return { rows, loading };
}

export function useUserBadges(userId: string | undefined) {
  const [keys, setKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_badges")
      .select("badge_key")
      .eq("user_id", userId)
      .then(({ data }) => setKeys((data ?? []).map((b) => b.badge_key)));
  }, [userId]);
  return keys;
}

/** Track time spent on LecVault and bump quest every 5 minutes. */
export function useLecVaultBrowseTracker() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const startKey = `lecvault_browse_start_${user.id}`;
    const start = Date.now();
    sessionStorage.setItem(startKey, String(start));
    let last = start;
    const interval = setInterval(() => {
      const now = Date.now();
      const minutes = Math.floor((now - last) / 60_000);
      if (minutes >= 1) {
        supabase.rpc("bump_lecvault_browse", { _minutes: minutes });
        last = now;
      }
    }, 60_000);
    return () => {
      clearInterval(interval);
      const now = Date.now();
      const minutes = Math.floor((now - last) / 60_000);
      if (minutes >= 1) {
        supabase.rpc("bump_lecvault_browse", { _minutes: minutes });
      }
    };
  }, [user]);
}