import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Newspaper, Sparkles, Flame, Star, DoorOpen, Megaphone, BookOpen } from "lucide-react";
import { QuestsCard } from "@/components/gamification/QuestsCard";
import { LeaderboardCard } from "@/components/gamification/LeaderboardCard";
import { Badge } from "@/components/ui/badge";
import { levelColor } from "@/lib/gamification";

export const Route = createFileRoute("/_app/home")({
  head: () => ({ meta: [{ title: "Home — CampusNest" }] }),
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [stats, setStats] = useState<{ xp: number; level: string; streak: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, xp, level, streak")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.full_name?.split(" ")[0] ?? "");
        if (data) setStats({ xp: data.xp, level: data.level, streak: data.streak });
      });
  }, [user]);

  return (
    <div className="space-y-4 px-4 py-6">
      <header>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <div className="flex items-end justify-between gap-2">
          <h1 className="text-2xl font-bold text-primary">
            Hi{name ? `, ${name}` : ""} 👋
          </h1>
          {stats && (
            <div className="flex items-center gap-1.5">
              <Badge className={`gap-1 ${levelColor(stats.level)}`} variant="secondary">
                <Star className="h-3 w-3" /> {stats.level}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Flame className="h-3 w-3 text-orange-500" /> {stats.streak}
              </Badge>
            </div>
          )}
        </div>
        {stats && (
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.xp} XP total
          </p>
        )}
      </header>

      <QuestsCard />
      <LeaderboardCard />

      <div className="grid grid-cols-2 gap-3">
        <Link to="/rooms">
          <Card className="h-full shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <DoorOpen className="h-4 w-4 text-accent" /> Book a Room
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-[11px] text-muted-foreground">Reserve a study room slot.</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/notices">
          <Card className="h-full shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Megaphone className="h-4 w-4 text-accent" /> Notices
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-[11px] text-muted-foreground">Department announcements.</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Link to="/library">
        <Card className="shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5 text-accent" /> Library
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Browse the catalog or borrow from peers.</p>
          </CardContent>
        </Card>
      </Link>

      <Link to="/feed">
        <Card className="shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="h-5 w-5 text-accent" />
              NestFeed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">College news, events, photo stories & polls.</p>
          </CardContent>
        </Card>
      </Link>
      <Card className="border-dashed bg-card shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-accent" />
            More coming soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Gigs and more campus features are on the way.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}