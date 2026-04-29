import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles, detectVideo } from "@/lib/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, Eye, Heart, PlayCircle, ListVideo } from "lucide-react";
import { useLecVaultBrowseTracker } from "@/lib/gamification";

const YEARS = ["FYIT", "SYIT", "TYIT"] as const;
const BRANCHES = ["IT", "CS", "EXTC", "Mechanical"] as const;

type Lecture = {
  id: string;
  title: string;
  subject: string;
  year: (typeof YEARS)[number];
  branch: (typeof BRANCHES)[number];
  video_url: string;
  video_provider: string;
  video_id: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  teacher_id: string;
  teacher?: { full_name: string; photo_url: string | null } | null;
};

export function LecturesView({
  defaultYear,
  defaultBranch,
}: {
  defaultYear: string;
  defaultBranch: string;
}) {
  const { isTeacher } = useRoles();
  const [yearFilter, setYearFilter] = useState(defaultYear);
  const [branchFilter, setBranchFilter] = useState(defaultBranch);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    setYearFilter(defaultYear);
    setBranchFilter(defaultBranch);
  }, [defaultYear, defaultBranch]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("lectures")
      .select("id,title,subject,year,branch,video_url,video_provider,video_id,view_count,like_count,created_at,teacher_id")
      .order(subjectFilter.trim() ? "created_at" : "created_at", { ascending: !!subjectFilter.trim() })
      .limit(100);
    if (yearFilter) q = q.eq("year", yearFilter as (typeof YEARS)[number]);
    if (branchFilter) q = q.eq("branch", branchFilter as (typeof BRANCHES)[number]);
    if (subjectFilter.trim()) q = q.ilike("subject", `%${subjectFilter.trim()}%`);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((data ?? []).map((l) => l.teacher_id)));
    let map = new Map<string, { full_name: string; photo_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      map = new Map((profs ?? []).map((p) => [p.id, p]));
    }
    setLectures((data ?? []).map((l) => ({ ...l, teacher: map.get(l.teacher_id) ?? null })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter, branchFilter, subjectFilter]);

  const playlistMode = !!subjectFilter.trim();

  return (
    <div className="space-y-4">
      {isTeacher && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full gap-1">
              <Plus className="h-4 w-4" /> Add Lecture
            </Button>
          </DialogTrigger>
          <AddLectureDialog
            onClose={() => setAddOpen(false)}
            onAdded={async () => {
              setAddOpen(false);
              await load();
            }}
            defaultYear={defaultYear}
            defaultBranch={defaultBranch}
          />
        </Dialog>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Select value={yearFilter || "all"} onValueChange={(v) => setYearFilter(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={branchFilter || "all"} onValueChange={(v) => setBranchFilter(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          placeholder="Subject"
        />
      </div>

      {playlistMode && lectures.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          <ListVideo className="h-3.5 w-3.5 text-accent" />
          Playlist: {lectures.length} lectures for &ldquo;{subjectFilter}&rdquo;
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : lectures.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No lectures yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lectures.map((l, i) => (
            <LectureCard key={l.id} lecture={l} index={playlistMode ? i + 1 : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function LectureCard({ lecture, index }: { lecture: Lecture; index?: number }) {
  const video = detectVideo(lecture.video_url);
  const thumb =
    video.provider === "youtube" && video.id
      ? `https://img.youtube.com/vi/${video.id}/0.jpg`
      : null;
  return (
    <Card className="overflow-hidden shadow-[var(--shadow-card)]">
      <Link to="/lectures/$lectureId" params={{ lectureId: lecture.id }} className="block">
        <div className="relative aspect-video w-full bg-muted">
          {thumb ? (
            <img src={thumb} alt={lecture.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[image:var(--gradient-primary)]">
              <PlayCircle className="h-12 w-12 text-primary-foreground/80" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30">
            <PlayCircle className="h-12 w-12 text-white opacity-0 transition-opacity hover:opacity-90" />
          </div>
          {index !== undefined && (
            <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
              {index}
            </span>
          )}
        </div>
        <CardContent className="p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{lecture.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lecture.subject} · {lecture.year} · {lecture.branch}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-6 w-6 overflow-hidden rounded-full bg-muted">
              {lecture.teacher?.photo_url ? (
                <img src={lecture.teacher.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-primary">
                  {(lecture.teacher?.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate text-xs text-foreground">
              {lecture.teacher?.full_name ?? "Unknown"}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Eye className="h-3 w-3" /> {lecture.view_count}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Heart className="h-3 w-3" /> {lecture.like_count}
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

function AddLectureDialog({
  onClose,
  onAdded,
  defaultYear,
  defaultBranch,
}: {
  onClose: () => void;
  onAdded: () => void;
  defaultYear: string;
  defaultBranch: string;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState(defaultYear || "FYIT");
  const [branch, setBranch] = useState(defaultBranch || "IT");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function addTag() {
    const v = tagInput.trim().replace(/^#/, "");
    if (!v || tags.includes(v) || tags.length >= 8) return;
    setTags([...tags, v]);
    setTagInput("");
  }

  async function submit() {
    if (!user || !title.trim() || !subject.trim() || !videoUrl.trim()) {
      return toast.error("Title, subject and video URL required");
    }
    const video = detectVideo(videoUrl.trim());
    if (video.provider === "other") {
      return toast.error("Use a YouTube or Google Drive link");
    }
    setSubmitting(true);
    const { error } = await supabase.from("lectures").insert({
      teacher_id: user.id,
      title: title.trim().slice(0, 120),
      subject: subject.trim().slice(0, 80),
      year: year as (typeof YEARS)[number],
      branch: branch as (typeof BRANCHES)[number],
      video_url: videoUrl.trim(),
      video_provider: video.provider,
      video_id: video.id,
      description: description.trim().slice(0, 1000),
      tags,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Lecture added");
      onAdded();
    }
    setSubmitting(false);
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add lecture</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="lt">Title</Label>
          <Input id="lt" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ls">Subject</Label>
          <Input id="ls" value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lv">Video URL (YouTube or Google Drive)</Label>
          <Input id="lv" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ld">Description</Label>
          <Textarea id="ld" value={description} maxLength={1000} rows={3} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Topic tags</Label>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              maxLength={20}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a topic"
            />
            <Button type="button" size="icon" onClick={addTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Add lecture"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}