import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, MessageSquare, Shield } from "lucide-react";

const CATEGORIES = [
  { value: "academic", label: "Academic" },
  { value: "career", label: "Career" },
  { value: "personal_growth", label: "Personal growth" },
  { value: "college_life", label: "College life" },
] as const;

type Cat = (typeof CATEGORIES)[number]["value"];

type Question = {
  id: string;
  title: string;
  description: string;
  category: Cat;
  is_anonymous: boolean;
  asker_id: string;
  answer_count: number;
  created_at: string;
  asker?: { full_name: string; photo_url: string | null } | null;
};

export const Route = createFileRoute("/_app/seniordesk")({
  head: () => ({ meta: [{ title: "SeniorDesk — CampusNest" }] }),
  component: SeniorDeskPage,
});

function SeniorDeskPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Cat | "all">("all");
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<Cat>("academic");
  const [anon, setAnon] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("senior_questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("category", filter);
    const { data } = await q;
    const rows = (data ?? []) as Question[];
    const visibleAskers = rows
      .filter((r) => !r.is_anonymous)
      .map((r) => r.asker_id);
    if (visibleAskers.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", visibleAskers);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        if (!r.is_anonymous) r.asker = map.get(r.asker_id) ?? null;
      });
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const post = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title required");
    setPosting(true);
    const { error } = await supabase.from("senior_questions").insert({
      asker_id: user.id,
      title: title.trim().slice(0, 200),
      description: desc.trim().slice(0, 2000),
      category: cat,
      is_anonymous: anon,
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    toast.success("Question posted");
    setTitle("");
    setDesc("");
    setAnon(false);
    setOpen(false);
    load();
  };

  return (
    <div className="px-4 py-4">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/home" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary">SeniorDesk</h1>
          <p className="text-xs text-muted-foreground">Get guidance from seniors & teachers</p>
        </div>
        {isAdmin && (
          <Link to="/seniordesk/admin">
            <Button variant="outline" size="sm">
              <Shield className="mr-1 h-4 w-4" /> Admin
            </Button>
          </Link>
        )}
      </header>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <Badge
          variant={filter === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("all")}
        >
          All
        </Badge>
        {CATEGORIES.map((c) => (
          <Badge
            key={c.value}
            variant={filter === c.value ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setFilter(c.value)}
          >
            {c.label}
          </Badge>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mb-4 w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" /> Ask a question
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask a senior</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you want to know?"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={cat} onValueChange={(v) => setCat(v as Cat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={desc}
                maxLength={2000}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Add context (optional)"
                rows={4}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Post anonymously</p>
                <p className="text-xs text-muted-foreground">Shows as "Anonymous Student"</p>
              </div>
              <Switch checked={anon} onCheckedChange={setAnon} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={post} disabled={posting}>
              {posting ? "Posting..." : "Post question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No questions yet. Be the first to ask!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <Link key={q.id} to="/seniordesk/$questionId" params={{ questionId: q.id }}>
              <Card className="transition hover:border-primary/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{q.title}</h3>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {CATEGORIES.find((c) => c.value === q.category)?.label}
                    </Badge>
                  </div>
                  {q.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{q.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {q.is_anonymous ? "Anonymous Student" : (q.asker?.full_name ?? "Student")}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {q.answer_count}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}