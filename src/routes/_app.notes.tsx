import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import {
  Plus,
  Search,
  Upload,
  Bookmark,
  ArrowUp,
  ShieldCheck,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LecturesView } from "@/components/LecturesView";

const YEARS = ["FYIT", "SYIT", "TYIT"] as const;
const BRANCHES = ["IT", "CS", "EXTC", "Mechanical"] as const;

type NoteRow = {
  id: string;
  title: string;
  subject: string;
  year: (typeof YEARS)[number];
  branch: (typeof BRANCHES)[number];
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

export const Route = createFileRoute("/_app/notes")({
  head: () => ({ meta: [{ title: "NestNotes — CampusNest" }] }),
  component: NotesPage,
});

function NotesPage() {
  const { user } = useAuth();
  const [profileYear, setProfileYear] = useState<string>("");
  const [profileBranch, setProfileBranch] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tab, setTab] = useState<"notes" | "lectures">("notes");

  // Bootstrap: read profile defaults
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("year, branch")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfileYear(data.year);
          setProfileBranch(data.branch);
          setYearFilter(data.year);
          setBranchFilter(data.branch);
        }
      });
  }, [user]);

  async function loadNotes() {
    setLoading(true);
    let q = supabase
      .from("notes")
      .select(
        "id,title,subject,year,branch,description,file_url,file_type,tags,upvote_count,is_official,created_at,uploader_id",
      )
      .order("created_at", { ascending: false });
    if (yearFilter) q = q.eq("year", yearFilter as (typeof YEARS)[number]);
    if (branchFilter) q = q.eq("branch", branchFilter as (typeof BRANCHES)[number]);
    if (subjectFilter.trim()) q = q.ilike("subject", `%${subjectFilter.trim()}%`);
    if (search.trim()) {
      const s = search.trim().replace(/[%,]/g, "");
      q = q.or(`title.ilike.%${s}%,subject.ilike.%${s}%`);
    }
    const { data, error } = await q.limit(100);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((data ?? []).map((n) => n.uploader_id)));
    let profilesMap = new Map<string, { full_name: string; photo_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", ids);
      profilesMap = new Map((profs ?? []).map((p) => [p.id, p]));
    }
    setNotes(
      (data ?? []).map((n) => ({ ...n, uploader: profilesMap.get(n.uploader_id) ?? null })),
    );
    setLoading(false);
  }

  async function loadUserState() {
    if (!user) return;
    const [bm, uv] = await Promise.all([
      supabase.from("note_bookmarks").select("note_id").eq("user_id", user.id),
      supabase.from("note_upvotes").select("note_id").eq("user_id", user.id),
    ]);
    setBookmarkedIds(new Set((bm.data ?? []).map((r) => r.note_id)));
    setUpvotedIds(new Set((uv.data ?? []).map((r) => r.note_id)));
  }

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter, branchFilter, subjectFilter, search]);

  useEffect(() => {
    loadUserState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function toggleBookmark(noteId: string) {
    if (!user) return;
    if (bookmarkedIds.has(noteId)) {
      await supabase.from("note_bookmarks").delete().match({ note_id: noteId, user_id: user.id });
      const next = new Set(bookmarkedIds);
      next.delete(noteId);
      setBookmarkedIds(next);
    } else {
      const { error } = await supabase
        .from("note_bookmarks")
        .insert({ note_id: noteId, user_id: user.id });
      if (error) return toast.error(error.message);
      setBookmarkedIds(new Set(bookmarkedIds).add(noteId));
      toast.success("Bookmarked");
    }
  }

  async function toggleUpvote(noteId: string) {
    if (!user) return;
    if (upvotedIds.has(noteId)) {
      await supabase.from("note_upvotes").delete().match({ note_id: noteId, user_id: user.id });
      const next = new Set(upvotedIds);
      next.delete(noteId);
      setUpvotedIds(next);
      setNotes((ns) => ns.map((n) => (n.id === noteId ? { ...n, upvote_count: n.upvote_count - 1 } : n)));
    } else {
      const { error } = await supabase
        .from("note_upvotes")
        .insert({ note_id: noteId, user_id: user.id });
      if (error) return toast.error(error.message);
      setUpvotedIds(new Set(upvotedIds).add(noteId));
      setNotes((ns) => ns.map((n) => (n.id === noteId ? { ...n, upvote_count: n.upvote_count + 1 } : n)));
    }
  }

  const showingMine = useMemo(
    () => yearFilter === profileYear && branchFilter === profileBranch,
    [yearFilter, branchFilter, profileYear, profileBranch],
  );

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {tab === "notes" ? "NestNotes" : "LecVault"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {showingMine ? "Showing notes for your year & branch" : "Filtered view"}
          </p>
        </div>
        {tab === "notes" && (
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Upload
            </Button>
          </DialogTrigger>
          <UploadDialog
            onClose={() => setUploadOpen(false)}
            onUploaded={async () => {
              setUploadOpen(false);
              await loadNotes();
            }}
            defaultYear={profileYear}
            defaultBranch={profileBranch}
          />
        </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "notes" | "lectures")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="lectures">Lectures</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or subject"
              className="pl-9"
            />
          </div>
          {/* Filters */}
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
          {/* List */}
          {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : notes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No notes found. Be the first to upload!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              upvoted={upvotedIds.has(n.id)}
              bookmarked={bookmarkedIds.has(n.id)}
              onUpvote={() => toggleUpvote(n.id)}
              onBookmark={() => toggleBookmark(n.id)}
            />
          ))}
        </div>
          )}
        </TabsContent>

        <TabsContent value="lectures" className="mt-4">
          <LecturesView defaultYear={profileYear} defaultBranch={profileBranch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoteCard({
  note,
  upvoted,
  bookmarked,
  onUpvote,
  onBookmark,
}: {
  note: NoteRow;
  upvoted: boolean;
  bookmarked: boolean;
  onUpvote: () => void;
  onBookmark: () => void;
}) {
  const date = new Date(note.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <Link
          to="/notes/$noteId"
          params={{ noteId: note.id }}
          className="block"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-base font-semibold text-foreground">{note.title}</h3>
                {note.is_official && (
                  <Badge className="gap-1 bg-accent text-accent-foreground hover:bg-accent">
                    <ShieldCheck className="h-3 w-3" /> Official
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {note.subject} · {note.year} · {note.branch}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-7 w-7 overflow-hidden rounded-full bg-muted">
              {note.uploader?.photo_url ? (
                <img src={note.uploader.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                  {(note.uploader?.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {note.uploader?.full_name ?? "Unknown"}
              </p>
              <p className="text-[10px] text-muted-foreground">{date}</p>
            </div>
          </div>
          {note.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </Link>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
          <Button
            variant={upvoted ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1"
            onClick={onUpvote}
          >
            <ArrowUp className="h-3.5 w-3.5" /> {note.upvote_count}
          </Button>
          <Button
            variant={bookmarked ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1"
            onClick={onBookmark}
          >
            <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? "fill-current" : ""}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadDialog({
  onClose,
  onUploaded,
  defaultYear,
  defaultBranch,
}: {
  onClose: () => void;
  onUploaded: () => void;
  defaultYear: string;
  defaultBranch: string;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState(defaultYear || "FYIT");
  const [branch, setBranch] = useState(defaultBranch || "IT");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (defaultYear) setYear(defaultYear);
    if (defaultBranch) setBranch(defaultBranch);
  }, [defaultYear, defaultBranch]);

  function addTag() {
    const v = tagInput.trim().replace(/^#/, "");
    if (!v || tags.includes(v) || tags.length >= 8) return;
    setTags([...tags, v]);
    setTagInput("");
  }

  async function submit() {
    if (!user) return;
    if (!title.trim() || !subject.trim() || !file) {
      toast.error("Title, subject and file are required");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be ≤ 20MB");
      return;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF or image files allowed");
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("notes-files")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("notes-files").getPublicUrl(path);
      const { error: insErr } = await supabase.from("notes").insert({
        uploader_id: user.id,
        title: title.trim().slice(0, 120),
        subject: subject.trim().slice(0, 80),
        year: year as (typeof YEARS)[number],
        branch: branch as (typeof BRANCHES)[number],
        description: description.trim().slice(0, 1000),
        file_url: urlData.publicUrl,
        file_type: file.type,
        tags,
      });
      if (insErr) throw insErr;
      toast.success("Note uploaded! +15 XP");
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Upload note</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="t">Title</Label>
          <Input id="t" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="s">Subject</Label>
          <Input id="s" value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} />
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
          <Label htmlFor="d">Description</Label>
          <Textarea id="d" value={description} maxLength={1000} rows={3} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f">File (PDF or image, ≤20MB)</Label>
          <label
            htmlFor="f"
            className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted px-3 py-3 text-sm hover:border-accent"
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{file ? file.name : "Choose file"}</span>
          </label>
          <input
            id="f"
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1">
          <Label>Tags</Label>
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
              placeholder="Add a tag"
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
          {submitting ? "Uploading…" : "Upload"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}