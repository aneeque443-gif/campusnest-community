import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Newspaper, MessageCircleQuestion, Sparkles, ShieldQuestion } from "lucide-react";

export const Route = createFileRoute("/_app/home")({
  head: () => ({ meta: [{ title: "Home — CampusNest" }] }),
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.full_name?.split(" ")[0] ?? ""));
  }, [user]);

  return (
    <div className="px-4 py-6">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-2xl font-bold text-primary">
          Hi{name ? `, ${name}` : ""} 👋
        </h1>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/feed">
          <Card className="h-full shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
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
        <Link to="/seniordesk">
          <Card className="h-full shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircleQuestion className="h-5 w-5 text-accent" />
                SeniorDesk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Ask seniors & teachers anything.</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/doubts">
          <Card className="h-full shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldQuestion className="h-5 w-5 text-accent" />
                Doubt Box
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Anonymous doubts, real answers.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
      <Card className="mt-4 border-dashed bg-card shadow-[var(--shadow-card)]">
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