import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";
import type { GigOrder, Gig } from "@/lib/gigs";

export const Route = createFileRoute("/_app/gigs/orders")({
  head: () => ({ meta: [{ title: "Gig Orders — CampusNest" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState<(GigOrder & { gig?: Gig })[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("gig_orders").select("*").order("created_at", { ascending: false });
    const gigIds = Array.from(new Set((data ?? []).map((o) => o.gig_id)));
    let gigs: Record<string, Gig> = {};
    if (gigIds.length) {
      const { data: g } = await supabase.from("gigs").select("*").in("id", gigIds);
      g?.forEach((x) => (gigs[x.id] = x));
    }
    setOrders((data ?? []).map((o) => ({ ...o, gig: gigs[o.gig_id] })));
    const orderIds = (data ?? []).map((o) => o.id);
    if (orderIds.length) {
      const { data: rv } = await supabase.from("gig_reviews").select("order_id").in("order_id", orderIds);
      setReviewed(new Set((rv ?? []).map((r) => r.order_id)));
    }
  }
  useEffect(() => { load(); }, [user]);

  async function setStatus(id: string, status: GigOrder["status"]) {
    const { error } = await supabase.from("gig_orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  }

  const buying = orders.filter((o) => o.buyer_id === user?.id);
  const selling = orders.filter((o) => o.seller_id === user?.id);

  return (
    <div className="space-y-4 px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/gigs" })}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
      <h1 className="text-2xl font-bold text-primary">Gig Orders</h1>
      <Tabs defaultValue="buying">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buying">Buying ({buying.length})</TabsTrigger>
          <TabsTrigger value="selling">Selling ({selling.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="buying"><OrderList orders={buying} role="buyer" reviewed={reviewed} onChange={setStatus} onReviewed={load} /></TabsContent>
        <TabsContent value="selling"><OrderList orders={selling} role="seller" reviewed={reviewed} onChange={setStatus} onReviewed={load} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OrderList({ orders, role, reviewed, onChange, onReviewed }: {
  orders: (GigOrder & { gig?: Gig })[];
  role: "buyer" | "seller";
  reviewed: Set<string>;
  onChange: (id: string, s: GigOrder["status"]) => void;
  onReviewed: () => void;
}) {
  if (orders.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>;
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <Card key={o.id}><CardContent className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <Link to="/gigs/$gigId" params={{ gigId: o.gig_id }} className="font-semibold hover:underline">{o.gig?.title ?? "Gig"}</Link>
            <Badge variant={o.status === "completed" ? "default" : "secondary"}>{o.status}</Badge>
          </div>
          {o.details && <p className="text-xs text-muted-foreground line-clamp-3">{o.details}</p>}
          <div className="flex flex-wrap gap-2">
            {o.room_id && <Link to="/chat/$roomId" params={{ roomId: o.room_id }}><Button size="sm" variant="outline">Open chat</Button></Link>}
            {role === "seller" && o.status === "pending" && <Button size="sm" onClick={() => onChange(o.id, "accepted")}>Accept</Button>}
            {role === "seller" && o.status === "accepted" && <Button size="sm" onClick={() => onChange(o.id, "in_progress")}>Start</Button>}
            {o.status !== "completed" && o.status !== "cancelled" && (
              <Button size="sm" variant="default" onClick={() => onChange(o.id, "completed")}>Mark complete</Button>
            )}
            {o.status !== "completed" && (
              <Button size="sm" variant="ghost" onClick={() => onChange(o.id, "cancelled")}>Cancel</Button>
            )}
            {role === "buyer" && o.status === "completed" && !reviewed.has(o.id) && (
              <ReviewDialog order={o} onDone={onReviewed} />
            )}
            {reviewed.has(o.id) && <Badge variant="outline">Reviewed</Badge>}
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

function ReviewDialog({ order, onDone }: { order: GigOrder; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  async function submit() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("gig_reviews").insert({
      gig_id: order.gig_id, order_id: order.id,
      buyer_id: user.id, seller_id: order.seller_id,
      rating, body: body.trim(),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Review posted"); setOpen(false); onDone(); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Leave review</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rate this gig</DialogTitle></DialogHeader>
        <div className="flex justify-center gap-1">
          {[1,2,3,4,5].map((n) => (
            <button key={n} onClick={() => setRating(n)}>
              <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <Textarea placeholder="Optional written feedback…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} />
        <Button onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post review"}</Button>
      </DialogContent>
    </Dialog>
  );
}
