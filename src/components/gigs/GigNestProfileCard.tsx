import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Briefcase, Star } from "lucide-react";
import type { Gig } from "@/lib/gigs";

export function GigNestProfileCard({ userId }: { userId: string }) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [completed, setCompleted] = useState(0);
  const [avg, setAvg] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("gigs").select("*").eq("seller_id", userId).order("created_at", { ascending: false });
      setGigs(data ?? []);
      const { count } = await supabase.from("gig_orders").select("id", { count: "exact", head: true })
        .eq("seller_id", userId).eq("status", "completed");
      setCompleted(count ?? 0);
      const { data: rv } = await supabase.from("gig_reviews").select("rating").eq("seller_id", userId);
      if (rv && rv.length) {
        setAvg(Math.round((rv.reduce((s, r) => s + r.rating, 0) / rv.length) * 10) / 10);
      }
    })();
  }, [userId]);

  if (gigs.length === 0) return null;
  const active = gigs.filter((g) => g.is_active).length;

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Briefcase className="h-4 w-4 text-accent" /> GigNest
        </h2>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-muted p-2"><div className="text-lg font-bold">{active}</div>Active</div>
          <div className="rounded-md bg-muted p-2"><div className="text-lg font-bold">{completed}</div>Completed</div>
          <div className="rounded-md bg-muted p-2">
            <div className="flex items-center justify-center gap-0.5 text-lg font-bold">
              {avg ?? "—"}{avg != null && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            </div>Avg rating
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {gigs.slice(0, 3).map((g) => (
            <Link key={g.id} to="/gigs/$gigId" params={{ gigId: g.id }} className="flex items-center justify-between rounded p-2 text-xs hover:bg-muted">
              <span className="truncate">{g.title}</span>
              <span className="font-semibold text-accent">₹{g.price_inr}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
