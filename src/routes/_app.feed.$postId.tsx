import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  Pin,
  Share2,
  Trash2,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";

type Post = {
  id: string;
  author_id: string;
  type: "article" | "photo_story" | "event" | "poll";
  title: string;
  body: string;
  cover_image: string | null;
  tags: string[];
  event_date: string | null;
  event_location: string | null;
  poll_question: string | null;
  is_pinned: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
};

type Photo = { id: string; image_url: string; caption: string; position: number };
type PollOption = { id: string; text: string; vote_count: number; position: number };
type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string; photo_url: string | null } | null;
};

export const Route = createFileRoute("/_app/feed/$postId")({
  head: () => ({ meta: [{ title: "Post — NestFeed" }] }),
  component: FeedPostPage,
});

function FeedPostPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<{ full_name: string; photo_url: string | null } | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [rsvped, setRsvped] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from("feed_posts").select("*").eq("id", postId).maybeSingle();
    if (!data) {
      setLoading(false);
      return;
    }
    const p = data as Post;
    setPost(p);

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, photo_url")
      .eq("id", p.author_id)
      .maybeSingle();
    setAuthor(prof ?? null);

    if (p.type === "photo_story") {
      const { data: ph } = await supabase
        .from("feed_post_photos")
        .select("*")
        .eq("post_id", postId)
        .order("position");
      setPhotos((ph ?? []) as Photo[]);
    }
    if (p.type === "poll") {
      const { data: opts } = await supabase
        .from("feed_poll_options")
        .select("*")
        .eq("post_id", postId)
        .order("position");
      setOptions((opts ?? []) as PollOption[]);
      if (user) {
        const { data: v } = await supabase
          .from("feed_poll_votes")
          .select("option_id")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();
        setMyVote(v?.option_id ?? null);
      }
    }
    if (p.type === "event") {
      const { count } = await supabase
        .from("feed_event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      setRsvpCount(count ?? 0);
      if (user) {
        const { data: r } = await supabase
          .from("feed_event_rsvps")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();
        setRsvped(!!r);
      }
    }
    if (user) {
      const { data: l } = await supabase
        .from("feed_post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!l);
    }
    const { data: cs } = await supabase
      .from("feed_post_comments")
      .select("id, user_id, content, created_at, profiles:user_id(full_name, photo_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((cs ?? []) as unknown as Comment[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [postId, user]);

  async function toggleLike() {
    if (!user || !post) return;
    if (liked) {
      await supabase.from("feed_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      setLiked(false);
      setPost({ ...post, like_count: Math.max(0, post.like_count - 1) });
    } else {
      const { error } = await supabase.from("feed_post_likes").insert({ post_id: post.id, user_id: user.id });
      if (!error) {
        setLiked(true);
        setPost({ ...post, like_count: post.like_count + 1 });
      }
    }
  }

  async function vote(optionId: string) {
    if (!user || myVote || !post) return;
    const { error } = await supabase
      .from("feed_poll_votes")
      .insert({ post_id: post.id, option_id: optionId, user_id: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMyVote(optionId);
    setOptions((prev) =>
      prev.map((o) => (o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o)),
    );
  }

  async function toggleRsvp() {
    if (!user || !post) return;
    if (rsvped) {
      await supabase.from("feed_event_rsvps").delete().eq("post_id", post.id).eq("user_id", user.id);
      setRsvped(false);
      setRsvpCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase.from("feed_event_rsvps").insert({ post_id: post.id, user_id: user.id });
      if (!error) {
        setRsvped(true);
        setRsvpCount((c) => c + 1);
      }
    }
  }

  async function submitComment() {
    if (!user || !post || !commentText.trim()) return;
    const { error } = await supabase.from("feed_post_comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: commentText.trim().slice(0, 1000),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCommentText("");
    await load();
  }

  async function togglePin() {
    if (!post) return;
    const { error } = await supabase
      .from("feed_posts")
      .update({ is_pinned: !post.is_pinned })
      .eq("id", post.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPost({ ...post, is_pinned: !post.is_pinned });
    toast.success(post.is_pinned ? "Unpinned" : "Pinned to top");
  }

  async function deletePost() {
    if (!post) return;
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("feed_posts").delete().eq("id", post.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    history.back();
  }

  function share() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy"),
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!post) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        Post not found.{" "}
        <Link to="/feed" className="text-primary underline">
          Back to feed
        </Link>
      </div>
    );
  }

  const totalVotes = options.reduce((s, o) => s + o.vote_count, 0);
  const isAuthor = user?.id === post.author_id;

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button asChild size="icon" variant="ghost">
          <Link to="/feed">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">NestFeed</span>
        {post.is_pinned && (
          <Badge variant="secondary" className="ml-auto gap-1">
            <Pin className="h-3 w-3" /> Pinned
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        {post.cover_image && (
          <img src={post.cover_image} alt={post.title} className="h-48 w-full object-cover" />
        )}
        <CardContent className="space-y-3 p-4">
          <h1 className="text-xl font-bold text-foreground">{post.title}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-6 w-6 overflow-hidden rounded-full bg-muted">
              {author?.photo_url && (
                <img src={author.photo_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <span>{author?.full_name ?? "Reporter"}</span>
            <span>·</span>
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
          </div>

          {post.type === "event" && (
            <div className="rounded-md bg-secondary p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <CalendarDays className="h-4 w-4 text-accent" />
                {post.event_date && new Date(post.event_date).toLocaleString()}
              </p>
              {post.event_location && (
                <p className="mt-1 text-muted-foreground">📍 {post.event_location}</p>
              )}
              <Button onClick={toggleRsvp} size="sm" className="mt-2 w-full" variant={rsvped ? "outline" : "default"}>
                {rsvped ? <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Going ({rsvpCount})</> : `RSVP (${rsvpCount} going)`}
              </Button>
            </div>
          )}

          {post.body && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.body}</div>
          )}

          {post.type === "photo_story" && photos.length > 0 && (
            <div className="space-y-3">
              {photos.map((p) => (
                <div key={p.id}>
                  <img src={p.image_url} alt={p.caption} className="w-full rounded-md object-cover" />
                  {p.caption && <p className="mt-1 text-xs text-muted-foreground">{p.caption}</p>}
                </div>
              ))}
            </div>
          )}

          {post.type === "poll" && (
            <div className="space-y-2">
              {post.poll_question && (
                <p className="text-sm font-medium text-foreground">{post.poll_question}</p>
              )}
              {options.map((o) => {
                const pct = totalVotes ? Math.round((o.vote_count / totalVotes) * 100) : 0;
                const mine = myVote === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => vote(o.id)}
                    disabled={!!myVote}
                    className="relative w-full overflow-hidden rounded-md border border-border bg-card p-3 text-left text-sm disabled:cursor-default"
                  >
                    {myVote && (
                      <div
                        className="absolute inset-y-0 left-0 bg-accent/20"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-between">
                      <span className={mine ? "font-semibold text-accent" : "text-foreground"}>{o.text}</span>
                      {myVote && <span className="text-xs text-muted-foreground">{pct}% · {o.vote_count}</span>}
                    </div>
                  </button>
                );
              })}
              {!myVote && <p className="text-xs text-muted-foreground">Tap an option to vote.</p>}
            </div>
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {post.tags.map((t) => (
                <Badge key={t} variant="secondary">#{t}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={toggleLike} variant={liked ? "default" : "outline"} size="sm">
              <Heart className={`mr-1.5 h-4 w-4 ${liked ? "fill-current" : ""}`} />
              {post.like_count}
            </Button>
            <Button onClick={share} variant="outline" size="sm">
              <Share2 className="mr-1.5 h-4 w-4" />
              Share
            </Button>
            {isAdmin && (
              <Button onClick={togglePin} variant="outline" size="sm">
                <Pin className="mr-1.5 h-4 w-4" />
                {post.is_pinned ? "Unpin" : "Pin"}
              </Button>
            )}
            {(isAuthor || isAdmin) && (
              <Button onClick={deletePost} variant="ghost" size="icon" className="ml-auto text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="space-y-3 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-accent" /> Comments ({post.comment_count})
          </h2>
          <div className="space-y-2">
            <Textarea
              rows={2}
              value={commentText}
              maxLength={1000}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
            />
            <Button size="sm" onClick={submitComment} disabled={!commentText.trim()}>
              Post comment
            </Button>
          </div>
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2">
                <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                  {c.profiles?.photo_url && (
                    <img src={c.profiles.photo_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{c.profiles?.full_name ?? "User"}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.content}</p>
                </div>
              </li>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}