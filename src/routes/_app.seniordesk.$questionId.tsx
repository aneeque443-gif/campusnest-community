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
import { ArrowLeft, ArrowUp, Pin, GraduationCap } from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  academic: "Academic",
  career: "Career",
  personal_growth: "Personal growth",
  college_life: "College life",
};

type Question = {
  id: string;
  title: string;
  description: string;
  category: string;
  is_anonymous: boolean;
  asker_id: string;
  created_at: string;
  asker?: { full_name: string; photo_url: string | null } | null;
};

type Answer = {
  id: string;
  content: string;
  answerer_id: string;
  upvote_count: number;
  is_pinned: boolean;
  created_at: string;
  answerer?: { full_name: string; photo_url: string | null } | null;
  answerer_role?: "senior_mentor" | "teacher" | "admin" | null;
  upvoted?: boolean;
};

export const Route = createFileRoute("/_app/seniordesk/$questionId")({
  head: () => ({ meta: [{ title: "Question — SeniorDesk" }] }),
  component: QuestionDetailPage,
});

function QuestionDetailPage() {
  const { questionId } = Route.useParams();
  const { user } = useAuth();
  const { isTeacher, isAdmin, roles } = useRoles();
  const canAnswer = isTeacher || isAdmin || roles.includes("senior_mentor");
  const canPin = isTeacher || isAdmin;

  const [q, setQ] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: qr } = await supabase
      .from("senior_questions")
      .select("*")
      .eq("id", questionId)
      .maybeSingle();
    if (!qr) {
      setLoading(false);
      return;
    }
    const question = qr as Question;
    if (!question.is_anonymous) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .eq("id", question.asker_id)
        .maybeSingle();
      question.asker = prof ?? null;
    }
    setQ(question);

    const { data: ans } = await supabase
      .from("senior_answers")
      .select("*")
      .eq("question_id", questionId)
      .order("is_pinned", { ascending: false })
      .order("upvote_count", { ascending: false })
      .order("created_at", { ascending: true });
    const rows = (ans ?? []) as Answer[];
    const ids = rows.map((r) => r.answerer_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
      const { data: rs } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      const rmap = new Map<string, "senior_mentor" | "teacher" | "admin">();
      (rs ?? []).forEach((r) => {
        if (r.role === "teacher" || r.role === "admin" || r.role === "senior_mentor") {
          // prefer teacher/admin > senior_mentor
          const cur = rmap.get(r.user_id);
          if (!cur || (cur === "senior_mentor" && r.role !== "senior_mentor")) {
            rmap.set(r.user_id, r.role as "senior_mentor" | "teacher" | "admin");
          }
        }
      });
      let upMap = new Set<string>();
      if (user) {
        const { data: up } = await supabase
          .from("senior_answer_upvotes")
          .select("answer_id")
          .eq("user_id", user.id)
          .in("answer_id", rows.map((r) => r.id));
        upMap = new Set((up ?? []).map((u) => u.answer_id));
      }
      rows.forEach((r) => {
        r.answerer = pmap.get(r.answerer_id) ?? null;
        r.answerer_role = rmap.get(r.answerer_id) ?? null;
        r.upvoted = upMap.has(r.id);
      });
    }
    setAnswers(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const submitAnswer = async () => {
    if (!user || !content.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("senior_answers").insert({
      question_id: questionId,
      answerer_id: user.id,
      content: content.trim().slice(0, 4000),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    toast.success("Answer posted (+20 XP)");
    setContent("");
    load();
  };

  const toggleUpvote = async (a: Answer) => {
    if (!user) return;
    if (a.upvoted) {
      await supabase
        .from("senior_answer_upvotes")
        .delete()
        .eq("answer_id", a.id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("senior_answer_upvotes")
        .insert({ answer_id: a.id, user_id: user.id });
    }
    load();
  };

  const togglePin = async (a: Answer) => {
    const { error } = await supabase
      .from("senior_answers")
      .update({ is_pinned: !a.is_pinned })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!q) return <div className="p-6 text-center text-sm text-muted-foreground">Question not found</div>;

  return (
    <div className="px-4 py-4">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/seniordesk" className="rounded-md p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Question</h1>
      </header>

      <Card className="mb-4">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-bold leading-tight">{q.title}</h2>
            <Badge variant="outline" className="shrink-0 text-xs">{CAT_LABELS[q.category]}</Badge>
          </div>
          {q.description && <p className="text-sm text-foreground/80">{q.description}</p>}
          <p className="text-xs text-muted-foreground">
            Asked by {q.is_anonymous ? "Anonymous Student" : (q.asker?.full_name ?? "Student")}
          </p>
        </CardContent>
      </Card>

      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        {answers.length} {answers.length === 1 ? "answer" : "answers"}
      </h3>

      <div className="mb-4 space-y-3">
        {answers.map((a) => (
          <Card key={a.id} className={a.is_pinned ? "border-accent" : ""}>
            <CardContent className="space-y-2 p-4">
              {a.is_pinned && (
                <div className="flex items-center gap-1 text-xs font-medium text-accent">
                  <Pin className="h-3 w-3" /> Pinned
                </div>
              )}
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={a.answerer?.photo_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {a.answerer?.full_name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{a.answerer?.full_name ?? "User"}</p>
                  {a.answerer_role && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                      <GraduationCap className="h-3 w-3" />
                      {a.answerer_role === "senior_mentor"
                        ? "Senior Mentor"
                        : a.answerer_role === "teacher"
                          ? "Teacher"
                          : "Admin"}
                    </span>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{a.content}</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={a.upvoted ? "default" : "outline"}
                  onClick={() => toggleUpvote(a)}
                >
                  <ArrowUp className="mr-1 h-3 w-3" /> {a.upvote_count}
                </Button>
                {canPin && (
                  <Button size="sm" variant="ghost" onClick={() => togglePin(a)}>
                    <Pin className="mr-1 h-3 w-3" />
                    {a.is_pinned ? "Unpin" : "Pin"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {canAnswer ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your guidance..."
              maxLength={4000}
              rows={4}
            />
            <Button onClick={submitAnswer} disabled={posting || !content.trim()} className="w-full">
              {posting ? "Posting..." : "Post answer (+20 XP)"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            Only verified seniors and teachers can answer.
          </CardContent>
        </Card>
      )}
    </div>
  );
}