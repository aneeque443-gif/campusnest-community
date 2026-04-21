
-- LECTURES
CREATE TABLE public.lectures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  year public.student_year NOT NULL,
  branch public.student_branch NOT NULL,
  video_url TEXT NOT NULL,
  video_provider TEXT NOT NULL DEFAULT 'youtube',
  video_id TEXT,
  description TEXT DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectures viewable by authenticated users"
  ON public.lectures FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers and admins can insert lectures"
  ON public.lectures FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Teachers can update their own lectures"
  ON public.lectures FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own lectures"
  ON public.lectures FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

CREATE INDEX idx_lectures_year_branch ON public.lectures(year, branch);
CREATE INDEX idx_lectures_subject ON public.lectures(subject);

CREATE TRIGGER lectures_updated_at
  BEFORE UPDATE ON public.lectures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LIKES
CREATE TABLE public.lecture_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lecture_id, user_id)
);

ALTER TABLE public.lecture_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by authenticated users"
  ON public.lecture_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add their own likes"
  ON public.lecture_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes"
  ON public.lecture_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_lecture_like_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lectures SET like_count = like_count + 1 WHERE id = NEW.lecture_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lectures SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.lecture_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_lecture_like_change
  AFTER INSERT OR DELETE ON public.lecture_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_lecture_like_change();

-- COMMENTS
CREATE TABLE public.lecture_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lecture_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture comments viewable by authenticated users"
  ON public.lecture_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add their own lecture comments"
  ON public.lecture_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lecture comments"
  ON public.lecture_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- SUGGESTED RESOURCES
CREATE TABLE public.lecture_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  suggested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lecture_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resources viewable by authenticated users"
  ON public.lecture_resources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can suggest resources"
  ON public.lecture_resources FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = suggested_by);

CREATE POLICY "Teachers can review resources"
  ON public.lecture_resources FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suggester or teacher can delete"
  ON public.lecture_resources FOR DELETE TO authenticated
  USING (
    auth.uid() = suggested_by
    OR public.has_role(auth.uid(), 'teacher')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER lecture_resources_updated_at
  BEFORE UPDATE ON public.lecture_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- View count increment function (callable by any authenticated user)
CREATE OR REPLACE FUNCTION public.increment_lecture_view(_lecture_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lectures
    SET view_count = view_count + 1
    WHERE id = _lecture_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_lecture_view(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_lecture_view(UUID) TO authenticated;
