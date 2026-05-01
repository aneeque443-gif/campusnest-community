import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search, Star, Settings, Bell, Plus } from "lucide-react";

type Book = {
  id: string;
  title: string;
  author: string;
  subject: string;
  year: string | null;
  cover_url: string | null;
  available_copies: number;
  total_copies: number;
  rating_avg: number;
  rating_count: number;
};

type Listing = {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  subject: string | null;
  condition: string;
  duration_days: number;
  status: string;
  notes: string;
};

type ProfileLite = { id: string; full_name: string; year: string; branch: string };

export const Route = createFileRoute("/_app/library")({
  head: () => ({ meta: [{ title: "Library — CampusNest" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const [tab, setTab] = useState("official");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("library_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [user]);

  return (
    <div className="space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-primary">
            <BookOpen className="h-6 w-6" /> Library
          </h1>
          <p className="text-xs text-muted-foreground">Browse the catalog or borrow from peers.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild size="icon" variant="ghost" className="relative">
            <Link to="/library/notifications">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild size="icon" variant="ghost">
              <Link to="/library/admin">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="official">Catalog</TabsTrigger>
          <TabsTrigger value="peers">Peers</TabsTrigger>
          <TabsTrigger value="mine">My loans</TabsTrigger>
        </TabsList>
        <TabsContent value="official" className="mt-3">
          <OfficialCatalog />
        </TabsContent>
        <TabsContent value="peers" className="mt-3">
          <PeerCatalog />
        </TabsContent>
        <TabsContent value="mine" className="mt-3">
          <MyLoans />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OfficialCatalog() {
  const [books, setBooks] = useState<Book[]>([]);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  useEffect(() => {
    supabase
      .from("library_books")
      .select("id,title,author,subject,year,cover_url,available_copies,total_copies,rating_avg,rating_count")
      .order("created_at", { ascending: false })
      .then(({ data }) => setBooks((data ?? []) as Book[]));
  }, []);

  const subjects = useMemo(
    () => Array.from(new Set(books.map((b) => b.subject).filter(Boolean))),
    [books],
  );
  const years = useMemo(
    () => Array.from(new Set(books.map((b) => b.year).filter(Boolean) as string[])),
    [books],
  );

  const filtered = books.filter((b) => {
    const ql = q.trim().toLowerCase();
    if (ql && !`${b.title} ${b.author}`.toLowerCase().includes(ql)) return false;
    if (subject !== "all" && b.subject !== subject) return false;
    if (year !== "all" && b.year !== year) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or author"
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">No books yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((b) => (
            <Link key={b.id} to="/library/book/$bookId" params={{ bookId: b.id }}>
              <Card className="h-full overflow-hidden shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
                <div className="aspect-[3/4] w-full bg-muted">
                  {b.cover_url ? (
                    <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><BookOpen className="h-8 w-8 text-muted-foreground" /></div>
                  )}
                </div>
                <CardContent className="space-y-1 p-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{b.title}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{b.author}</p>
                  <div className="flex items-center justify-between pt-1">
                    <Badge variant="secondary" className="text-[10px]">{b.subject}</Badge>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {b.rating_avg ? Number(b.rating_avg).toFixed(1) : "—"}
                    </span>
                  </div>
                  <Badge
                    variant={b.available_copies > 0 ? "default" : "destructive"}
                    className="w-full justify-center text-[10px]"
                  >
                    {b.available_copies > 0 ? `Available · ${b.available_copies}/${b.total_copies}` : "Borrowed"}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PeerCatalog() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await supabase
      .from("peer_book_listings")
      .select("id,owner_id,title,author,subject,condition,duration_days,status,notes")
      .neq("status", "withdrawn")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Listing[];
    setListings(list);
    const ids = Array.from(new Set(list.map((l) => l.owner_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, year, branch")
        .in("id", ids);
      const map: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as ProfileLite));
      setProfiles(map);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = listings.filter((l) =>
    !q.trim() || `${l.title} ${l.author}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9" />
        </div>
        <Button asChild size="sm">
          <Link to="/library/peer/new"><Plus className="h-4 w-4" /> Lend</Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">No peer listings yet.</CardContent></Card>
      ) : (
        filtered.map((l) => {
          const owner = profiles[l.owner_id];
          const isMine = user?.id === l.owner_id;
          return (
            <Link key={l.id} to="/library/peer/$listingId" params={{ listingId: l.id }}>
              <Card className="shadow-[var(--shadow-card)]">
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{l.title}</p>
                      <p className="text-xs text-muted-foreground">{l.author}</p>
                    </div>
                    <Badge variant={l.status === "available" ? "default" : "secondary"}>
                      {l.status === "available" ? "Available" : l.status === "lent" ? "Currently lent" : "Withdrawn"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    {owner && <span>{owner.full_name} · {owner.year} · {owner.branch}</span>}
                    <span>·</span>
                    <span>{l.duration_days}d</span>
                    <span>·</span>
                    <span className="capitalize">{l.condition.replace("_", " ")}</span>
                    {isMine && <Badge variant="outline" className="ml-auto text-[10px]">Yours</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}

function MyLoans() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{
    id: string; status: string; due_date: string | null; book: Book;
  }>>([]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("library_borrow_requests")
      .select("id,status,due_date, book:library_books(id,title,author,subject,year,cover_url,available_copies,total_copies,rating_avg,rating_count)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as any));
  }, [user]);

  if (!rows.length) {
    return <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">No borrow history yet.</CardContent></Card>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Link key={r.id} to="/library/book/$bookId" params={{ bookId: r.book.id }}>
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                {r.book.cover_url ? <img src={r.book.cover_url} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold text-foreground">{r.book.title}</p>
                <p className="line-clamp-1 text-[11px] text-muted-foreground">{r.book.author}</p>
                {r.due_date && r.status === "approved" && (
                  <p className="text-[11px] text-muted-foreground">Due {new Date(r.due_date).toLocaleDateString()}</p>
                )}
              </div>
              <Badge variant={r.status === "approved" ? "default" : r.status === "returned" ? "secondary" : "outline"} className="capitalize">{r.status}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}