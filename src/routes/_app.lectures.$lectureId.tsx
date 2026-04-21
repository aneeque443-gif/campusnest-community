import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles, detectVideo } from "@/lib/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  Heart,
  Send,
  Trash2,
  ExternalLink,
  Check,
  X,
  Plus,
} from "lucide-react";

type Lecture = {
  id: string;
  title: string;
  subject: string;
  year: string;
  branch: string;
  description: string | null;
  video_url: string;
  video_provider: string;
  video_id: string | null;
  tags: string[];
  view_count: number;
  like_count: number;
  created_at: string;
  teacher_id: string;
  teacher?: { full_name: string; photo_url: string | null } | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author?: { full_name: string; photo_url: string | null } | null;
};

type Resource = {
  id: string;
  url: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  suggested_by: string;
  suggester?: { full_name: string } | null;
};

export const Route = createFileRoute("/_app/lectures/$lectureId")({
  head: () => ({ meta: [{ title: "Lecture — CampusNest" }] }),
  component: LectureDetailPage,
});

function LectureDetailPage() {
  const { lectureId } = Route.useParams();
  const { user } = useAuth();
  const { isTeacher } = useRoles();
  const navigate = useNavigate();
  const viewIncrementedRef = useRef(false);

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [suggestUrl, setSuggestUrl] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [submittingResource, setSubmittingResource] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("lectures")
      .select("*")
      .eq("id", lectureId)
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Lecture not found");
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, photo_url")
      .eq("id", data.teacher_id)
      .maybeSingle();
    setLecture({ ...data, teacher: prof });

    if (user) {
      const { data: like } = await supabase
        .from("lecture_likes")
        .select("id")
        .eq("lecture_id", lectureId)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!like);
    }
    await Promise.all([loadComments(), loadResources()]);
    setLoading(false);
  }

  async function loadComments() {
    const { data } = await supabase
      .from("lecture_comments")
      .select("id, content, created_at, user_id")
      .eq("lecture_id", lectureId)
      .order("created_at", { ascending: true });
    const ids = Array.from(new Set((data ?? []).map((c) => c.user_id)));
    let map = new Map<string, { full_name: string; photo_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      map = new Map((profs ?? []).map((p) => [p.id, p]));
    }
    setComments((data ?? []).map((c) => ({ ...c, author: map.get(c.user_id) ?? null })));
  }

  async function loadResources() {
    const { data } = await supabase
      .from("lecture_resources")
      .select("id, url, description, status, suggested_by")
      .eq("lecture_id", lectureId)
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((data ?? []).map((r) => r.suggested_by)));
    let map = new Map<string, { full_name: string }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      map = new Map((profs ?? []).map((p) => [p.id, p]));
    }
    setResources(
      (data ?? []).map((r) => ({
        ...r,
        status: r.status as Resource["status"],
        suggester: map.get(r.suggested_by) ?? null,
      })),
    );
  }

  // Increment view count once per mount
  useEffect(() => {
    if (!user || viewIncrementedRef.current) return;
    viewIncrementedRef.current = true;
    supabase.rpc("increment_lecture_view", { _lecture_id: lectureId });
  }, [user, lectureId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId, user?.id]);

  async function toggleLike() {
    if (!user || !lecture) return;
    if (liked) {
      await supabase.from("lecture_likes").delete().match({ lecture_id: lecture.id, user_id: user.id });
      setLiked(false);
      setLecture({ ...lecture, like_count: lecture.like_count - 1 });
    } else {
      const { error } = await supabase
        .from("lecture_likes")
        .insert({ lecture_id: lecture.id, user_id: user.id });
      if (error) return toast.error(error.message);
      setLiked(true);
      setLecture({ ...lecture, like_count: lecture.like_count + 1 });
    }
  }

  async function postComment() {
    if (!user || !commentText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("lecture_comments").insert({
      lecture_id: lectureId,
      user_id: user.id,
      content: commentText.trim().slice(0, 500),
    });
    if (error) toast.error(error.message);
    else {
      setCommentText("");
      await loadComments();
    }
    setPosting(false);
  }

  async function removeComment(id: string) {
    const { error } = await supabase.from("lecture_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await loadComments();
  }

  async function suggestResource() {
    if (!user || !suggestUrl.trim()) return;
    try {
      new URL(suggestUrl.trim());
    } catch {
      return toast.error("Enter a valid URL");
    }
    setSubmittingResource(true);
    const { error } = await supabase.from("lecture_resources").insert({
      lecture_id: lectureId,
      suggested_by: user.id,
      url: suggestUrl.trim().slice(0, 500),
      description: suggestDesc.trim().slice(0, 300),
    });
    if (error) toast.error(error.message);
    else {
      setSuggestUrl("");
      setSuggestDesc("");
      toast.success("Resource submitted for review");
      await loadResources();
    }
    setSubmittingResource(false);
  }

  async function reviewResource(id: string, status: "approved" | "rejected") {
    if (!user) return;
    const { error } = await supabase
      .from("lecture_resources")
      .update({ status, reviewed_by: user.id })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await loadResources();
  }

  async function deleteLecture() {
    if (!lecture) return;
    if (!confirm("Delete this lecture?")) return;
    const { error } = await supabase.from("lectures").delete().eq("id", lecture.id);
    if (error) return toast.error(error.message);
    toast.success("Lecture deleted");
    navigate({ to: "/notes" });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!lecture) {
    return (
      <div className="space-y-3 p-6 text-center">
        <p className="text-muted-foreground">Lecture not found.</p>
        <Link to="/notes" className="text-sm text-primary underline">
          Back to LecVault
        </Link>
      </div>
    );
  }

  const video = detectVideo(lecture.video_url);
  const isOwner = user?.id === lecture.teacher_id;
  const date = new Date(lecture.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const approved = resources.filter((r) => r.status === "approved");
  const pending = resources.filter((r) => r.status === "pending");

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link to="/notes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        {isOwner && (
          <Button variant="ghost" size="sm" onClick={deleteLecture}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="aspect-video w-full bg-black">
          {video.provider === "youtube" && video.id ? (
            <iframe
              src={`https://www.youtube.com/embed/${video.id}`}
              title={lecture.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : video.provider === "drive" && video.id ? (
            <iframe
              src={`https://drive.google.com/file/d/${video.id}/preview`}
              title={lecture.title}
              className="h-full w-full"
              allow="autoplay"
            />
          ) : (
            <a
              href={lecture.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full w-full items-center justify-center gap-2 text-sm text-white"
            >
              <ExternalLink className="h-4 w-4" /> Open video
            </a>
          )}
        </div>
        <CardContent className="space-y-3 p-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{lecture.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lecture.subject} · {lecture.year} · {lecture.branch}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
              {lecture.teacher?.photo_url ? (
                <img src={lecture.teacher.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                  {(lecture.teacher?.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{lecture.teacher?.full_name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{date}</p>
            </div>
          </div>

          {lecture.description && (
            <p className="whitespace-pre-wrap text-sm text-foreground">{lecture.description}</p>
          )}

          {lecture.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lecture.tags.map((t) => (
                <Badge key={t} variant="secondary">#{t}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Button
              variant={liked ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={toggleLike}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {lecture.like_count}
            </Button>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> {lecture.view_count} views
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-foreground">Extra resources</h2>
          {approved.length === 0 ? (
            <p className="text-xs text-muted-foreground">No approved resources yet.</p>
          ) : (
            <ul className="space-y-2">
              {approved.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 hover:bg-secondary"
                  >
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{r.url}</p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Suggest form */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-foreground">Suggest a resource</p>
            <Input
              value={suggestUrl}
              onChange={(e) => setSuggestUrl(e.target.value)}
              placeholder="https://…"
              maxLength={500}
            />
            <Textarea
              value={suggestDesc}
              onChange={(e) => setSuggestDesc(e.target.value)}
              placeholder="What is this resource? (optional)"
              rows={2}
              maxLength={300}
            />
            <Button size="sm" className="gap-1" onClick={suggestResource} disabled={submittingResource || !suggestUrl.trim()}>
              <Plus className="h-4 w-4" /> Submit for review
            </Button>
          </div>

          {/* Pending review (teacher only) */}
          {isTeacher && pending.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-foreground">Pending review</p>
              {pending.map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-card p-2">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {r.url}
                  </a>
                  {r.description && (
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    by {r.suggester?.full_name ?? "Unknown"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="h-7 gap-1" onClick={() => reviewResource(r.id, "approved")}>
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => reviewResource(r.id, "rejected")}>
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-foreground">Comments ({comments.length})</h2>
          <div className="flex gap-2">
            <Textarea
              rows={2}
              maxLength={500}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
            />
            <Button size="icon" onClick={postComment} disabled={posting || !commentText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                    {c.author?.photo_url ? (
                      <img src={c.author.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                        {(c.author?.full_name ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-foreground">
                        {c.author?.full_name ?? "Unknown"}
                      </p>
                      {user?.id === c.user_id && (
                        <button onClick={() => removeComment(c.id)} aria-label="Delete comment">
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}