import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle, Bell, Megaphone, Paperclip, Pin, Plus, Settings2, Upload, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Exam", "Assignment", "Class change", "Event", "General"] as const;
const URGENCIES = ["Normal", "Urgent"] as const;
const YEARS = ["FYIT", "SYIT", "TYIT"] as const;
const BRANCHES = ["IT", "CS", "EXTC", "Mechanical"] as const;

type Notice = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  category: typeof CATEGORIES[number];
  urgency: typeof URGENCIES[number];
  target_year: string | null;
  target_branch: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  is_pinned: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_app/notices")({
  head: () => ({ meta: [{ title: "Notice Board — CampusNest" }] }),
  component: NoticesPage,
});

function NoticesPage() {
  const { user } = useAuth();
  const { isTeacher, isAdmin } = useRoles();
  const [profile, setProfile] = useState<{ year: string; branch: string } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: prof } = await supabase
      .from("profiles").select("year, branch").eq("id", user.id).maybeSingle();
    setProfile(prof as { year: string; branch: string } | null);
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as Notice[];
    setNotices(list);
    const ids = Array.from(new Set(list.map((n) => n.author_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (ps ?? []).forEach((p: { id: string; full_name: string }) => { map[p.id] = p.full_name; });
      setAuthorNames(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    if (!profile) return notices;
    return notices.filter((n) =>
      (n.target_year === null && n.target_branch === null) ||
      (n.target_year === profile.year && n.target_branch === profile.branch),
    );
  }, [notices, profile]);

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const active = filtered.filter((n) => new Date(n.created_at).getTime() >= cutoff);
  const archive = filtered.filter((n) => new Date(n.created_at).getTime() < cutoff);

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Megaphone className="h-6 w-6" /> Notice Board
          </h1>
          <p className="text-xs text-muted-foreground">
            {profile ? `${profile.year} · ${profile.branch}` : "Department announcements"}
          </p>
        </div>
        <div className="flex gap-1">
          {(isTeacher || isAdmin) && <ComposeNotice onSaved={load} />}
          {isAdmin && (
            <Link to="/notices/admin"><Button variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button></Link>
          )}
        </div>
      </header>

      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-3 space-y-2">
          {loading ? <p className="text-center text-sm text-muted-foreground">Loading…</p> :
            active.length === 0 ? <EmptyState /> :
            active.map((n) => <NoticeCard key={n.id} n={n} authorName={authorNames[n.author_id]} />)}
        </TabsContent>
        <TabsContent value="archive" className="mt-3 space-y-2">
          {archive.length === 0 ? <p className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">No archived notices.</p> :
            archive.map((n) => <NoticeCard key={n.id} n={n} authorName={authorNames[n.author_id]} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
      <Bell className="mx-auto mb-2 h-6 w-6" />
      No notices for your class right now.
    </CardContent></Card>
  );
}

function NoticeCard({ n, authorName }: { n: Notice; authorName?: string }) {
  const isUrgent = n.urgency === "Urgent";
  return (
    <Card className={cn(
      "shadow-[var(--shadow-card)]",
      isUrgent && "border-2 border-destructive",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span className="flex items-start gap-2">
            {n.is_pinned && <Pin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
            {isUrgent && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
            <span>{n.title}</span>
          </span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
          {isUrgent && <Badge variant="destructive" className="text-[10px]">Urgent</Badge>}
          {n.target_year && n.target_branch ? (
            <Badge variant="outline" className="text-[10px]">{n.target_year} · {n.target_branch}</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">All</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {n.body && <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>}
        {n.attachment_url && (
          <a href={n.attachment_url} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs hover:bg-secondary">
            <Paperclip className="h-3 w-3" /> {n.attachment_name ?? "Attachment"}
          </a>
        )}
        <p className="text-[10px] text-muted-foreground">
          By {authorName ?? "Teacher"} · {format(new Date(n.created_at), "PPp")}
        </p>
      </CardContent>
    </Card>
  );
}

function ComposeNotice({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("General");
  const [urgency, setUrgency] = useState<typeof URGENCIES[number]>("Normal");
  const [targetAll, setTargetAll] = useState(true);
  const [year, setYear] = useState<string>(YEARS[0]);
  const [branch, setBranch] = useState<string>(BRANCHES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      let attachment_url: string | null = null;
      let attachment_name: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("notice-files").upload(path, file);
        if (upErr) throw upErr;
        attachment_url = supabase.storage.from("notice-files").getPublicUrl(path).data.publicUrl;
        attachment_name = file.name;
      }
      const { error } = await supabase.from("notices").insert({
        author_id: user.id,
        title, body, category, urgency,
        target_year: targetAll ? null : (year as never),
        target_branch: targetAll ? null : (branch as never),
        attachment_url, attachment_name,
      });
      if (error) throw error;
      toast.success("Notice posted");
      setOpen(false); setTitle(""); setBody(""); setFile(null); setUrgency("Normal");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Post</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New notice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
          <div className="space-y-1.5"><Label>Body</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof CATEGORIES[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof URGENCIES[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{URGENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <div>
              <p className="text-sm font-medium">Send to all</p>
              <p className="text-[10px] text-muted-foreground">Off = target a specific class</p>
            </div>
            <Switch checked={targetAll} onCheckedChange={setTargetAll} />
          </div>
          {!targetAll && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Attachment (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted px-3 py-2 text-xs hover:bg-secondary">
              <Upload className="h-4 w-4" />
              <span className="flex-1 truncate">{file?.name ?? "Choose a file"}</span>
              {file && <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }}><X className="h-3 w-3" /></button>}
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>{saving ? "Posting…" : "Post notice"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}