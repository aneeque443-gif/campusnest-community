import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  Bookmark,
  Download,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type NoteFull = {
  id: string;
  title: string;
  subject: string;
  year: string;
  branch: string;
  description: string | null;
  file_url: string;
  file_type: string;
  tags: string[];
  upvote_count: number;
  is_official: boolean;
  created_at: string;
  uploader_id: string;
  uploader?: { full_name: string; photo_url: string | null } | null;
};

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author?: { full_name: string; photo_url: string | null } | null;
};

export const Route = createFileRoute("/_app/notes/$noteId")({
  head: () => ({ meta: [{ title: "Note — CampusNest" }] }),
  component: NoteDetailPage,
});

function NoteDetailPage() {
  const { noteId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [note, setNote] = useState<NoteFull | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [upvoted, setUpvoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Note not found");
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, photo_url")
      .eq("id", data.uploader_id)
      .maybeSingle();
    setNote({ ...data, uploader: prof });
    await loadComments();
    if (user) {
      const [up, bm] = await Promise.all([
        supabase
          .from("note_upvotes")
          .select("id")
          .eq("note_id", noteId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("note_bookmarks")
          .select("id")
          .eq("note_id", noteId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setUpvoted(!!up.data);
      setBookmarked(!!bm.data);
    }
    setLoading(false);
  }

  async function loadComments() {
    const { data } = await supabase
      .from("note_comments")
      .select("id, content, created_at, user_id")
      .eq("note_id", noteId)
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
    setComments(
      (data ?? []).map((c) => ({ ...c, author: map.get(c.user_id) ?? null })),
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, user?.id]);

  async function toggleUpvote() {
    if (!user || !note) return;
    if (upvoted) {
      await supabase.from("note_upvotes").delete().match({ note_id: note.id, user_id: user.id });
      setUpvoted(false);
      setNote({ ...note, upvote_count: note.upvote_count - 1 });
    } else {
      const { error } = await supabase.from("note_upvotes").insert({ note_id: note.id, user_id: user.id });
      if (error) return toast.error(error.message);
      setUpvoted(true);
      setNote({ ...note, upvote_count: note.upvote_count + 1 });
    }
  }

  async function toggleBookmark() {
    if (!user || !note) return;
    if (bookmarked) {
      await supabase.from("note_bookmarks").delete().match({ note_id: note.id, user_id: user.id });
      setBookmarked(false);
    } else {
      const { error } = await supabase.from("note_bookmarks").insert({ note_id: note.id, user_id: user.id });
      if (error) return toast.error(error.message);
      setBookmarked(true);
      toast.success("Saved to library");
    }
  }

  async function postComment() {
    if (!user || !commentText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("note_comments").insert({
      note_id: noteId,
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
    const { error } = await supabase.from("note_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await loadComments();
  }

  async function deleteNote() {
    if (!note) return;
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", note.id);
    if (error) return toast.error(error.message);
    toast.success("Note deleted");
    navigate({ to: "/notes" });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!note) {
    return (
      <div className="space-y-3 p-6 text-center">
        <p className="text-muted-foreground">Note not found.</p>
        <Link to="/notes" className="text-sm text-primary underline">Back to Notes</Link>
      </div>
    );
  }

  const date = new Date(note.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isOwner = user?.id === note.uploader_id;

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link to="/notes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        {isOwner && (
          <Button variant="ghost" size="sm" onClick={deleteNote}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="space-y-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{note.title}</h1>
              {note.is_official && (
                <Badge className="gap-1 bg-accent text-accent-foreground hover:bg-accent">
                  <ShieldCheck className="h-3 w-3" /> Official
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {note.subject} · {note.year} · {note.branch}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
              {note.uploader?.photo_url ? (
                <img src={note.uploader.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                  {(note.uploader?.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{note.uploader?.full_name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{date}</p>
            </div>
          </div>

          {note.description && (
            <p className="whitespace-pre-wrap text-sm text-foreground">{note.description}</p>
          )}

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {note.tags.map((t) => (
                <Badge key={t} variant="secondary">#{t}</Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button
              variant={upvoted ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={toggleUpvote}
            >
              <ArrowUp className="h-4 w-4" /> {note.upvote_count}
            </Button>
            <Button
              variant={bookmarked ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={toggleBookmark}
            >
              <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} />
              {bookmarked ? "Saved" : "Save"}
            </Button>
            <Button asChild size="sm" className="ml-auto gap-1">
              <a href={note.file_url} target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4" /> Download
              </a>
            </Button>
          </div>
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
                        <button
                          onClick={() => removeComment(c.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
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