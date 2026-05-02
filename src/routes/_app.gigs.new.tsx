import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GIG_CATEGORIES, type GigCategory, uploadGigImage } from "@/lib/gigs";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/gigs/new")({
  head: () => ({ meta: [{ title: "New Gig — CampusNest" }] }),
  component: NewGigPage,
});

function NewGigPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<GigCategory>("Other");
  const [price, setPrice] = useState("100");
  const [days, setDays] = useState("3");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Title required");
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, 3)) {
        urls.push(await uploadGigImage(user.id, f));
      }
      const { data, error } = await supabase.from("gigs").insert({
        seller_id: user.id,
        title: title.trim(),
        description: desc.trim(),
        category,
        price_inr: Math.max(0, Number(price) || 0),
        delivery_days: Math.max(1, Number(days) || 1),
        cover_image: urls[0] ?? null,
        sample_images: urls,
        skill_tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      }).select("id").single();
      if (error) throw error;
      toast.success("Gig posted! +10 XP");
      nav({ to: "/gigs/$gigId", params: { gigId: data!.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/gigs" })}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
      <Card>
        <CardHeader><CardTitle>Create a gig</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required /></div>
            <div><Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as GigCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GIG_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={1000} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Price (₹)</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
              <div><Label>Delivery (days)</Label><Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></div>
            </div>
            <div><Label>Skill tags (comma separated)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. Figma, UI, branding" /></div>
            <div>
              <Label>Sample work (up to 3 images)</Label>
              <Input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Posting…" : "Post gig (+10 XP)"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
