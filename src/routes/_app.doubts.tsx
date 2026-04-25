import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, ArrowUp, MessageSquare, TrendingUp, EyeOff } from "lucide-react";

const CATEGORIES = [
  { value: "academic", label: "Academic" },
  { value: "personal_guidance", label: "Personal guidance" },
  { value: "college_complaint", label: "College complaint" },
  { value: "exam_stress", label: "Exam stress" },
  { value: "career_confusion", label: "Career confusion" },
] as const;

type Cat = (typeof CATEGORIES)[number]["value"];

type Doubt = {
  id: string;
  category: Cat;
  content: string;
  upvote_count: number;
  reply_count: number;
  is_answered: boolean;
  created_at: string;
  upvoted?: boolean;
  is_mine?: boolean;
};

export const Route = createFileRoute("/_app/doubts")({
  head: () => ({ meta: [{ title: "Doubt Box — CampusNest" }] }),
  component: DoubtsPage,
});

function DoubtsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"all" | "trending">("all");
  const [items, setItems] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [content, setContent] = useState("");
  const [cat, setCat] = useState<Cat>("academic");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("doubts")
      .select("id, category, content, upvote_count, reply_count, is_answered, created_at");
    if (tab === "trending") {
      q = q.eq("is_answered", false).order("upvote_count", { ascending: false }).limit(5);
    } else {
      q = q.order("created_at", { ascending: false });
    }
    const { data, error } = await q;
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Doubt[];
    if (user && rows.length) {
      const ids = rows.map((r) => r.id);
      const { data: ups } = await supabase
        .from("doubt_upvotes")
        .select("doubt_id")
        .eq("user_id", user.id)
        .in("doubt_id", ids);
      const upset = new Set((ups ?? []).map((u) => u.doubt_id));
      const { data: mine } = await supabase.rpc("my_doubt_ids");
      const mineSet = new Set((mine ?? []) as string[]);
      rows.forEach((r) => {
        r.upvoted = upset.has(r.id);
        r.is_mine = mineSet.has(r.id);
      });
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const post = async () => {
    if (!user || !content.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("doubts").insert({
      author_id: user.id,
      category: cat,
      content: content.trim().slice(0, 1500),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    toast.success("Doubt posted anonymously (+5 XP)");
    setContent("");
    setOpen(false);
    load();
  };

  const toggleUpvote = async (d: Doubt) => {
    if (!user) return;
    if (d.upvoted) {
      await supabase.from("doubt_upvotes").delete().eq("doubt_id", d.id).eq("user_id", user.id);
    } else {
      await supabase.from("doubt_upvotes").insert({ doubt_id: d.id, user_id: user.id });
    }
    load();
  };

  return (
    <div className="px-4 py-4">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/home" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary">Anonymous Doubt Box</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <EyeOff className="h-3 w-3" /> Identities are private
          </p>
        </div>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mb-4 w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" /> Post a doubt
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post anonymously</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
              <Label>Your doubt</Label>
              <Textarea
                value={content}
                maxLength={1500}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Speak freely — no name attached"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={post} disabled={posting || !content.trim()}>
              {posting ? "Posting..." : "Post (+5 XP)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "trending")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All doubts</TabsTrigger>
          <TabsTrigger value="trending">
            <TrendingUp className="mr-1 h-3 w-3" /> Trending
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No doubts {tab === "trending" ? "trending right now" : "yet"}.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((d) => (
                <Card key={d.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORIES.find((c) => c.value === d.category)?.label}
                      </Badge>
                      {d.is_mine && (
                        <Badge variant="secondary" className="text-xs">Your doubt</Badge>
                      )}
                    </div>
                    <Link to="/doubts/$doubtId" params={{ doubtId: d.id }}>
                      <p className="line-clamp-3 text-sm">{d.content}</p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={d.upvoted ? "default" : "outline"}
                        onClick={() => toggleUpvote(d)}
                      >
                        <ArrowUp className="mr-1 h-3 w-3" /> {d.upvote_count}
                      </Button>
                      <Link to="/doubts/$doubtId" params={{ doubtId: d.id }}>
                        <Button size="sm" variant="ghost">
                          <MessageSquare className="mr-1 h-3 w-3" /> {d.reply_count}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}