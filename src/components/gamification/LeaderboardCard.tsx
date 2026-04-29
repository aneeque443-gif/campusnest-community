import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyLeaderboard, levelColor } from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";

export function LeaderboardCard() {
  const { user } = useAuth();
  const [year, setYear] = useState<string | undefined>();
  const [branch, setBranch] = useState<string | undefined>();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("year, branch")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setYear(data?.year ?? undefined);
        setBranch(data?.branch ?? undefined);
      });
  }, [user]);

  const college = useWeeklyLeaderboard("college");
  const cls = useWeeklyLeaderboard("class", year, branch);

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-accent" />
          Weekly Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="class">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="class">My Class</TabsTrigger>
            <TabsTrigger value="college">College-wide</TabsTrigger>
          </TabsList>
          <TabsContent value="class" className="mt-3">
            <List rows={cls.rows} loading={cls.loading} currentUserId={user?.id} />
          </TabsContent>
          <TabsContent value="college" className="mt-3">
            <List rows={college.rows} loading={college.loading} currentUserId={user?.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function List({
  rows,
  loading,
  currentUserId,
}: {
  rows: ReturnType<typeof useWeeklyLeaderboard>["rows"];
  loading: boolean;
  currentUserId?: string;
}) {
  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (rows.length === 0)
    return <p className="text-xs text-muted-foreground">No XP earned yet this week.</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((r, idx) => {
        const isMe = r.user_id === currentUserId;
        return (
          <li
            key={r.user_id}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              isMe ? "bg-accent/10" : "bg-muted/40"
            }`}
          >
            <span className="w-5 text-center text-xs font-bold text-muted-foreground">
              {idx + 1}
            </span>
            {r.photo_url ? (
              <img src={r.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {r.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {r.full_name}
            </span>
            <Badge variant="secondary" className={`text-[10px] ${levelColor(r.level)}`}>
              {r.level}
            </Badge>
            <span className="shrink-0 text-xs font-bold text-accent">{r.week_xp} XP</span>
          </li>
        );
      })}
    </ol>
  );
}