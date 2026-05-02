import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { openDirectMessage } from "@/lib/chat/use-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Search } from "lucide-react";
import { uploadLfImage } from "@/lib/gigs";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type LfItem = Database["public"]["Tables"]["lost_found_items"]["Row"];

export const Route = createFileRoute("/_app/lost-found")({
  head: () => ({ meta: [{ title: "Lost & Found — CampusNest" }] }),
  component: LostFoundPage,
});

function LostFoundPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const nav = useNavigate();
  const [items, setItems] = useState<LfItem[]>([]);
  const [posters, setPosters] = useState<Record<string, { full_name: string; photo_url: string | null }>>({});
  const [tab, setTab] = useState<string>("all");
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("lost_found_items").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((i) => i.poster_id)));
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, full_name, photo_url").in("id", ids);
      const map: Record<string, { full_name: string; photo_url: string | null }> = {};
      p?.forEach((x) => (map[x.id] = { full_name: x.full_name, photo_url: x.photo_url }));
      setPosters(map);
    }
  }
  useEffect(() => { load(); }, []);

  async function claim(item: LfItem) {
    if (!user) return;
    if (item.poster_id === user.id) return;
    try {
      const roomId = await openDirectMessage(user.id, item.poster_id);
      await supabase.from("chat_messages").insert({
        room_id: roomId, sender_id: user.id,
        content: `🔎 Lost & Found: "${item.name}" — I think this is mine!`,
      });
      nav({ to: "/chat/$roomId", params: { roomId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "You must be friends to message the poster.");
    }
  }

  async function resolve(id: string) {
    const { error } = await supabase.from("lost_found_items").update({ status: "resolved" }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Marked resolved"); load(); }
  }

  const filtered = items.filter((i) => tab === "all" || i.kind === tab);

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Lost & Found</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Post</Button></DialogTrigger>
          <DialogContent><PostForm onDone={() => { setOpen(false); load(); }} /></DialogContent>
        </Dialog>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="lost">Lost</TabsTrigger>
          <TabsTrigger value="found">Found</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing posted yet.</p>}
        {filtered.map((i) => {
          const p = posters[i.poster_id];
          return (
            <Card key={i.id} className={i.status === "resolved" ? "opacity-60" : ""}>
              {i.photo_url && <img src={i.photo_url} alt={i.name} className="h-40 w-full rounded-t-xl object-cover" />}
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{i.name}</h3>
                    <p className="text-xs text-muted-foreground">By {p?.full_name ?? "Student"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={i.kind === "lost" ? "destructive" : "default"}>{i.kind.toUpperCase()}</Badge>
                    {i.status === "resolved" && <Badge variant="outline">Resolved</Badge>}
                  </div>
                </div>
                {i.description && <p className="text-sm">{i.description}</p>}
                {i.location && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{i.location}{i.occurred_on ? ` · ${i.occurred_on}` : ""}</p>}
                {i.status === "open" && (
                  <div className="flex gap-2 pt-1">
                    {user?.id !== i.poster_id && (
                      <Button size="sm" onClick={() => claim(i)}><Search className="mr-1 h-3.5 w-3.5" />This is mine</Button>
                    )}
                    {(user?.id === i.poster_id || isAdmin) && (
                      <Button size="sm" variant="outline" onClick={() => resolve(i.id)}>Mark resolved</Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PostForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [foundIt, setFoundIt] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      let photo: string | null = null;
      if (file) photo = await uploadLfImage(user.id, file);
      const { error } = await supabase.from("lost_found_items").insert({
        poster_id: user.id, kind: foundIt ? "found" : "lost",
        name: name.trim(), description: desc.trim(),
        location: location.trim(), occurred_on: date || null,
        photo_url: photo,
      });
      if (error) throw error;
      toast.success("Posted");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <DialogHeader><DialogTitle>Post item</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center justify-between rounded-md border p-2">
          <Label className="text-sm">I found this item</Label>
          <Switch checked={foundIt} onCheckedChange={setFoundIt} />
        </div>
        <div><Label>Item name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></div>
        <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} /></div>
        <div><Label>Location {foundIt ? "found" : "last seen"}</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} /></div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>Photo (optional)</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Posting…" : "Post"}</Button>
      </form>
    </>
  );
}
