
-- NOTES TABLE
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  year public.student_year NOT NULL,
  branch public.student_branch NOT NULL,
  description TEXT DEFAULT '',
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  upvote_count INTEGER NOT NULL DEFAULT 0,
  is_official BOOLEAN NOT NULL DEFAULT false,
  xp_milestone_awarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notes viewable by authenticated users"
  ON public.notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can upload their own notes"
  ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE TO authenticated USING (auth.uid() = uploader_id);

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE TO authenticated USING (auth.uid() = uploader_id);

CREATE INDEX idx_notes_year_branch ON public.notes(year, branch);
CREATE INDEX idx_notes_uploader ON public.notes(uploader_id);

-- UPVOTES
CREATE TABLE public.note_upvotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);

ALTER TABLE public.note_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Upvotes viewable by authenticated users"
  ON public.note_upvotes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add their own upvotes"
  ON public.note_upvotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own upvotes"
  ON public.note_upvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- BOOKMARKS
CREATE TABLE public.note_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);

ALTER TABLE public.note_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks"
  ON public.note_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own bookmarks"
  ON public.note_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own bookmarks"
  ON public.note_bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- COMMENTS
CREATE TABLE public.note_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.note_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated users"
  ON public.note_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add their own comments"
  ON public.note_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.note_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mark teacher uploads as official + award +15 XP on upload
CREATE OR REPLACE FUNCTION public.handle_new_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.uploader_id, 'teacher') OR public.has_role(NEW.uploader_id, 'admin') THEN
    NEW.is_official = true;
  END IF;

  UPDATE public.profiles
    SET xp = xp + 15
    WHERE id = NEW.uploader_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_note_created
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_note();

-- Maintain upvote_count and award +25 XP at 10 upvotes
CREATE OR REPLACE FUNCTION public.handle_upvote_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_uploader UUID;
  v_awarded BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.notes
      SET upvote_count = upvote_count + 1
      WHERE id = NEW.note_id
      RETURNING upvote_count, uploader_id, xp_milestone_awarded
      INTO v_count, v_uploader, v_awarded;

    IF v_count >= 10 AND NOT v_awarded THEN
      UPDATE public.profiles SET xp = xp + 25 WHERE id = v_uploader;
      UPDATE public.notes SET xp_milestone_awarded = true WHERE id = NEW.note_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.notes
      SET upvote_count = GREATEST(upvote_count - 1, 0)
      WHERE id = OLD.note_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_upvote_change
  AFTER INSERT OR DELETE ON public.note_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_upvote_change();

-- Storage bucket for note files
INSERT INTO storage.buckets (id, name, public) VALUES ('notes-files', 'notes-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Note files publicly readable"
  ON storage.objects FOR SELECT USING (bucket_id = 'notes-files');

CREATE POLICY "Users can upload note files to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notes-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own note files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'notes-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own note files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notes-files' AND auth.uid()::text = (storage.foldername(name))[1]);
