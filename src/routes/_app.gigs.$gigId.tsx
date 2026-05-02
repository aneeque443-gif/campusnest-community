import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { openDirectMessage } from "@/lib/chat/use-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Star, Clock, Tag } from "lucide-react";
import { toast } from "sonner";
import type { Gig, GigReview } from "@/lib/gigs";

export const Route = createFileRoute("/_app/gigs/$gigId")({
  head: () => ({ meta: [{ title: "Gig — CampusNest" }] }),
  component: GigDetail,
});

function GigDetail() {
  const { gigId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [gig, setGig] = useState<Gig | null>(null);
  const [seller, setSeller] = useState<{ id: string; full_name: string; photo_url: string | null; year: string | null; branch: string | null; bio: string | null } | null>(null);
  const [reviews, setReviews] = useState<(GigReview & { buyer?: { full_name: string; photo_url: string | null } })[]>([]);
  const [hireOpen, setHireOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("gigs").select("*").eq("id", gigId).maybeSingle();
      setGig(data);
      if (data) {
        const { data: s } = await supabase.from("profiles").select("id, full_name, photo_url, year, branch, bio").eq("id", data.seller_id).maybeSingle();
        setSeller(s);
      }
      const { data: rv } = await supabase.from("gig_reviews").select("*").eq("gig_id", gigId).order("created_at", { ascending: false });
      const buyerIds = Array.from(new Set((rv ?? []).map((r) => r.buyer_id)));
      let buyers: Record<string, { full_name: string; photo_url: string | null }> = {};
      if (buyerIds.length) {
        const { data: bp } = await supabase.from("profiles").select("id, full_name, photo_url").in("id", buyerIds);
        bp?.forEach((b) => (buyers[b.id] = { full_name: b.full_name, photo_url: b.photo_url }));
      }
      setReviews((rv ?? []).map((r) => ({ ...r, buyer: buyers[r.buyer_id] })));
    })();
  }, [gigId]);

  async function hire() {
    if (!user || !gig) return;
    setBusy(true);
    try {
      const roomId = await openDirectMessage(user.id, gig.seller_id);
      const { error } = await supabase.from("gig_orders").insert({
        gig_id: gig.id, buyer_id: user.id, seller_id: gig.seller_id,
        details: details.trim(), room_id: roomId, status: "pending",
      });
      if (error) throw error;
      await supabase.from("chat_messages").insert({
        room_id: roomId, sender_id: user.id,
        content: `📦 Gig request: ${gig.title}\n\n${details.trim() || "(no details)"}`,
      });
      toast.success("Hire request sent in DM");
      nav({ to: "/chat/$roomId", params: { roomId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hire. Make sure you are friends.");
    } finally {
      setBusy(false);
    }
  }

  if (!gig) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const mine = user?.id === gig.seller_id;

  return (
    <div className="space-y-4 px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/gigs" })}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
      {gig.cover_image && <img src={gig.cover_image} alt={gig.title} className="h-56 w-full rounded-lg object-cover" />}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold">{gig.title}</h1>
          <Badge>{gig.category}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{gig.delivery_days}d</span>
          {gig.rating_count > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{gig.rating_avg} ({gig.rating_count})</span>}
          <span className="ml-auto text-lg font-bold text-accent">₹{gig.price_inr}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{gig.description}</p>
        {gig.skill_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {gig.skill_tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]"><Tag className="mr-1 h-2.5 w-2.5" />{t}</Badge>)}
          </div>
        )}
      </div>

      {gig.sample_images.length > 1 && (
        <div className="grid grid-cols-3 gap-2">
          {gig.sample_images.map((u) => <img key={u} src={u} className="aspect-square w-full rounded object-cover" />)}
        </div>
      )}

      {seller && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">About the seller</CardTitle></CardHeader>
          <CardContent className="flex items-start gap-3">
            <Avatar className="h-12 w-12"><AvatarImage src={seller.photo_url ?? undefined} /><AvatarFallback>{seller.full_name[0]}</AvatarFallback></Avatar>
            <div className="text-sm">
              <p className="font-semibold">{seller.full_name}</p>
              <p className="text-xs text-muted-foreground">{seller.year} · {seller.branch}</p>
              {seller.bio && <p className="mt-1 text-xs">{seller.bio}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {!mine && (
        <Dialog open={hireOpen} onOpenChange={setHireOpen}>
          <DialogTrigger asChild><Button className="w-full">Hire — ₹{gig.price_inr}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Hire {seller?.full_name}</DialogTitle></DialogHeader>
            <Textarea placeholder="Project details: what do you need, when, any references…" value={details} onChange={(e) => setDetails(e.target.value)} rows={5} />
            <Button onClick={hire} disabled={busy}>{busy ? "Sending…" : "Send hire request"}</Button>
            <p className="text-xs text-muted-foreground">You must be friends with the seller to start a DM.</p>
          </DialogContent>
        </Dialog>
      )}
      {mine && <Link to="/gigs/orders"><Button variant="outline" className="w-full">View orders for this gig</Button></Link>}

      <div>
        <h2 className="mb-2 font-semibold">Reviews</h2>
        {reviews.length === 0 && <p className="text-xs text-muted-foreground">No reviews yet.</p>}
        <div className="space-y-2">
          {reviews.map((r) => (
            <Card key={r.id}><CardContent className="space-y-1 p-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6"><AvatarImage src={r.buyer?.photo_url ?? undefined} /><AvatarFallback>{r.buyer?.full_name?.[0] ?? "?"}</AvatarFallback></Avatar>
                <span className="text-xs font-medium">{r.buyer?.full_name ?? "Buyer"}</span>
                <span className="ml-auto flex items-center text-xs">
                  {Array.from({length:5}).map((_,i) => <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}
                </span>
              </div>
              {r.body && <p className="text-sm">{r.body}</p>}
            </CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}
