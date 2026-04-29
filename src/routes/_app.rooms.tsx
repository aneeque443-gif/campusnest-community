import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, DoorOpen, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SLOTS, type SlotKey } from "@/lib/rooms";

type Room = { id: string; name: string; capacity: number; location: string };
type Booking = { room_id: string; slot: SlotKey; user_id: string; purpose: string };

export const Route = createFileRoute("/_app/rooms")({
  head: () => ({ meta: [{ title: "Book a Room — CampusNest" }] }),
  component: RoomsPage,
});

function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(false);
  const [selRoom, setSelRoom] = useState<Room | null>(null);
  const [selSlot, setSelSlot] = useState<SlotKey | null>(null);
  const [purpose, setPurpose] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [saving, setSaving] = useState(false);

  const dateStr = useMemo(() => format(date, "yyyy-MM-dd"), [date]);

  async function load() {
    setLoading(true);
    const { data: rs } = await supabase
      .from("study_rooms")
      .select("id, name, capacity, location")
      .eq("is_active", true)
      .order("name");
    setRooms((rs ?? []) as Room[]);
    const { data: bs } = await supabase
      .from("study_room_bookings")
      .select("room_id, slot, user_id, purpose")
      .eq("booking_date", dateStr)
      .eq("status", "confirmed");
    setBookings((bs ?? []) as Booking[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [dateStr]);

  function isBooked(roomId: string, slot: SlotKey) {
    return bookings.find((b) => b.room_id === roomId && b.slot === slot);
  }

  async function confirmBooking() {
    if (!user || !selRoom || !selSlot) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("study_room_bookings").insert({
        room_id: selRoom.id,
        user_id: user.id,
        booking_date: dateStr,
        slot: selSlot,
        purpose,
        party_size: partySize,
      });
      if (error) throw error;
      toast.success("Room booked! +10 XP");
      setBookOpen(false);
      setPurpose("");
      setPartySize(1);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Book a Room</h1>
          <p className="text-xs text-muted-foreground">Reserve a study space on campus</p>
        </div>
        <Link to="/rooms/mine">
          <Button variant="outline" size="sm">My Bookings</Button>
        </Link>
      </header>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No rooms available yet. Ask an admin to add some.
          </CardContent>
        </Card>
      ) : (
        rooms.map((room) => (
          <Card key={room.id} className="shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DoorOpen className="h-5 w-5 text-accent" />
                {room.name}
              </CardTitle>
              <div className="flex flex-wrap gap-1.5 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> Capacity {room.capacity}
                </span>
                {room.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {room.location}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {SLOTS.map((s) => {
                const booked = isBooked(room.id, s.key);
                const mine = booked && booked.user_id === user?.id;
                return (
                  <Button
                    key={s.key}
                    variant={booked ? "secondary" : "outline"}
                    size="sm"
                    disabled={!!booked}
                    onClick={() => {
                      setSelRoom(room);
                      setSelSlot(s.key);
                      setBookOpen(true);
                    }}
                    className={cn(
                      "justify-start text-xs",
                      booked && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="flex-1 text-left">{s.label}</span>
                    {booked && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {mine ? "Yours" : "Booked"}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm booking</DialogTitle>
          </DialogHeader>
          {selRoom && selSlot && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-xs">
                <p className="font-semibold text-foreground">{selRoom.name}</p>
                <p className="text-muted-foreground">
                  {format(date, "PPP")} · {SLOTS.find((s) => s.key === selSlot)?.label}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  rows={2}
                  maxLength={200}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Group study, project meeting…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="party">Number of people</Label>
                <Input
                  id="party"
                  type="number"
                  min={1}
                  max={selRoom.capacity}
                  value={partySize}
                  onChange={(e) => setPartySize(Math.max(1, Math.min(selRoom.capacity, +e.target.value || 1)))}
                />
                <p className="text-[10px] text-muted-foreground">Max {selRoom.capacity}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookOpen(false)}>Cancel</Button>
            <Button onClick={confirmBooking} disabled={saving || !purpose.trim()}>
              {saving ? "Booking…" : "Confirm (+10 XP)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}