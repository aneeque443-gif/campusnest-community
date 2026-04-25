
-- ============= SENIOR INVITES =============
CREATE TABLE public.senior_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.senior_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage invites" ON public.senior_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- helper: check if a profile's enrollment is a pending invite
CREATE OR REPLACE FUNCTION public.claim_senior_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.senior_invites%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.senior_invites WHERE enrollment_id = NEW.enrollment_id AND claimed_by IS NULL;
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'senior_mentor')
      ON CONFLICT DO NOTHING;
    UPDATE public.senior_invites SET claimed_by = NEW.id, claimed_at = now() WHERE id = inv.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_claim_senior_invite
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.claim_senior_invite();

-- ============= SENIOR QUESTIONS =============
CREATE TYPE public.senior_question_category AS ENUM ('academic','career','personal_growth','college_life');

CREATE TABLE public.senior_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asker_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category public.senior_question_category NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  answer_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.senior_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions visible to authed" ON public.senior_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users post own questions" ON public.senior_questions
  FOR INSERT TO authenticated WITH CHECK (asker_id = auth.uid());
CREATE POLICY "asker updates own question" ON public.senior_questions
  FOR UPDATE TO authenticated USING (asker_id = auth.uid());
CREATE POLICY "asker or admin deletes" ON public.senior_questions
  FOR DELETE TO authenticated USING (asker_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_senior_questions_updated
BEFORE UPDATE ON public.senior_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= SENIOR ANSWERS =============
CREATE TABLE public.senior_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.senior_questions(id) ON DELETE CASCADE,
  answerer_id UUID NOT NULL,
  content TEXT NOT NULL,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.senior_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "answers visible to authed" ON public.senior_answers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "verified replies only" ON public.senior_answers
  FOR INSERT TO authenticated WITH CHECK (
    answerer_id = auth.uid() AND (
      public.has_role(auth.uid(),'senior_mentor') OR
      public.has_role(auth.uid(),'teacher') OR
      public.has_role(auth.uid(),'admin')
    )
  );
CREATE POLICY "answerer edits own or pinners pin" ON public.senior_answers
  FOR UPDATE TO authenticated USING (
    answerer_id = auth.uid() OR
    public.has_role(auth.uid(),'teacher') OR
    public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "answerer or admin deletes" ON public.senior_answers
  FOR DELETE TO authenticated USING (answerer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_senior_answers_updated
BEFORE UPDATE ON public.senior_answers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- count answers + award XP
CREATE OR REPLACE FUNCTION public.handle_senior_answer_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.senior_questions SET answer_count = answer_count + 1 WHERE id = NEW.question_id;
    UPDATE public.profiles SET xp = xp + 20 WHERE id = NEW.answerer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.senior_questions SET answer_count = GREATEST(answer_count - 1, 0) WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_senior_answer_change
AFTER INSERT OR DELETE ON public.senior_answers
FOR EACH ROW EXECUTE FUNCTION public.handle_senior_answer_change();

-- ============= SENIOR ANSWER UPVOTES =============
CREATE TABLE public.senior_answer_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES public.senior_answers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(answer_id, user_id)
);
ALTER TABLE public.senior_answer_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upvotes visible" ON public.senior_answer_upvotes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users add own answer upvote" ON public.senior_answer_upvotes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users remove own answer upvote" ON public.senior_answer_upvotes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_senior_answer_upvote_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.senior_answers SET upvote_count = upvote_count + 1 WHERE id = NEW.answer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.senior_answers SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.answer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_senior_answer_upvote
AFTER INSERT OR DELETE ON public.senior_answer_upvotes
FOR EACH ROW EXECUTE FUNCTION public.handle_senior_answer_upvote_change();

-- ============= DOUBTS =============
CREATE TYPE public.doubt_category AS ENUM ('academic','personal_guidance','college_complaint','exam_stress','career_confusion');

CREATE TABLE public.doubts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  category public.doubt_category NOT NULL,
  content TEXT NOT NULL,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  is_revealed BOOLEAN NOT NULL DEFAULT false,
  is_answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;

-- author hidden — only author sees their own row's author_id via column-level... use a view instead
-- Strategy: SELECT policy hides author_id by using a security-definer view. Simpler: restrict SELECT but allow only author to read their own author_id via a separate "my_doubts" RPC.
-- We'll allow SELECT to all authed but client must NEVER select author_id; we enforce via column privileges.
CREATE POLICY "doubts visible" ON public.doubts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users post own doubt" ON public.doubts
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "author updates own doubt" ON public.doubts
  FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "author or admin deletes" ON public.doubts
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Revoke author_id column from anon/authenticated then grant only to service_role + via function
REVOKE SELECT (author_id) ON public.doubts FROM authenticated, anon;

-- function to check if current user is author (for is_revealed UI)
CREATE OR REPLACE FUNCTION public.is_doubt_author(_doubt_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.doubts WHERE id = _doubt_id AND author_id = auth.uid())
$$;

-- function returning IDs of doubts authored by current user
CREATE OR REPLACE FUNCTION public.my_doubt_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.doubts WHERE author_id = auth.uid()
$$;

CREATE TRIGGER trg_doubts_updated
BEFORE UPDATE ON public.doubts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- award +5 XP on doubt insert
CREATE OR REPLACE FUNCTION public.handle_new_doubt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET xp = xp + 5 WHERE id = NEW.author_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_new_doubt
AFTER INSERT ON public.doubts
FOR EACH ROW EXECUTE FUNCTION public.handle_new_doubt();

-- ============= DOUBT REPLIES =============
CREATE TABLE public.doubt_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id UUID NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  replier_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doubt_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replies visible" ON public.doubt_replies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "verified reply only" ON public.doubt_replies
  FOR INSERT TO authenticated WITH CHECK (
    replier_id = auth.uid() AND (
      public.has_role(auth.uid(),'teacher') OR
      public.has_role(auth.uid(),'admin') OR
      public.has_role(auth.uid(),'senior_mentor')
    )
  );
CREATE POLICY "replier deletes own" ON public.doubt_replies
  FOR DELETE TO authenticated USING (replier_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_doubt_reply_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.doubts SET reply_count = reply_count + 1, is_answered = true WHERE id = NEW.doubt_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.doubts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.doubt_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_doubt_reply_change
AFTER INSERT OR DELETE ON public.doubt_replies
FOR EACH ROW EXECUTE FUNCTION public.handle_doubt_reply_change();

-- ============= DOUBT UPVOTES =============
CREATE TABLE public.doubt_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id UUID NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doubt_id, user_id)
);
ALTER TABLE public.doubt_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doubt upvotes visible" ON public.doubt_upvotes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users add own doubt upvote" ON public.doubt_upvotes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users remove own doubt upvote" ON public.doubt_upvotes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_doubt_upvote_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.doubts SET upvote_count = upvote_count + 1 WHERE id = NEW.doubt_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.doubts SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.doubt_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_doubt_upvote
AFTER INSERT OR DELETE ON public.doubt_upvotes
FOR EACH ROW EXECUTE FUNCTION public.handle_doubt_upvote_change();

-- indexes
CREATE INDEX idx_senior_questions_created ON public.senior_questions(created_at DESC);
CREATE INDEX idx_senior_answers_question ON public.senior_answers(question_id, is_pinned DESC, upvote_count DESC, created_at);
CREATE INDEX idx_doubts_created ON public.doubts(created_at DESC);
CREATE INDEX idx_doubts_trending ON public.doubts(is_answered, upvote_count DESC);
