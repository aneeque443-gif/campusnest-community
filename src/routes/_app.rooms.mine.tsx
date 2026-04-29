import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SLOTS, canCancel, type SlotKey } from "@/lib/rooms";

type Booking = {
  id: string;
  booking_date: string;
  slot: SlotKey;
  purpose: string;
  party_size: number;
  status: string;
  study_rooms: { name: string; location: string } | null;
};

export const Route = createFileRoute("/_app/rooms/mine")({
  head: () => ({ meta: [{ title: "My Bookings — CampusNest" }] }),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("study_room_bookings")
      .select("id, booking_date, slot, purpose, party_size, status, study_rooms(name, location)")
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false })
      .limit(50);
    setList((data ?? []) as unknown as Booking[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  async function cancel(b: Booking) {
    if (!canCancel(b.booking_date, b.slot)) {
      toast.error("Bookings can only be cancelled more than 1 hour before the slot.");
      return;
    }
    const { error } = await supabase
      .from("study_room_bookings")
      .update({ status: "cancelled" })
      .eq("id", b.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Booking cancelled");
      load();
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = list.filter((b) => b.booking_date >= today && b.status === "confirmed");
  const past = list.filter((b) => b.booking_date < today || b.status !== "confirmed");

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link to="/rooms">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-primary">My Bookings</h1>
          <p className="text-xs text-muted-foreground">Upcoming and past room reservations</p>
        </div>
      </header>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No upcoming bookings.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} b={b} onCancel={() => cancel(b)} cancellable={canCancel(b.booking_date, b.slot)} />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past</h2>
            {past.length === 0 ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No past bookings.</p>
            ) : (
              <div className="space-y-2">
                {past.map((b) => (
                  <BookingCard key={b.id} b={b} past />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function BookingCard({ b, onCancel, cancellable, past }: { b: Booking; onCancel?: () => void; cancellable?: boolean; past?: boolean }) {
  const slotLabel = SLOTS.find((s) => s.key === b.slot)?.label ?? b.slot;
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-accent" />
            {b.study_rooms?.name ?? "Room"}
          </span>
          {b.status === "cancelled" ? (
            <Badge variant="outline" className="text-[10px]">Cancelled</Badge>
          ) : past ? (
            <Badge variant="secondary" className="text-[10px]">Past</Badge>
          ) : (
            <Badge className="text-[10px]">Confirmed</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
        <p>{format(new Date(`${b.booking_date}T00:00:00`), "PPP")} · {slotLabel}</p>
        {b.purpose && <p>📝 {b.purpose}</p>}
        <p>👥 {b.party_size} people</p>
        {onCancel && b.status === "confirmed" && (
          <Button
            variant="outline"
            size="sm"
            disabled={!cancellable}
            onClick={onCancel}
            className="mt-1 h-7 text-xs"
          >
            <XIcon className="mr-1 h-3 w-3" />
            {cancellable ? "Cancel booking" : "Too late to cancel"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}