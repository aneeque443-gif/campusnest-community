import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CONDITION_LABEL, type BookCondition } from "@/lib/library";

export const Route = createFileRoute("/_app/library/peer/new")({
  head: () => ({ meta: [{ title: "Lend a book — Library" }] }),
  component: NewListing,
});

function NewListing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "", author: "", subject: "",
    condition: "good" as BookCondition, duration_days: 14, notes: "",
  });

  async function submit() {
    if (!user || !form.title.trim() || !form.author.trim()) return toast.error("Title and author required");
    setBusy(true);
    const { error } = await supabase.from("peer_book_listings").insert({
      owner_id: user.id, title: form.title.trim(), author: form.author.trim(),
      subject: form.subject || null, condition: form.condition,
      duration_days: form.duration_days, notes: form.notes,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Listing created");
    nav({ to: "/library" });
  }

  return (
    <div className="space-y-3 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button asChild size="icon" variant="ghost"><Link to="/library"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-lg font-bold text-foreground">Lend a book</h1>
      </div>
      <Card><CardContent className="space-y-2 p-3">
        <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
        <Input placeholder="Subject (optional)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Condition</Label>
            <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as BookCondition })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONDITION_LABEL) as BookCondition[]).map((c) => (
                  <SelectItem key={c} value={c}>{CONDITION_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Duration (days)</Label>
            <Input type="number" min={1} value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: Math.max(1, +e.target.value || 1) })} />
          </div>
        </div>
        <Textarea placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <Button className="w-full" onClick={submit} disabled={busy}>Create listing</Button>
      </CardContent></Card>
    </div>
  );
}