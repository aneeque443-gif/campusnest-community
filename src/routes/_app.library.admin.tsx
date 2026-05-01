import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadBookCover } from "@/lib/library";

type Book = {
  id: string; title: string; author: string; subject: string; year: string | null;
  cover_url: string | null; total_copies: number; available_copies: number;
};
type Borrow = { id: string; book_id: string; user_id: string; status: string; due_date: string | null; created_at: string };

export const Route = createFileRoute("/_app/library/admin")({
  head: () => ({ meta: [{ title: "Library Admin — CampusNest" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading } = useRoles();
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!isAdmin) return <Navigate to="/library" />;

  return (
    <div className="space-y-3 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button asChild size="icon" variant="ghost"><Link to="/library"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-lg font-bold text-foreground">Library admin</h1>
      </div>
      <Tabs defaultValue="books">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
        </TabsList>
        <TabsContent value="books" className="mt-3 space-y-3">
          <NewBookForm onCreated={() => window.dispatchEvent(new Event("library-admin-refresh"))} />
          <BooksList userId={user?.id} />
        </TabsContent>
        <TabsContent value="loans" className="mt-3"><LoansList /></TabsContent>
      </Tabs>
    </div>
  );
}

function NewBookForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", subject: "", year: "", description: "", total_copies: 1 });
  const [file, setFile] = useState<File | null>(null);

  async function submit() {
    if (!user || !form.title.trim() || !form.author.trim() || !form.subject.trim()) {
      return toast.error("Title, author and subject are required");
    }
    setBusy(true);
    try {
      let cover_url: string | null = null;
      if (file) cover_url = await uploadBookCover(file);
      const { error } = await supabase.from("library_books").insert({
        title: form.title.trim(), author: form.author.trim(), subject: form.subject.trim(),
        year: form.year || null, description: form.description, cover_url,
        total_copies: form.total_copies, available_copies: form.total_copies, created_by: user.id,
      });
      if (error) throw error;
      toast.success("Book added");
      setForm({ title: "", author: "", subject: "", year: "", description: "", total_copies: 1 });
      setFile(null);
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="space-y-2 p-3">
        <p className="text-sm font-semibold">Add a new book</p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          <Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Input placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        </div>
        <Textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Total copies</Label>
            <Input type="number" min={1} value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: Math.max(1, +e.target.value || 1) })} />
          </div>
          <div>
            <Label className="text-[10px]">Cover image</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <Button size="sm" className="w-full" disabled={busy} onClick={submit}><Plus className="h-4 w-4" /> Add book</Button>
      </CardContent>
    </Card>
  );
}

function BooksList({ userId }: { userId: string | undefined }) {
  const [books, setBooks] = useState<Book[]>([]);
  async function load() {
    const { data } = await supabase.from("library_books").select("*").order("created_at", { ascending: false });
    setBooks((data ?? []) as Book[]);
  }
  useEffect(() => {
    load();
    const f = () => load();
    window.addEventListener("library-admin-refresh", f);
    return () => window.removeEventListener("library-admin-refresh", f);
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this book?")) return;
    const { error } = await supabase.from("library_books").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  if (!books.length) return <p className="text-sm text-muted-foreground">No books yet.</p>;
  return (
    <div className="space-y-2">
      {books.map((b) => (
        <Card key={b.id}>
          <CardContent className="flex items-center gap-3 p-3">
            <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
              {b.cover_url && <img src={b.cover_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold">{b.title}</p>
              <p className="text-[11px] text-muted-foreground">{b.author} · {b.subject}</p>
              <p className="text-[10px] text-muted-foreground">{b.available_copies}/{b.total_copies} available</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoansList() {
  const [rows, setRows] = useState<Array<Borrow & { book?: { title: string }; profile?: { full_name: string } }>>([]);
  async function load() {
    const { data } = await supabase
      .from("library_borrow_requests")
      .select("id, book_id, user_id, status, due_date, created_at, book:library_books(title)")
      .order("created_at", { ascending: false }).limit(100);
    const list = (data ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    let prof: Record<string, { full_name: string }> = {};
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      (p ?? []).forEach((x: any) => (prof[x.id] = { full_name: x.full_name }));
    }
    setRows(list.map((r) => ({ ...r, profile: prof[r.user_id] })));
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("library_borrow_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  }

  if (!rows.length) return <p className="text-sm text-muted-foreground">No borrow requests yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-1 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{r.book?.title ?? "(book)"}</p>
                <p className="text-[11px] text-muted-foreground">{r.profile?.full_name ?? "Student"}</p>
              </div>
              <Badge variant="secondary" className="capitalize">{r.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {r.status === "pending" && <>
                <Button size="sm" onClick={() => setStatus(r.id, "approved")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>Reject</Button>
              </>}
              {r.status === "approved" && <Button size="sm" onClick={() => setStatus(r.id, "returned")}>Mark returned</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}