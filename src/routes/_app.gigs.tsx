import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Star, Briefcase, Inbox } from "lucide-react";
import { GIG_CATEGORIES, type Gig } from "@/lib/gigs";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/gigs")({
  head: () => ({ meta: [{ title: "GigNest — CampusNest" }] }),
  component: GigsPage,
});

type SellerInfo = { id: string; full_name: string; photo_url: string | null; year: string | null };

function GigsPage() {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [sellers, setSellers] = useState<Record<string, SellerInfo>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [maxPrice, setMaxPrice] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gigs")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setGigs(data ?? []);
      const ids = Array.from(new Set((data ?? []).map((g) => g.seller_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url, year")
          .in("id", ids);
        const map: Record<string, SellerInfo> = {};
        profs?.forEach((p) => (map[p.id] = p as SellerInfo));
        setSellers(map);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const max = maxPrice ? Number(maxPrice) : null;
    return gigs.filter((g) => {
      if (cat !== "All" && g.category !== cat) return false;
      if (max != null && g.price_inr > max) return false;
      if (ql) {
        const hay = (g.title + " " + (g.skill_tags || []).join(" ")).toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [gigs, q, cat, maxPrice]);

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">GigNest</h1>
          <p className="text-xs text-muted-foreground">Hire fellow students for skills.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/gigs/orders">
            <Button size="sm" variant="outline"><Inbox className="mr-1 h-4 w-4" />Orders</Button>
          </Link>
          <Link to="/gigs/new">
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />New</Button>
          </Link>
        </div>
      </header>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search title or skill…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input type="number" placeholder="Max price ₹" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <Tabs value={cat} onValueChange={setCat}>
          <TabsList className="flex w-full flex-wrap h-auto">
            <TabsTrigger value="All">All</TabsTrigger>
            {GIG_CATEGORIES.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-40" /> No gigs match.
          </CardContent></Card>
        )}
        {filtered.map((g) => {
          const s = sellers[g.seller_id];
          return (
            <Link key={g.id} to="/gigs/$gigId" params={{ gigId: g.id }}>
              <Card className="overflow-hidden shadow-[var(--shadow-card)] hover:-translate-y-0.5 transition-transform">
                {g.cover_image && <img src={g.cover_image} alt={g.title} className="h-40 w-full object-cover" />}
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{g.title}</h3>
                    <Badge variant="secondary">{g.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6"><AvatarImage src={s?.photo_url ?? undefined} /><AvatarFallback>{s?.full_name?.[0] ?? "?"}</AvatarFallback></Avatar>
                      <span className="text-muted-foreground">{s?.full_name ?? "Student"}{s?.year ? ` · ${s.year}` : ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {g.rating_count > 0 && (
                        <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{g.rating_avg}</span>
                      )}
                      <span className="font-bold text-accent">₹{g.price_inr}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
