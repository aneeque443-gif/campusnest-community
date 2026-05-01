import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, BookOpen, Star } from "lucide-react";
import { toast } from "sonner";

type Book = {
  id: string; title: string; author: string; subject: string; year: string | null;
  description: string; cover_url: string | null;
  available_copies: number; total_copies: number;
  rating_avg: number; rating_count: number;
};
type Review = { id: string; user_id: string; rating: number; body: string; created_at: string };
type Profile = { id: string; full_name: string };

export const Route = createFileRoute("/_app/library/book/$bookId")({
  head: () => ({ meta: [{ title: "Book — Library" }] }),
  component: BookPage,
});

function BookPage() {
  const { bookId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [myBorrow, setMyBorrow] = useState<{ id: string; status: string; due_date: string | null } | null>(null);
  const [hasReturned, setHasReturned] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");

  async function load() {
    const { data: b } = await supabase.from("library_books").select("*").eq("id", bookId).maybeSingle();
    setBook(b as Book | null);
    const { data: rv } = await supabase
      .from("library_reviews").select("*").eq("book_id", bookId).order("created_at", { ascending: false });
    const list = (rv ?? []) as Review[];
    setReviews(list);
    if (list.length) {
      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      const { data: p } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const m: Record<string, Profile> = {};
      (p ?? []).forEach((x) => (m[x.id] = x as Profile));
      setProfiles(m);
      if (user) setHasReviewed(list.some((r) => r.user_id === user.id));
    }
    if (user) {
      const { data: br } = await supabase
        .from("library_borrow_requests")
        .select("id,status,due_date")
        .eq("book_id", bookId).eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setMyBorrow(br as any);
      const { count } = await supabase
        .from("library_borrow_requests")
        .select("id", { count: "exact", head: true })
        .eq("book_id", bookId).eq("user_id", user.id).eq("status", "returned");
      setHasReturned((count ?? 0) > 0);
    }
  }
  useEffect(() => { load(); }, [bookId, user]);

  async function requestBorrow() {
    if (!user || !book) return;
    setBusy(true);
    const { error } = await supabase.from("library_borrow_requests").insert({
      book_id: book.id, user_id: user.id, status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Borrow request sent. Visit the librarian to confirm.");
    load();
  }

  async function submitReview() {
    if (!user || !book) return;
    setBusy(true);
    const { error } = await supabase.from("library_reviews").insert({
      book_id: book.id, user_id: user.id, rating, body: reviewBody.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Review posted (+10 XP)");
    setReviewBody("");
    load();
  }

  if (!book) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const canBorrow = book.available_copies > 0 && (!myBorrow || myBorrow.status === "returned" || myBorrow.status === "rejected");
  const pending = myBorrow && (myBorrow.status === "pending" || myBorrow.status === "approved");

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => nav({ to: "/library" })}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-lg font-bold text-foreground">Book details</h1>
      </div>

      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="flex gap-3 p-3">
          <div className="h-40 w-28 shrink-0 overflow-hidden rounded bg-muted">
            {book.cover_url ? <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><BookOpen className="h-8 w-8 text-muted-foreground" /></div>}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-base font-bold text-foreground">{book.title}</h2>
            <p className="text-sm text-muted-foreground">{book.author}</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{book.subject}</Badge>
              {book.year && <Badge variant="outline">{book.year}</Badge>}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {book.rating_avg ? Number(book.rating_avg).toFixed(1) : "—"}
              <span className="text-muted-foreground">({book.rating_count})</span>
            </div>
            <Badge variant={book.available_copies > 0 ? "default" : "destructive"}>
              {book.available_copies > 0 ? `Available · ${book.available_copies}/${book.total_copies}` : "All borrowed"}
            </Badge>
          </div>
        </div>
        {book.description && (
          <CardContent className="pt-0">
            <p className="whitespace-pre-wrap text-sm text-foreground">{book.description}</p>
          </CardContent>
        )}
      </Card>

      {pending ? (
        <Card>
          <CardContent className="space-y-1 p-3 text-sm">
            <p className="font-medium text-foreground">Your request: <span className="capitalize">{myBorrow?.status}</span></p>
            {myBorrow?.due_date && <p className="text-xs text-muted-foreground">Due {new Date(myBorrow.due_date).toLocaleDateString()}</p>}
          </CardContent>
        </Card>
      ) : (
        <Button className="w-full" onClick={requestBorrow} disabled={!canBorrow || busy}>
          {canBorrow ? "Request to Borrow" : "Currently unavailable"}
        </Button>
      )}

      {hasReturned && !hasReviewed && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="space-y-2 p-3">
            <p className="text-sm font-semibold">Leave a review (+10 XP)</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} placeholder="Optional written review..." rows={3} />
            <Button size="sm" onClick={submitReview} disabled={busy}>Post review</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Reviews</h3>
        {reviews.length === 0 ? (
          <p className="text-xs text-muted-foreground">No reviews yet.</p>
        ) : reviews.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-1 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">{profiles[r.user_id]?.full_name ?? "Student"}</p>
                <div className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}</div>
              </div>
              {r.body && <p className="whitespace-pre-wrap text-sm text-foreground">{r.body}</p>}
              <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}