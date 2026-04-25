-- Enum for post type
DO $$ BEGIN
  CREATE TYPE public.feed_post_type AS ENUM ('article','photo_story','event','poll');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reporter applications
CREATE TABLE public.reporter_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  year public.student_year NOT NULL,
  reason TEXT NOT NULL,
  writing_sample TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reporter_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applicants view own; admins view all" ON public.reporter_applications
  FOR SELECT TO authenticated
  USING (applicant_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "users apply" ON public.reporter_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid() AND status = 'pending');
CREATE POLICY "admins review" ON public.reporter_applications
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Auto-grant reporter role on approval
CREATE OR REPLACE FUNCTION public.handle_reporter_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.applicant_id, 'reporter')
      ON CONFLICT DO NOTHING;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_reporter_approval BEFORE UPDATE ON public.reporter_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_reporter_approval();

-- Feed posts
CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  type public.feed_post_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  event_date TIMESTAMPTZ,
  event_location TEXT,
  poll_question TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts visible" ON public.feed_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "reporters publish" ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      has_role(auth.uid(),'reporter') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'admin')
    )
  );
CREATE POLICY "author edits or admin pins" ON public.feed_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "author or admin deletes" ON public.feed_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE INDEX idx_feed_posts_created ON public.feed_posts(created_at DESC);
CREATE INDEX idx_feed_posts_author ON public.feed_posts(author_id);

-- XP for publishing
CREATE OR REPLACE FUNCTION public.handle_new_feed_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET xp = xp + 30 WHERE id = NEW.author_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_new_feed_post AFTER INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_feed_post();

-- Updated_at
CREATE TRIGGER trg_feed_posts_updated BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Photos for photo stories
CREATE TABLE public.feed_post_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_post_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos visible" ON public.feed_post_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "author manages photos" ON public.feed_post_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND p.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

-- Poll options
CREATE TABLE public.feed_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "options visible" ON public.feed_poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "author manages options" ON public.feed_poll_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND p.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

-- Poll votes
CREATE TABLE public.feed_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.feed_poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.feed_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes visible" ON public.feed_poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users vote once" ON public.feed_poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "users remove own vote" ON public.feed_poll_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_poll_vote_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_poll_vote AFTER INSERT OR DELETE ON public.feed_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_poll_vote_change();

-- Event RSVPs
CREATE TABLE public.feed_event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.feed_event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsvps visible" ON public.feed_event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "users rsvp own" ON public.feed_event_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "users cancel own rsvp" ON public.feed_event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Likes
CREATE TABLE public.feed_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.feed_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes visible" ON public.feed_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users like" ON public.feed_post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "users unlike" ON public.feed_post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_feed_like_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_feed_like AFTER INSERT OR DELETE ON public.feed_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_feed_like_change();

-- Comments
CREATE TABLE public.feed_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments visible" ON public.feed_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "users comment" ON public.feed_post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user or admin deletes comment" ON public.feed_post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_feed_comment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_feed_comment AFTER INSERT OR DELETE ON public.feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_feed_comment_change();

-- Storage bucket for feed images (covers + photo stories)
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-images','feed-images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "feed images public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'feed-images');
CREATE POLICY "users upload feed images to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own feed images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed-images' AND auth.uid()::text = (storage.foldername(name))[1]);
