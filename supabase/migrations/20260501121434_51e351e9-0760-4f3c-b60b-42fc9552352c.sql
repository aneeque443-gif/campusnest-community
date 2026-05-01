
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.borrow_status AS ENUM ('pending','approved','rejected','returned','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.book_condition AS ENUM ('new','like_new','good','fair','worn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.peer_listing_status AS ENUM ('available','lent','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.peer_request_status AS ENUM ('pending','accepted','declined','returned','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ LIBRARY BOOKS ============
CREATE TABLE IF NOT EXISTS public.library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  subject TEXT NOT NULL,
  year TEXT,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books visible" ON public.library_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage books" ON public.library_books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_library_books_updated_at BEFORE UPDATE ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_library_books_subject ON public.library_books(subject);
CREATE INDEX IF NOT EXISTS idx_library_books_title ON public.library_books(title);

-- ============ BORROW REQUESTS ============
CREATE TABLE IF NOT EXISTS public.library_borrow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status public.borrow_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  due_date DATE,
  returned_at TIMESTAMPTZ,
  reviewed_by UUID,
  notes TEXT NOT NULL DEFAULT '',
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.library_borrow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own borrows; admins view all" ON public.library_borrow_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users request own borrow" ON public.library_borrow_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "admins manage borrows; user cancels own pending" ON public.library_borrow_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (user_id = auth.uid() AND status = 'pending'));
CREATE POLICY "admin or owner deletes" ON public.library_borrow_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_library_borrows_updated_at BEFORE UPDATE ON public.library_borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adjust available copies on approval / return
CREATE OR REPLACE FUNCTION public.handle_borrow_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
      UPDATE public.library_books
        SET available_copies = GREATEST(available_copies - 1, 0)
        WHERE id = NEW.book_id;
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      NEW.due_date := COALESCE(NEW.due_date, (CURRENT_DATE + INTERVAL '14 days')::date);
    END IF;
    IF NEW.status = 'returned' AND OLD.status IS DISTINCT FROM 'returned' THEN
      UPDATE public.library_books
        SET available_copies = LEAST(available_copies + 1, total_copies)
        WHERE id = NEW.book_id;
      NEW.returned_at := COALESCE(NEW.returned_at, now());
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_borrow_status BEFORE UPDATE ON public.library_borrow_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_borrow_status_change();

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS public.library_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id, user_id)
);
ALTER TABLE public.library_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews visible" ON public.library_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "users review books they returned" ON public.library_reviews FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.library_borrow_requests b
      WHERE b.book_id = library_reviews.book_id
        AND b.user_id = auth.uid()
        AND b.status = 'returned'
    )
  );
CREATE POLICY "users delete own review" ON public.library_reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_library_review_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bid UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN bid := NEW.book_id;
    UPDATE public.profiles SET xp = xp + 10 WHERE id = NEW.user_id;
    PERFORM public.log_xp(NEW.user_id, 'library_review', 10);
  ELSIF TG_OP = 'DELETE' THEN bid := OLD.book_id;
  END IF;

  UPDATE public.library_books
    SET rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.library_reviews WHERE book_id = bid), 0),
        rating_count = (SELECT count(*) FROM public.library_reviews WHERE book_id = bid)
    WHERE id = bid;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_library_review_change AFTER INSERT OR DELETE ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_library_review_change();

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS public.library_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.library_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notifications" ON public.library_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.library_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "self or admin inserts" ON public.library_notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ PEER LISTINGS ============
CREATE TABLE IF NOT EXISTS public.peer_book_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  subject TEXT,
  condition public.book_condition NOT NULL DEFAULT 'good',
  duration_days INTEGER NOT NULL DEFAULT 14 CHECK (duration_days > 0),
  notes TEXT NOT NULL DEFAULT '',
  status public.peer_listing_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.peer_book_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings visible" ON public.peer_book_listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "users create own listings" ON public.peer_book_listings FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates own listing" ON public.peer_book_listings FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "owner or admin deletes" ON public.peer_book_listings FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_peer_listings_updated_at BEFORE UPDATE ON public.peer_book_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PEER REQUESTS ============
CREATE TABLE IF NOT EXISTS public.peer_book_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.peer_book_listings(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  status public.peer_request_status NOT NULL DEFAULT 'pending',
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.peer_book_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties see own peer requests" ON public.peer_book_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR owner_id = auth.uid());
CREATE POLICY "user requests" ON public.peer_book_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');
CREATE POLICY "owner or requester updates" ON public.peer_book_requests FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR requester_id = auth.uid());

CREATE TRIGGER trg_peer_requests_updated_at BEFORE UPDATE ON public.peer_book_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE: book covers ============
INSERT INTO storage.buckets (id, name, public)
  VALUES ('library-covers', 'library-covers', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "library covers public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'library-covers');
CREATE POLICY "admins upload library covers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library-covers' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update library covers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'library-covers' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete library covers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'library-covers' AND public.has_role(auth.uid(),'admin'));

-- ============ DUE-DATE REMINDER (pg_cron) ============
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.send_library_due_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT b.id AS req_id, b.user_id, b.due_date, lb.title
      FROM public.library_borrow_requests b
      JOIN public.library_books lb ON lb.id = b.book_id
     WHERE b.status = 'approved'
       AND b.reminder_sent = false
       AND b.due_date IS NOT NULL
       AND b.due_date - CURRENT_DATE <= 2
       AND b.due_date >= CURRENT_DATE
  LOOP
    INSERT INTO public.library_notifications(user_id, kind, title, body, link)
      VALUES (r.user_id, 'due_soon', 'Book due soon',
              '"' || r.title || '" is due on ' || to_char(r.due_date,'Mon DD') || '.',
              '/library');
    UPDATE public.library_borrow_requests SET reminder_sent = true WHERE id = r.req_id;
  END LOOP;
END $$;

DO $$ BEGIN
  PERFORM cron.schedule('library-due-reminders', '0 9 * * *', $cron$ SELECT public.send_library_due_reminders(); $cron$);
EXCEPTION WHEN others THEN NULL; END $$;
