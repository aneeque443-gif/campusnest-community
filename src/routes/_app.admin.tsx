import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Shield, Users, Newspaper, GraduationCap, BookOpen, DoorOpen,
  Megaphone, Flag, BarChart3, Search, Trash2, Pin, Ban, CheckCircle2, XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin — CampusNest" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading } = useRoles();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user || !isAdmin) return <Navigate to="/home" />;
  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
      </header>
      <Tabs defaultValue="dashboard">
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1">
          <TabsTrigger value="dashboard" className="text-[10px]"><BarChart3 className="mr-1 h-3 w-3" />Stats</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px]"><Users className="mr-1 h-3 w-3" />Users</TabsTrigger>
          <TabsTrigger value="reporters" className="text-[10px]"><Newspaper className="mr-1 h-3 w-3" />Reporters</TabsTrigger>
          <TabsTrigger value="seniors" className="text-[10px]"><GraduationCap className="mr-1 h-3 w-3" />Seniors</TabsTrigger>
        </TabsList>
        <TabsList className="mt-1 grid h-auto w-full grid-cols-4 gap-1">
          <TabsTrigger value="broadcast" className="text-[10px]"><Megaphone className="mr-1 h-3 w-3" />Broadcast</TabsTrigger>
          <TabsTrigger value="moderation" className="text-[10px]"><Flag className="mr-1 h-3 w-3" />Reports</TabsTrigger>
          <TabsTrigger value="manage" className="text-[10px]"><BookOpen className="mr-1 h-3 w-3" />Manage</TabsTrigger>
          <TabsTrigger value="returns" className="text-[10px]"><DoorOpen className="mr-1 h-3 w-3" />Library</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="reporters" className="mt-4"><ReportersTab /></TabsContent>
        <TabsContent value="seniors" className="mt-4"><SeniorsTab /></TabsContent>
        <TabsContent value="broadcast" className="mt-4"><BroadcastTab adminId={user.id} /></TabsContent>
        <TabsContent value="moderation" className="mt-4"><ModerationTab /></TabsContent>
        <TabsContent value="manage" className="mt-4"><ManageLinksTab /></TabsContent>
        <TabsContent value="returns" className="mt-4"><LibraryReturnsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function DashboardTab() {
  const [stats, setStats] = useState<{
    students: number; notesWeek: number; activeChat: number;
    topGigs: { id: string; title: string; completed_count: number }[];
    topReporters: { id: string; full_name: string; posts: number }[];
    leaderboard: { id: string; full_name: string; xp: number; level: string }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const sinceWeek = new Date(Date.now() - 7 * 86400000).toISOString();
      const sinceDay = new Date(Date.now() - 86400000).toISOString();
      const [students, notesW, chat, gigs, lb] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }).gte("created_at", sinceWeek),
        supabase.from("chat_messages").select("sender_id").gte("created_at", sinceDay),
        supabase.from("gigs").select("id, title, completed_count").order("completed_count", { ascending: false }).limit(5),
        supabase.from("profiles").select("id, full_name, xp, level").order("xp", { ascending: false }).limit(10),
      ]);
      const activeChat = new Set((chat.data ?? []).map((m: { sender_id: string }) => m.sender_id)).size;
      // top reporters: count feed_posts by author
      const { data: posts } = await supabase.from("feed_posts").select("author_id");
      const counts = new Map<string, number>();
      (posts ?? []).forEach((p: { author_id: string }) => counts.set(p.author_id, (counts.get(p.author_id) ?? 0) + 1));
      const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const { data: profs } = topIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", topIds.map(([id]) => id))
        : { data: [] };
      const topReporters = topIds.map(([id, posts]) => ({
        id, posts,
        full_name: profs?.find((p: { id: string }) => p.id === id)?.full_name ?? "Unknown",
      }));
      setStats({
        students: students.count ?? 0,
        notesWeek: notesW.count ?? 0,
        activeChat,
        topGigs: (gigs.data ?? []) as { id: string; title: string; completed_count: number }[],
        topReporters,
        leaderboard: (lb.data ?? []) as { id: string; full_name: string; xp: number; level: string }[],
      });
    })();
  }, []);

  if (!stats) return <SkeletonBlock />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Students" value={stats.students} />
        <Stat label="Notes / wk" value={stats.notesWeek} />
        <Stat label="Chat / 24h" value={stats.activeChat} />
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Top Gigs</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {stats.topGigs.length === 0 ? <Empty /> : stats.topGigs.map((g) => (
            <div key={g.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{g.title}</span>
              <Badge variant="secondary">{g.completed_count} done</Badge>
            </div>
          ))}
        </CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Top Reporters</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {stats.topReporters.length === 0 ? <Empty /> : stats.topReporters.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{r.full_name}</span>
              <Badge variant="secondary">{r.posts} posts</Badge>
            </div>
          ))}
        </CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">XP Leaderboard</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {stats.leaderboard.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{i + 1}. {p.full_name}</span>
              <Badge variant="secondary">{p.xp} XP · {p.level}</Badge>
            </div>
          ))}
        </CardContent></Card>
    </div>
  );
}

/* ---------------- Users ---------------- */
type AppRole = "student" | "teacher" | "admin" | "class_rep" | "senior_mentor" | "reporter";
const ROLE_OPTIONS: AppRole[] = ["student", "teacher", "senior_mentor", "reporter", "class_rep", "admin"];

function UsersTab() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<{ id: string; full_name: string; enrollment_id: string; year: string; branch: string; is_banned: boolean; xp: number }[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});

  async function load() {
    let q = supabase.from("profiles").select("id, full_name, enrollment_id, year, branch, is_banned, xp").order("created_at", { ascending: false }).limit(50);
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`full_name.ilike.${s},enrollment_id.ilike.${s}`);
    }
    const { data } = await q;
    setUsers((data ?? []) as typeof users);
    if (data && data.length) {
      const { data: r } = await supabase.from("user_roles").select("user_id, role").in("user_id", data.map((u: { id: string }) => u.id));
      const map: Record<string, AppRole[]> = {};
      (r ?? []).forEach((row: { user_id: string; role: AppRole }) => {
        map[row.user_id] = [...(map[row.user_id] ?? []), row.role];
      });
      setRolesByUser(map);
    }
  }
  useEffect(() => { load(); }, []);

  async function addRole(uid: string, role: AppRole) {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success(`Granted ${role}`);
    load();
  }
  async function removeRole(uid: string, role: AppRole) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    if (error) return toast.error(error.message);
    toast.success(`Removed ${role}`);
    load();
  }
  async function toggleBan(uid: string, banned: boolean) {
    const reason = banned ? null : prompt("Ban reason?") ?? "Violation of community guidelines";
    const { error } = await supabase.from("profiles").update({ is_banned: !banned, banned_reason: reason }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success(banned ? "User unbanned" : "User banned");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name or enrollment ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button size="sm" onClick={load}>Search</Button>
      </div>
      <div className="space-y-2">
        {users.length === 0 && <Empty />}
        {users.map((u) => {
          const userRoles = rolesByUser[u.id] ?? [];
          return (
            <Card key={u.id}><CardContent className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.full_name} {u.is_banned && <Badge variant="destructive">Banned</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{u.enrollment_id} · {u.year} · {u.branch} · {u.xp} XP</p>
                </div>
                <Button size="sm" variant={u.is_banned ? "outline" : "destructive"} onClick={() => toggleBan(u.id, u.is_banned)}>
                  <Ban className="mr-1 h-3 w-3" />{u.is_banned ? "Unban" : "Ban"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {userRoles.map((r) => (
                  <Badge key={r} variant="secondary" className="cursor-pointer" onClick={() => removeRole(u.id, r)}>
                    {r} ✕
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => addRole(u.id, v as AppRole)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Grant role" /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.filter((r) => !userRoles.includes(r)).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent></Card>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-muted-foreground">Account deletion must be performed from Lovable Cloud for safety.</p>
    </div>
  );
}

/* ---------------- Reporters ---------------- */
function ReportersTab() {
  const [apps, setApps] = useState<{ id: string; full_name: string; year: string; reason: string; writing_sample: string; status: string; created_at: string }[]>([]);
  async function load() {
    const { data } = await supabase.from("reporter_applications").select("*").order("created_at", { ascending: false });
    setApps((data ?? []) as typeof apps);
  }
  useEffect(() => { load(); }, []);
  async function review(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("reporter_applications").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Application ${status}`);
    load();
  }
  return (
    <div className="space-y-2">
      {apps.length === 0 && <Empty />}
      {apps.map((a) => (
        <Card key={a.id}><CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{a.full_name} · {a.year}</p>
            <Badge variant={a.status === "pending" ? "secondary" : a.status === "approved" ? "default" : "destructive"}>{a.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground"><b>Why:</b> {a.reason}</p>
          <p className="text-xs text-muted-foreground"><b>Sample:</b> {a.writing_sample}</p>
          {a.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(a.id, "approved")}><CheckCircle2 className="mr-1 h-3 w-3" />Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(a.id, "rejected")}><XCircle className="mr-1 h-3 w-3" />Reject</Button>
            </div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

/* ---------------- Seniors ---------------- */
function SeniorsTab() {
  const { user } = useAuth();
  const [eid, setEid] = useState("");
  const [invites, setInvites] = useState<{ id: string; enrollment_id: string; claimed_by: string | null; created_at: string }[]>([]);
  async function load() {
    const { data } = await supabase.from("senior_invites").select("*").order("created_at", { ascending: false }).limit(50);
    setInvites((data ?? []) as typeof invites);
  }
  useEffect(() => { load(); }, []);
  async function grant() {
    const id = eid.trim();
    if (!id || !user) return;
    // Try to find profile
    const { data: prof } = await supabase.from("profiles").select("id").eq("enrollment_id", id).maybeSingle();
    if (prof) {
      const { error } = await supabase.from("user_roles").insert({ user_id: prof.id, role: "senior_mentor" });
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
      toast.success("Granted Senior Mentor to existing user");
    } else {
      const { error } = await supabase.from("senior_invites").insert({ enrollment_id: id, invited_by: user.id });
      if (error) return toast.error(error.message);
      toast.success("Invite created — will apply when they sign up");
    }
    setEid("");
    load();
  }
  return (
    <div className="space-y-3">
      <Card><CardContent className="space-y-2 p-3">
        <Label className="text-xs">Enrollment ID</Label>
        <div className="flex gap-2">
          <Input value={eid} onChange={(e) => setEid(e.target.value)} placeholder="e.g. 23BCS1234" />
          <Button size="sm" onClick={grant}>Grant</Button>
        </div>
      </CardContent></Card>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">Recent invites</p>
        {invites.length === 0 && <Empty />}
        {invites.map((i) => (
          <div key={i.id} className="flex items-center justify-between rounded-md bg-card p-2 text-xs">
            <span className="font-mono">{i.enrollment_id}</span>
            <Badge variant={i.claimed_by ? "default" : "secondary"}>{i.claimed_by ? "Claimed" : "Pending"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Broadcast ---------------- */
function BroadcastTab({ adminId }: { adminId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [year, setYear] = useState<string>("all");
  const [branch, setBranch] = useState<string>("all");
  const [list, setList] = useState<{ id: string; title: string; body: string; created_at: string; target_year: string | null; target_branch: string | null }[]>([]);
  async function load() {
    const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(20);
    setList((data ?? []) as typeof list);
  }
  useEffect(() => { load(); }, []);
  async function send() {
    if (!title.trim()) return toast.error("Title required");
    const { error } = await supabase.from("broadcasts").insert({
      author_id: adminId,
      title: title.trim(),
      body: body.trim(),
      target_year: year === "all" ? null : year,
      target_branch: branch === "all" ? null : branch,
    });
    if (error) return toast.error(error.message);
    toast.success("Broadcast sent");
    setTitle(""); setBody(""); setYear("all"); setBranch("all");
    load();
  }
  async function del(id: string) {
    const { error } = await supabase.from("broadcasts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <div className="space-y-3">
      <Card><CardContent className="space-y-2 p-3">
        <Input placeholder="Announcement title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={3} placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              <SelectItem value="1st Year">1st Year</SelectItem>
              <SelectItem value="2nd Year">2nd Year</SelectItem>
              <SelectItem value="3rd Year">3rd Year</SelectItem>
              <SelectItem value="4th Year">4th Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              <SelectItem value="CSE">CSE</SelectItem>
              <SelectItem value="ECE">ECE</SelectItem>
              <SelectItem value="ME">ME</SelectItem>
              <SelectItem value="CE">CE</SelectItem>
              <SelectItem value="EE">EE</SelectItem>
              <SelectItem value="IT">IT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={send} className="w-full"><Megaphone className="mr-1 h-4 w-4" />Send broadcast</Button>
      </CardContent></Card>
      <div className="space-y-2">
        {list.length === 0 && <Empty />}
        {list.map((b) => (
          <Card key={b.id}><CardContent className="space-y-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{b.title}</p>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del(b.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">{b.body}</p>
            <div className="flex gap-1">
              {b.target_year && <Badge variant="outline" className="text-[10px]">{b.target_year}</Badge>}
              {b.target_branch && <Badge variant="outline" className="text-[10px]">{b.target_branch}</Badge>}
              {!b.target_year && !b.target_branch && <Badge variant="outline" className="text-[10px]">Everyone</Badge>}
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Moderation ---------------- */
function ModerationTab() {
  const { user } = useAuth();
  const [reports, setReports] = useState<{ id: string; content_type: string; content_id: string; reason: string; status: string; created_at: string; reporter_id: string }[]>([]);
  async function load() {
    const { data } = await supabase.from("content_reports").select("*").order("created_at", { ascending: false }).limit(50);
    setReports((data ?? []) as typeof reports);
  }
  useEffect(() => { load(); }, []);

  async function resolve(r: typeof reports[number], action: "delete" | "dismiss") {
    if (action === "delete") {
      const tableMap: Record<string, string> = {
        feed_post: "feed_posts", chat_message: "chat_messages", gig: "gigs",
        lost_found: "lost_found_items", doubt: "doubts", note: "notes",
      };
      const tbl = tableMap[r.content_type];
      if (tbl) {
        const { error } = await supabase.from(tbl).delete().eq("id", r.content_id);
        if (error) return toast.error(error.message);
      }
    }
    await supabase.from("content_reports").update({
      status: action === "delete" ? "resolved" : "dismissed",
      reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
    }).eq("id", r.id);
    toast.success(action === "delete" ? "Content removed" : "Report dismissed");
    load();
  }

  return (
    <div className="space-y-2">
      {reports.length === 0 && <Empty msg="No reports yet" />}
      {reports.map((r) => (
        <Card key={r.id}><CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{r.content_type}</Badge>
            <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
          </div>
          <p className="text-xs"><b>Reason:</b> {r.reason || "—"}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{r.content_id}</p>
          {r.status === "open" && (
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => resolve(r, "delete")}><Trash2 className="mr-1 h-3 w-3" />Delete content</Button>
              <Button size="sm" variant="outline" onClick={() => resolve(r, "dismiss")}>Dismiss</Button>
            </div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

/* ---------------- Manage links ---------------- */
function ManageLinksTab() {
  const items = [
    { to: "/notices/admin", label: "Notices", icon: Pin },
    { to: "/rooms/admin", label: "Study Rooms", icon: DoorOpen },
    { to: "/library/admin", label: "Library books", icon: BookOpen },
    { to: "/feed/admin", label: "Feed (pin posts)", icon: Newspaper },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((it) => (
        <Link key={it.to} to={it.to}>
          <Card className="transition hover:-translate-y-0.5"><CardContent className="flex flex-col items-center gap-1 p-4">
            <it.icon className="h-5 w-5 text-accent" />
            <p className="text-sm font-semibold">{it.label}</p>
          </CardContent></Card>
        </Link>
      ))}
    </div>
  );
}

/* ---------------- Library returns ---------------- */
function LibraryReturnsTab() {
  const [rows, setRows] = useState<{ id: string; user_id: string; book_id: string; status: string; due_date: string | null; book_title?: string; user_name?: string }[]>([]);
  async function load() {
    const { data } = await supabase.from("library_borrow_requests").select("id, user_id, book_id, status, due_date").in("status", ["pending", "approved"]).order("requested_at", { ascending: false }).limit(50);
    if (!data) return setRows([]);
    const bookIds = [...new Set(data.map((r: { book_id: string }) => r.book_id))];
    const userIds = [...new Set(data.map((r: { user_id: string }) => r.user_id))];
    const [{ data: books }, { data: users }] = await Promise.all([
      bookIds.length ? supabase.from("library_books").select("id, title").in("id", bookIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    ]);
    setRows(data.map((r: { id: string; user_id: string; book_id: string; status: string; due_date: string | null }) => ({
      ...r,
      book_title: books?.find((b: { id: string }) => b.id === r.book_id)?.title,
      user_name: users?.find((u: { id: string }) => u.id === r.user_id)?.full_name,
    })));
  }
  useEffect(() => { load(); }, []);
  async function setStatus(id: string, status: "approved" | "returned" | "rejected") {
    const { error } = await supabase.from("library_borrow_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  }
  return (
    <div className="space-y-2">
      {rows.length === 0 && <Empty msg="No active borrow requests" />}
      {rows.map((r) => (
        <Card key={r.id}><CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{r.book_title ?? r.book_id}</p>
            <Badge>{r.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">By {r.user_name} {r.due_date && `· due ${r.due_date}`}</p>
          <div className="flex gap-2">
            {r.status === "pending" && <>
              <Button size="sm" onClick={() => setStatus(r.id, "approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>Reject</Button>
            </>}
            {r.status === "approved" && <Button size="sm" onClick={() => setStatus(r.id, "returned")}>Mark returned</Button>}
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

/* ---------------- Helpers ---------------- */
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card><CardContent className="flex flex-col items-center p-3">
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </CardContent></Card>
  );
}
function Empty({ msg = "Nothing here yet" }: { msg?: string }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{msg}</p>;
}
function SkeletonBlock() {
  return <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />)}</div>;
}