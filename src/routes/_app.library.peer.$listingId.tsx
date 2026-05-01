import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CONDITION_LABEL, type BookCondition, type PeerListingStatus } from "@/lib/library";
import { openDirectMessage } from "@/lib/chat/use-chat";

type Listing = {
  id: string; owner_id: string; title: string; author: string; subject: string | null;
  condition: BookCondition; duration_days: number; status: PeerListingStatus; notes: string;
};
type Profile = { id: string; full_name: string; year: string; branch: string };

export const Route = createFileRoute("/_app/library/peer/$listingId")({
  head: () => ({ meta: [{ title: "Peer book — Library" }] }),
  component: PeerListingPage,
});

function PeerListingPage() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("peer_book_listings").select("*").eq("id", listingId).maybeSingle();
    if (!data) return;
    setListing(data as Listing);
    const { data: p } = await supabase.from("profiles").select("id, full_name, year, branch").eq("id", (data as Listing).owner_id).maybeSingle();
    setOwner(p as Profile | null);
  }
  useEffect(() => { load(); }, [listingId]);

  async function requestBorrow() {
    if (!user || !listing) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("peer_book_requests").insert({
        listing_id: listing.id, requester_id: user.id, owner_id: listing.owner_id,
        status: "pending", message: `Hi! I'd love to borrow "${listing.title}".`,
      });
      if (error) throw error;
      const roomId = await openDirectMessage(user.id, listing.owner_id);
      await supabase.from("chat_messages").insert({
        room_id: roomId, sender_id: user.id,
        content: `📚 I'd like to borrow your book "${listing.title}" by ${listing.author}.`,
      });
      toast.success("Request sent — check your DMs");
      nav({ to: "/chat/$roomId", params: { roomId } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send request");
    } finally { setBusy(false); }
  }

  async function setStatus(status: PeerListingStatus) {
    if (!listing) return;
    const { error } = await supabase.from("peer_book_listings").update({ status }).eq("id", listing.id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  }

  async function remove() {
    if (!listing || !confirm("Delete this listing?")) return;
    const { error } = await supabase.from("peer_book_listings").delete().eq("id", listing.id);
    if (error) return toast.error(error.message);
    nav({ to: "/library" });
  }

  if (!listing) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  const isOwner = user?.id === listing.owner_id;

  return (
    <div className="space-y-3 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button asChild size="icon" variant="ghost"><Link to="/library"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-lg font-bold text-foreground">Peer listing</h1>
      </div>
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">{listing.title}</h2>
              <p className="text-sm text-muted-foreground">{listing.author}</p>
            </div>
            <Badge variant={listing.status === "available" ? "default" : "secondary"} className="capitalize">
              {listing.status === "lent" ? "Currently lent" : listing.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1 text-[11px]">
            {listing.subject && <Badge variant="secondary">{listing.subject}</Badge>}
            <Badge variant="outline">{CONDITION_LABEL[listing.condition]}</Badge>
            <Badge variant="outline">{listing.duration_days} days</Badge>
          </div>
          {owner && (
            <p className="text-xs text-muted-foreground">
              Owner: <span className="font-medium text-foreground">{owner.full_name}</span> · {owner.year} · {owner.branch}
            </p>
          )}
          {listing.notes && <p className="whitespace-pre-wrap text-sm text-foreground">{listing.notes}</p>}
        </CardContent>
      </Card>

      {isOwner ? (
        <div className="flex gap-2">
          {listing.status === "available" && <Button className="flex-1" variant="secondary" onClick={() => setStatus("lent")}>Mark as lent</Button>}
          {listing.status === "lent" && <Button className="flex-1" onClick={() => setStatus("available")}>Mark available again</Button>}
          {listing.status !== "withdrawn" && <Button variant="outline" onClick={() => setStatus("withdrawn")}>Withdraw</Button>}
          <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ) : (
        <Button className="w-full" disabled={busy || listing.status !== "available"} onClick={requestBorrow}>
          <MessageCircle className="h-4 w-4" /> {listing.status === "available" ? "Request to Borrow" : "Not available"}
        </Button>
      )}
    </div>
  );
}