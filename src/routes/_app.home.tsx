import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, GraduationCap, Inbox } from "lucide-react";
import { Link } from "@tanstack/react-router";

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
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          to="/seniordesk"
          className="group rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:border-primary/50"
        >
          <GraduationCap className="mb-2 h-6 w-6 text-primary" />
          <p className="text-sm font-semibold text-foreground">SeniorDesk</p>
          <p className="text-xs text-muted-foreground">Ask seniors & teachers</p>
        </Link>
        <Link
          to="/doubts"
          className="group rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:border-accent/50"
        >
          <Inbox className="mb-2 h-6 w-6 text-accent" />
          <p className="text-sm font-semibold text-foreground">Doubt Box</p>
          <p className="text-xs text-muted-foreground">Anonymous doubts</p>
        </Link>
      </div>
      <Card className="border-dashed bg-card shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-accent" />
            More coming soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notes, chat, gigs, and more campus features are on the way.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}