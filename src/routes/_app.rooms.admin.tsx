import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SLOTS, type SlotKey } from "@/lib/rooms";

type Room = { id: string; name: string; capacity: number; location: string; is_active: boolean };
type Booking = {
  id: string;
  booking_date: string;
  slot: SlotKey;
  purpose: string;
  user_id: string;
  status: string;
  study_rooms: { name: string } | null;
};

export const Route = createFileRoute("/_app/rooms/admin")({
  head: () => ({ meta: [{ title: "Rooms Admin — CampusNest" }] }),
  component: RoomsAdmin,
});

function RoomsAdmin() {
  const { isAdmin, loading: roleLoading } = useRoles();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: rs } = await supabase
      .from("study_rooms")
      .select("id, name, capacity, location, is_active")
      .order("name");
    setRooms((rs ?? []) as Room[]);
    const { data: bs } = await supabase
      .from("study_room_bookings")
      .select("id, booking_date, slot, purpose, user_id, status, study_rooms(name)")
      .gte("booking_date", new Date().toISOString().slice(0, 10))
      .order("booking_date")
      .limit(100);
    const list = (bs ?? []) as unknown as Booking[];
    setBookings(list);
    const ids = Array.from(new Set(list.map((b) => b.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (ps ?? []).forEach((p: { id: string; full_name: string }) => { map[p.id] = p.full_name; });
      setNames(map);
    }
  }

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (roleLoading) return <div className="p-6 text-center text-sm">Loading…</div>;
  if (!isAdmin) return <Navigate to="/rooms" />;

  async function addRoom() {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("study_rooms").insert({ name, capacity, location });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Room added");
      setName(""); setCapacity(4); setLocation("");
      load();
    }
  }

  async function removeRoom(id: string) {
    if (!confirm("Delete this room and all its bookings?")) return;
    const { error } = await supabase.from("study_rooms").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Room removed"); load(); }
  }

  async function cancelBooking(id: string) {
    const { error } = await supabase
      .from("study_room_bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Booking cancelled"); load(); }
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link to="/rooms"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-primary">Rooms Admin</h1>
          <p className="text-xs text-muted-foreground">Manage study rooms and bookings</p>
        </div>
      </header>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base">Add a room</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Library Room A" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(+e.target.value || 1)} /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="2nd floor" /></div>
          </div>
          <Button onClick={addRoom} disabled={saving} className="w-full"><Plus className="mr-1 h-4 w-4" />Add room</Button>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base">Existing rooms</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rooms.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : rooms.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
              <div className="text-sm">
                <p className="font-semibold text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">Cap {r.capacity} · {r.location || "—"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeRoom(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming bookings</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {bookings.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming bookings.</p> : bookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-foreground truncate">{b.study_rooms?.name} · {SLOTS.find((s) => s.key === b.slot)?.label}</p>
                <p className="text-muted-foreground">{format(new Date(`${b.booking_date}T00:00:00`), "PP")} · {names[b.user_id] ?? "—"}</p>
                {b.purpose && <p className="truncate text-muted-foreground">{b.purpose}</p>}
              </div>
              {b.status === "confirmed" ? (
                <Button variant="outline" size="sm" onClick={() => cancelBooking(b.id)}>Cancel</Button>
              ) : <Badge variant="outline">Cancelled</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}