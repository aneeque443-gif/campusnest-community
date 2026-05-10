import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles, detectVideo } from "@/lib/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const YEARS = ["FYIT", "SYIT", "TYIT"] as const;
const BRANCHES = ["IT", "CS", "EXTC", "Mechanical"] as const;

type Lecture = {
  id: string; title: string; subject: string;
  year: (typeof YEARS)[number]; branch: (typeof BRANCHES)[number];
  video_url: string; view_count: number; like_count: number; created_at: string;
};

export const Route = createFileRoute("/_app/lectures/admin")({
  head: () => ({ meta: [{ title: "Lectures Admin — CampusNest" }] }),
  component: LecturesAdmin,
});

function LecturesAdmin() {
  const { user } = useAuth();
  const { isTeacher, loading } = useRoles();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState<(typeof YEARS)[number]>("FYIT");
  const [branch, setBranch] = useState<(typeof BRANCHES)[number]>("IT");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("lectures")
      .select("id, title, subject, year, branch, video_url, view_count, like_count, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setLectures((data ?? []) as Lecture[]);
  }
  useEffect(() => { if (isTeacher) load(); }, [isTeacher]);

  if (loading) return <div className="p-6 text-center text-sm">Loading…</div>;
  if (!isTeacher) return <Navigate to="/notes" />;

  async function add() {
    if (!user || !title.trim() || !subject.trim() || !videoUrl.trim()) {
      return toast.error("Title, subject and video URL are required");
    }
    const v = detectVideo(videoUrl.trim());
    if (v.provider === "other") return toast.error("Use a YouTube or Google Drive link");
    setBusy(true);
    const { error } = await supabase.from("lectures").insert({
      teacher_id: user.id,
      title: title.trim().slice(0, 120),
      subject: subject.trim().slice(0, 80),
      year, branch,
      video_url: videoUrl.trim(),
      video_provider: v.provider,
      video_id: v.id,
      description: description.trim().slice(0, 1000),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lecture added");
    setTitle(""); setSubject(""); setVideoUrl(""); setDescription("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this lecture?")) return;
    const { error } = await supabase.from("lectures").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <Button asChild size="icon" variant="ghost"><Link to="/admin"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-bold text-primary">Lectures Admin</h1>
          <p className="text-xs text-muted-foreground">Add or remove LecVault lectures</p>
        </div>
      </header>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base">Add a lecture</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
          <div className="space-y-1"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Year</Label>
              <Select value={year} onValueChange={(v) => setYear(v as (typeof YEARS)[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Branch</Label>
              <Select value={branch} onValueChange={(v) => setBranch(v as (typeof BRANCHES)[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Video URL (YouTube or Google Drive)</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…" />
          </div>
          <div className="space-y-1"><Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </div>
          <Button onClick={add} disabled={busy} className="w-full"><Plus className="mr-1 h-4 w-4" />{busy ? "Saving…" : "Add lecture"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base">Existing lectures</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {lectures.length === 0
            ? <p className="text-sm text-muted-foreground">None yet.</p>
            : lectures.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold text-foreground">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{l.subject} · {l.year} · {l.branch} · {l.view_count} views</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))
          }
        </CardContent>
      </Card>
    </div>
  );
}
