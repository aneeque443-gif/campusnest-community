import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Heart,
  MessageSquare,
  Pin,
  Plus,
  Newspaper,
  Images,
  CalendarDays,
  BarChart3,
  Share2,
  ShieldCheck,
  Upload,
  X,
  Trash2,
} from "lucide-react";

type FeedPost = {
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

type Author = { id: string; full_name: string; photo_url: string | null };

export const Route = createFileRoute("/_app/feed")({
  head: () => ({ meta: [{ title: "NestFeed — CampusNest" }] }),
  component: FeedPage,
});

const TYPE_META = {
  article: { icon: Newspaper, label: "Article" },
  photo_story: { icon: Images, label: "Photo Story" },
  event: { icon: CalendarDays, label: "Event" },
  poll: { icon: BarChart3, label: "Poll" },
} as const;

function FeedPage() {
  const { user } = useAuth();
  const { isReporter, isAdmin } = useRoles();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [hasApplication, setHasApplication] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("feed_posts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as FeedPost[];
    setPosts(list);
    const ids = Array.from(new Set(list.map((p) => p.author_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      const map: Record<string, Author> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as Author));
      setAuthors(map);
    }
    setLoading(false);
  }

  async function loadApplication() {
    if (!user) return;
    const { data } = await supabase
      .from("reporter_applications")
      .select("status")
      .eq("applicant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setHasApplication(data?.status ?? null);
  }

  useEffect(() => {
    load();
    loadApplication();
  }, [user]);

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">College news</p>
          <h1 className="text-2xl font-bold text-primary">NestFeed</h1>
        </div>
        <div className="flex gap-1.5">
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/feed/admin">
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}
          {isReporter ? (
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Post
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setApplyOpen(true)}
              disabled={hasApplication === "pending"}
            >
              {hasApplication === "pending"
                ? "Application pending"
                : hasApplication === "rejected"
                  ? "Re-apply"
                  : "Become a Reporter"}
            </Button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="border-dashed shadow-[var(--shadow-card)]">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No posts yet. Reporters can publish the first story.
          </CardContent>
        </Card>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} author={authors[p.author_id]} />
        ))
      )}

      <ComposeDialog
        open={composeOpen}
        onOpenChange={(v) => {
          setComposeOpen(v);
          if (!v) load();
        }}
      />
      <ApplyDialog
        open={applyOpen}
        onOpenChange={(v) => {
          setApplyOpen(v);
          if (!v) loadApplication();
        }}
      />
    </div>
  );
}

function PostCard({ post, author }: { post: FeedPost; author?: Author }) {
  const meta = TYPE_META[post.type];
  const Icon = meta.icon;
  return (
    <Link
      to="/feed/$postId"
      params={{ postId: post.id }}
      className="block"
    >
      <Card className="overflow-hidden shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
        {post.cover_image && (
          <img
            src={post.cover_image}
            alt={post.title}
            className="h-40 w-full object-cover"
          />
        )}
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-accent" />
            <span className="font-medium uppercase tracking-wide">{meta.label}</span>
            {post.is_pinned && (
              <Badge variant="secondary" className="ml-auto gap-1">
                <Pin className="h-3 w-3" /> Pinned
              </Badge>
            )}
          </div>
          <h2 className="text-base font-semibold leading-snug text-foreground">
            {post.title}
          </h2>
          {post.type === "event" && post.event_date && (
            <p className="text-xs text-muted-foreground">
              {new Date(post.event_date).toLocaleString()} · {post.event_location}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 overflow-hidden rounded-full bg-muted">
                {author?.photo_url && (
                  <img src={author.photo_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {author?.full_name ?? "Reporter"}
              </span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" /> {post.like_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> {post.comment_count}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ApplyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [year, setYear] = useState<"FYIT" | "SYIT" | "TYIT">("FYIT");
  const [reason, setReason] = useState("");
  const [sample, setSample] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("profiles")
      .select("full_name, year")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? "");
          setYear((data.year as "FYIT" | "SYIT" | "TYIT") ?? "FYIT");
        }
      });
  }, [open, user]);

  async function submit() {
    if (!user) return;
    if (!reason.trim() || !sample.trim()) {
      toast.error("Fill all fields");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("reporter_applications").insert({
      applicant_id: user.id,
      full_name: fullName.trim(),
      year,
      reason: reason.trim().slice(0, 1000),
      writing_sample: sample.trim().slice(0, 3000),
      status: "pending",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Application submitted");
    onOpenChange(false);
    setReason("");
    setSample("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply to be a College Reporter</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} maxLength={100} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Select value={year} onValueChange={(v) => setYear(v as "FYIT" | "SYIT" | "TYIT")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FYIT">FYIT</SelectItem>
                <SelectItem value="SYIT">SYIT</SelectItem>
                <SelectItem value="TYIT">TYIT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Why do you want to be a reporter?</Label>
            <Textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Writing sample</Label>
            <Textarea rows={5} maxLength={3000} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Paste a short article or paragraph you've written" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComposeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<"article" | "photo_story" | "event" | "poll">("article");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setType("article");
    setTitle("");
    setBody("");
    setTags("");
    setCoverFile(null);
    setPhotoFiles([]);
    setPhotoCaptions([]);
    setEventDate("");
    setEventLocation("");
    setPollQuestion("");
    setPollOptions(["", ""]);
  }

  async function uploadImage(file: File): Promise<string> {
    if (!user) throw new Error("Not signed in");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("feed-images")
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
  }

  async function publish() {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    if (type === "poll") {
      if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) {
        toast.error("Poll needs a question and 2+ options");
        return;
      }
    }
    if (type === "event" && !eventDate) {
      toast.error("Event date required");
      return;
    }
    if (type === "photo_story" && photoFiles.length === 0) {
      toast.error("Add at least one photo");
      return;
    }
    setSaving(true);
    try {
      let coverUrl: string | null = null;
      if (coverFile) coverUrl = await uploadImage(coverFile);
      const tagArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);
      const { data: post, error } = await supabase
        .from("feed_posts")
        .insert({
          author_id: user.id,
          type,
          title: title.trim().slice(0, 200),
          body: body.trim().slice(0, 20000),
          cover_image: coverUrl,
          tags: tagArr,
          event_date: type === "event" ? new Date(eventDate).toISOString() : null,
          event_location: type === "event" ? eventLocation.trim().slice(0, 200) : null,
          poll_question: type === "poll" ? pollQuestion.trim().slice(0, 300) : null,
        })
        .select()
        .single();
      if (error) throw error;

      if (type === "photo_story") {
        const uploads = await Promise.all(photoFiles.map((f) => uploadImage(f)));
        const rows = uploads.map((url, i) => ({
          post_id: post.id,
          image_url: url,
          caption: (photoCaptions[i] ?? "").slice(0, 300),
          position: i,
        }));
        await supabase.from("feed_post_photos").insert(rows);
      }
      if (type === "poll") {
        const opts = pollOptions
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4)
          .map((t, i) => ({ post_id: post.id, text: t.slice(0, 100), position: i }));
        await supabase.from("feed_poll_options").insert(opts);
      }
      toast.success("Published! +30 XP");
      reset();
      onOpenChange(false);
      navigate({ to: "/feed/$postId", params: { postId: post.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a post</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Post type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="article">News article</SelectItem>
                <SelectItem value="photo_story">Photo story</SelectItem>
                <SelectItem value="event">Event announcement</SelectItem>
                <SelectItem value="poll">Poll</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {(type === "article" || type === "event" || type === "photo_story") && (
            <div className="space-y-1.5">
              <Label>Cover image (optional)</Label>
              <label
                htmlFor="coverFile"
                className="flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted hover:border-accent"
              >
                {coverFile ? (
                  <img src={URL.createObjectURL(coverFile)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <input
                  id="coverFile"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {type === "article" && (
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea rows={8} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your article. Markdown-friendly." />
            </div>
          )}

          {type === "photo_story" && (
            <div className="space-y-1.5">
              <Label>Photos</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).slice(0, 10);
                  setPhotoFiles(files);
                  setPhotoCaptions(new Array(files.length).fill(""));
                }}
              />
              {photoFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={URL.createObjectURL(f)} alt="" className="h-12 w-12 rounded object-cover" />
                  <Input
                    placeholder={`Caption for photo ${i + 1}`}
                    value={photoCaptions[i] ?? ""}
                    maxLength={300}
                    onChange={(e) => {
                      const next = [...photoCaptions];
                      next[i] = e.target.value;
                      setPhotoCaptions(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {type === "event" && (
            <>
              <div className="space-y-1.5">
                <Label>Date & time</Label>
                <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={eventLocation} maxLength={200} onChange={(e) => setEventLocation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={4} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </>
          )}

          {type === "poll" && (
            <>
              <div className="space-y-1.5">
                <Label>Question</Label>
                <Input maxLength={300} value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Options (2–4)</Label>
                {pollOptions.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      maxLength={100}
                      value={o}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    {pollOptions.length > 2 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setPollOptions([...pollOptions, ""])}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add option
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Tags (comma separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="campus, fest, IT" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={publish} disabled={saving}>{saving ? "Publishing…" : "Publish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}