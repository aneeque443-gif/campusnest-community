import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ArrowLeft, ArrowUp, EyeOff, Eye, GraduationCap } from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  academic: "Academic",
  personal_guidance: "Personal guidance",
  college_complaint: "College complaint",
  exam_stress: "Exam stress",
  career_confusion: "Career confusion",
};

type Doubt = {
  id: string;
  category: string;
  content: string;
  upvote_count: number;
  reply_count: number;
  is_revealed: boolean;
  is_answered: boolean;
  created_at: string;
  upvoted?: boolean;
  is_mine?: boolean;
  revealed_author?: { full_name: string; photo_url: string | null } | null;
};

type Reply = {
  id: string;
  content: string;
  replier_id: string;
  created_at: string;
  replier?: { full_name: string; photo_url: string | null } | null;
  replier_role?: "senior_mentor" | "teacher" | "admin" | null;
};

export const Route = createFileRoute("/_app/doubts/$doubtId")({
  head: () => ({ meta: [{ title: "Doubt — CampusNest" }] }),
  component: DoubtDetailPage,
});

function DoubtDetailPage() {
  const { doubtId } = Route.useParams();
  const { user } = useAuth();
  const { isTeacher, isAdmin, roles } = useRoles();
  const canReply = isTeacher || isAdmin || roles.includes("senior_mentor");

  const [d, setD] = useState<Doubt | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: dr } = await supabase
      .from("doubts")
      .select("id, category, content, upvote_count, reply_count, is_revealed, is_answered, created_at")
      .eq("id", doubtId)
      .maybeSingle();
    if (!dr) {
      setLoading(false);
      return;
    }
    const doubt = dr as Doubt;
    if (user) {
      const { data: up } = await supabase
        .from("doubt_upvotes")
        .select("id")
        .eq("doubt_id", doubtId)
        .eq("user_id", user.id)
        .maybeSingle();
      doubt.upvoted = !!up;
      const { data: mine } = await supabase.rpc("is_doubt_author", { _doubt_id: doubtId });
      doubt.is_mine = !!mine;
    }

    // If revealed AND viewer is the author, show their own profile.
    // Author_id column is restricted; we expose via is_doubt_author. To show name on reveal,
    // we keep it simple: only the author can see their own name (since they posted it).
    if (doubt.is_revealed && doubt.is_mine && user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, photo_url")
        .eq("id", user.id)
        .maybeSingle();
      doubt.revealed_author = prof ?? null;
    }
    setD(doubt);

    const { data: rs } = await supabase
      .from("doubt_replies")
      .select("*")
      .eq("doubt_id", doubtId)
      .order("created_at", { ascending: true });
    const rows = (rs ?? []) as Reply[];
    const ids = rows.map((r) => r.replier_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      const rmap = new Map<string, "senior_mentor" | "teacher" | "admin">();
      (roleRows ?? []).forEach((r) => {
        if (r.role === "teacher" || r.role === "admin" || r.role === "senior_mentor") {
          const cur = rmap.get(r.user_id);
          if (!cur || (cur === "senior_mentor" && r.role !== "senior_mentor")) {
            rmap.set(r.user_id, r.role as "senior_mentor" | "teacher" | "admin");
          }
        }
      });
      rows.forEach((r) => {
        r.replier = pmap.get(r.replier_id) ?? null;
        r.replier_role = rmap.get(r.replier_id) ?? null;
      });
    }
    setReplies(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doubtId, user?.id]);

  const submitReply = async () => {
    if (!user || !content.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("doubt_replies").insert({
      doubt_id: doubtId,
      replier_id: user.id,
      content: content.trim().slice(0, 2000),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    toast.success("Reply posted");
    setContent("");
    load();
  };

  const toggleUpvote = async () => {
    if (!user || !d) return;
    if (d.upvoted) {
      await supabase.from("doubt_upvotes").delete().eq("doubt_id", d.id).eq("user_id", user.id);
    } else {
      await supabase.from("doubt_upvotes").insert({ doubt_id: d.id, user_id: user.id });
    }
    load();
  };

  const reveal = async () => {
    if (!d) return;
    const { error } = await supabase
      .from("doubts")
      .update({ is_revealed: true })
      .eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Identity revealed (only visible to you)");
    load();
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!d) return <div className="p-6 text-center text-sm text-muted-foreground">Doubt not found</div>;

  return (
    <div className="px-4 py-4">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/doubts" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Doubt</h1>
      </header>

      <Card className="mb-4">
        <CardContent className="space-y-2 p-4">
          <Badge variant="outline" className="text-xs">{CAT_LABELS[d.category]}</Badge>
          <p className="whitespace-pre-wrap text-sm">{d.content}</p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant={d.upvoted ? "default" : "outline"}
              onClick={toggleUpvote}
            >
              <ArrowUp className="mr-1 h-3 w-3" /> {d.upvote_count}
            </Button>
            {d.is_mine && !d.is_revealed && (
              <Button size="sm" variant="ghost" onClick={reveal}>
                <Eye className="mr-1 h-3 w-3" /> Reveal my identity
              </Button>
            )}
            {d.is_mine && d.is_revealed && d.revealed_author && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" /> You: {d.revealed_author.full_name}
              </span>
            )}
            {!d.is_mine && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <EyeOff className="h-3 w-3" /> Anonymous
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </h3>

      <div className="mb-4 space-y-3">
        {replies.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={r.replier?.photo_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {r.replier?.full_name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{r.replier?.full_name ?? "User"}</p>
                  {r.replier_role && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                      <GraduationCap className="h-3 w-3" />
                      {r.replier_role === "senior_mentor"
                        ? "Senior Mentor"
                        : r.replier_role === "teacher"
                          ? "Teacher"
                          : "Admin"}
                    </span>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canReply ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a helpful reply..."
              maxLength={2000}
              rows={4}
            />
            <Button onClick={submitReply} disabled={posting || !content.trim()} className="w-full">
              {posting ? "Posting..." : "Reply publicly"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            Only teachers and senior mentors can reply.
          </CardContent>
        </Card>
      )}
    </div>
  );
}